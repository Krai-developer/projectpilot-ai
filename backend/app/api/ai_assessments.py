import json
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_owned_assessment, get_owned_project
from app.api.projects import serialize_assessment
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    Assessment,
    Milestone,
    MilestoneStatus,
    Requirement,
    RequirementStatus,
    Task,
    TaskStatus,
    User,
)
from app.schemas.schemas import (
    AITaskGenerationRequest,
    AITaskGenerationResponse,
    ApproveGeneratedPlanRequest,
    ApproveGeneratedPlanResponse,
    AssessmentReportFindings,
    AssessmentResponse,
)
from app.services.completion_service import (
    build_project_state_snapshot,
    evaluate_project_completion_gate,
    generate_deterministic_next_steps,
    invalidate_assessments_and_sync_project_state,
    record_activity,
)
from app.services.ollama_service import OllamaLocalService, OllamaServiceError

router = APIRouter(prefix="/api", tags=["AI & Assessments"])


def get_ollama_service() -> OllamaLocalService:
    return OllamaLocalService()


@router.post(
    "/projects/{project_id}/ai/generate-tasks",
    response_model=AITaskGenerationResponse,
)
async def generate_tasks_with_ai(
    project_id: int,
    payload: AITaskGenerationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    ollama_service: OllamaLocalService = Depends(get_ollama_service),
):
    project = get_owned_project(db, project_id, current_user)
    description_to_use = (payload.project_description or project.description or "").strip()
    if not description_to_use and not project.objectives:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a project description or objectives before requesting AI task suggestions.",
        )

    existing_task_titles = {t.title.strip().lower() for t in (project.tasks or [])}
    existing_req_titles = {r.title.strip().lower() for r in (project.requirements or [])}
    existing_ms_titles = {m.title.strip().lower() for m in (project.milestones or [])}

    try:
        generated, model_name = await ollama_service.generate_project_plan_suggestions(
            project_name=project.name,
            project_description=description_to_use,
            project_objectives=project.objectives,
            focus_area=payload.focus_area,
        )
    except OllamaServiceError as exc:
        msg = str(exc)
        if "unavailable" in msg.lower() or "timed out" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=msg,
        )

    # Deduplicate within the AI response and against existing project records
    dedup_reqs = []
    seen_reqs = set(existing_req_titles)
    for r in generated.requirements:
        key = r.title.strip().lower()
        if key and key not in seen_reqs:
            seen_reqs.add(key)
            dedup_reqs.append(r)

    dedup_ms = []
    seen_ms = set(existing_ms_titles)
    for m in generated.milestones:
        key = m.title.strip().lower()
        if key and key not in seen_ms:
            seen_ms.add(key)
            dedup_ms.append(m)

    dedup_tasks = []
    seen_tasks = set(existing_task_titles)
    for t in generated.tasks:
        key = t.title.strip().lower()
        if key and key not in seen_tasks:
            seen_tasks.add(key)
            dedup_tasks.append(t)

    return AITaskGenerationResponse(
        project_id=project.id,
        model_name=model_name,
        ai_used=True,
        requirements=dedup_reqs,
        milestones=dedup_ms,
        tasks=dedup_tasks,
    )


@router.post(
    "/projects/{project_id}/ai/approve-tasks",
    response_model=ApproveGeneratedPlanResponse,
    status_code=status.HTTP_201_CREATED,
)
def approve_and_save_generated_plan(
    project_id: int,
    payload: ApproveGeneratedPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)

    existing_reqs = {r.title.strip().lower(): r for r in (project.requirements or [])}
    existing_ms = {m.title.strip().lower(): m for m in (project.milestones or [])}
    existing_tasks = {t.title.strip().lower(): t for t in (project.tasks or [])}

    created_reqs = 0
    created_ms = 0
    created_tasks = 0
    skipped_duplicates = 0

    for req_item in payload.requirements:
        key = req_item.title.strip().lower()
        if not key or key in existing_reqs:
            skipped_duplicates += 1
            continue
        req = Requirement(
            project_id=project.id,
            title=req_item.title.strip(),
            description=req_item.description.strip(),
            is_mandatory=req_item.is_mandatory,
            acceptance_criteria=req_item.acceptance_criteria.strip(),
            status=RequirementStatus.UNMAPPED.value,
        )
        db.add(req)
        db.flush()
        existing_reqs[key] = req
        created_reqs += 1

    for ms_item in payload.milestones:
        key = ms_item.title.strip().lower()
        if not key or key in existing_ms:
            skipped_duplicates += 1
            continue
        ms = Milestone(
            project_id=project.id,
            title=ms_item.title.strip(),
            description=ms_item.description.strip(),
            is_required=ms_item.is_required,
            status=MilestoneStatus.PENDING.value,
        )
        db.add(ms)
        db.flush()
        existing_ms[key] = ms
        created_ms += 1

    for task_item in payload.tasks:
        key = task_item.title.strip().lower()
        if not key or key in existing_tasks:
            skipped_duplicates += 1
            continue

        ms_id = None
        if task_item.milestone_title:
            matched_ms = existing_ms.get(task_item.milestone_title.strip().lower())
            if matched_ms:
                ms_id = matched_ms.id

        matched_reqs: List[Requirement] = []
        for req_title in task_item.linked_requirement_titles:
            r_obj = existing_reqs.get(req_title.strip().lower())
            if r_obj:
                matched_reqs.append(r_obj)
                if r_obj.status == RequirementStatus.UNMAPPED.value:
                    r_obj.status = RequirementStatus.IN_PROGRESS.value

        task = Task(
            project_id=project.id,
            milestone_id=ms_id,
            title=task_item.title.strip(),
            description=task_item.description.strip(),
            status=TaskStatus.TO_DO.value,
            priority=task_item.priority.value,
            weight=task_item.weight,
            estimated_hours=task_item.estimated_hours,
            actual_hours=0.0,
            notes=task_item.acceptance_notes.strip(),
        )
        task.requirements = matched_reqs
        db.add(task)
        db.flush()
        existing_tasks[key] = task
        created_tasks += 1

    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason="Approved AI-generated project plan suggestions"
    )
    record_activity(
        db,
        project_id=project.id,
        action="ai_suggestions_approved",
        details={
            "created_requirements": created_reqs,
            "created_milestones": created_ms,
            "created_tasks": created_tasks,
            "skipped_duplicates": skipped_duplicates,
        },
    )
    db.commit()
    return ApproveGeneratedPlanResponse(
        created_requirements=created_reqs,
        created_milestones=created_ms,
        created_tasks=created_tasks,
        skipped_duplicates=skipped_duplicates,
    )


@router.post(
    "/projects/{project_id}/assessments",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_assessment(
    project_id: int,
    require_ai: bool = Query(
        default=False,
        description="If true, fail with HTTP 503/502 when local Ollama is unavailable or returns invalid output instead of falling back to deterministic assessment.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    ollama_service: OllamaLocalService = Depends(get_ollama_service),
):
    # Step 1 & 2: Load authenticated user's project, requirements, tasks, dependencies, milestones, and evidence
    project = get_owned_project(db, project_id, current_user)
    tasks = list(project.tasks or [])
    requirements = list(project.requirements or [])

    # Step 3 & 4: Calculate progress independently & evaluate mandatory completion criteria
    gate = evaluate_project_completion_gate(project)
    deterministic_next_steps = generate_deterministic_next_steps(project, gate)
    state_snapshot = build_project_state_snapshot(project, gate)

    completed_work = [
        {
            "task_id": t.id,
            "title": t.title,
            "weight": t.weight,
            "verified_evidence_count": sum(
                1 for ev in (t.evidence_items or []) if ev.verification_status == "verified"
            ),
        }
        for t in tasks
        if t.status == TaskStatus.DONE.value
    ]
    remaining_tasks = [
        {
            "task_id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "weight": t.weight,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }
        for t in tasks
        if t.status != TaskStatus.DONE.value
    ]
    missing_requirements = gate.unmapped_mandatory_requirements + gate.unsatisfied_mandatory_requirements
    # Deduplicate missing requirements by requirement_id
    dedup_missing_reqs: List[Dict[str, Any]] = []
    seen_req_ids = set()
    for item in missing_requirements:
        rid = item.get("requirement_id")
        if rid not in seen_req_ids:
            seen_req_ids.add(rid)
            dedup_missing_reqs.append(item)

    blocked_or_overdue = list(gate.blocked_or_review_mandatory_tasks)
    seen_bo_ids = {item.get("task_id") for item in blocked_or_overdue}
    for od in gate.overdue_tasks:
        if od.get("task_id") not in seen_bo_ids:
            blocked_or_overdue.append(od)

    # Step 5: Construct compact, structured assessment input for local Ollama
    compact_ai_input = {
        "project": {
            "name": project.name,
            "description": project.description[:1500],
            "objectives": project.objectives[:1500],
            "status": project.status,
        },
        "deterministic_metrics": {
            "progress_percentage": gate.progress_percentage,
            "readiness_status": gate.readiness_status.value,
            "eligible_for_completion": gate.eligible_for_completion,
            "blocking_reasons": gate.blocking_reasons,
        },
        "completed_work": completed_work,
        "remaining_tasks": remaining_tasks,
        "missing_requirements": dedup_missing_reqs,
        "blocked_or_overdue_tasks": blocked_or_overdue,
        "unverified_acceptance_criteria": gate.unverified_acceptance_criteria,
        "failed_verification_checks": gate.failed_verification_checks,
        "candidate_next_steps": [step.model_dump() for step in deterministic_next_steps],
    }

    valid_task_ids = {t.id for t in tasks}
    ai_used = False
    ai_error = None
    model_used = "deterministic-rule-engine"
    overall_summary = ""
    recommended_next_actions = deterministic_next_steps
    limitations: List[str] = [
        "Progress percentage reflects weighted task completion recorded in the database, not automated code quality verification."
    ]

    # Step 6 & 7: Send to local Ollama model and validate structured output
    try:
        ai_output, ollama_model_name = await ollama_service.generate_completion_assessment_commentary(
            assessment_input=compact_ai_input,
            valid_task_ids=valid_task_ids,
        )
        ai_used = True
        model_used = ollama_model_name
        overall_summary = ai_output.overall_summary
        if ai_output.recommended_next_actions:
            recommended_next_actions = ai_output.recommended_next_actions
        if ai_output.limitations_or_uncertainties:
            limitations.extend(ai_output.limitations_or_uncertainties)
    except OllamaServiceError as exc:
        ai_error = str(exc)
        if require_ai:
            if "unavailable" in ai_error.lower() or "timed out" in ai_error.lower():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=ai_error,
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=ai_error,
            )
        limitations.append(
            f"Local Ollama AI commentary was not used ({ai_error}). Report generated using deterministic backend completion rules."
        )
        if gate.eligible_for_completion:
            overall_summary = (
                f"Deterministic assessment: Project '{project.name}' is at {gate.progress_percentage}% weighted progress "
                f"and satisfies all {gate.mandatory_requirements_total} mandatory requirement(s), task dependencies, "
                "and evidence verification rules. It is Eligible for Completion."
            )
        else:
            reasons_text = " ".join(gate.blocking_reasons) if gate.blocking_reasons else "Work remains in progress."
            overall_summary = (
                f"Deterministic assessment: Project '{project.name}' is at {gate.progress_percentage}% weighted progress "
                f"({gate.completed_tasks}/{gate.total_tasks} tasks Done) with status '{gate.readiness_status.value}'. "
                f"Blocking findings: {reasons_text}"
            )

    findings = AssessmentReportFindings(
        overall_summary=overall_summary,
        recorded_progress_percentage=gate.progress_percentage,
        readiness_status=gate.readiness_status.value,
        eligible_for_completion=gate.eligible_for_completion,
        completed_work=completed_work,
        remaining_tasks=remaining_tasks,
        missing_requirements=dedup_missing_reqs,
        blocked_or_overdue_tasks=blocked_or_overdue,
        unverified_acceptance_criteria=gate.unverified_acceptance_criteria,
        failed_verification_checks=gate.failed_verification_checks,
        recommended_next_actions=recommended_next_actions,
        limitations_or_uncertainties=limitations,
        blocking_reasons=gate.blocking_reasons,
        ai_used=ai_used,
        ai_error=ai_error,
    )

    # Step 8: Store assessment snapshot and report
    assessment = Assessment(
        project_id=project.id,
        progress_snapshot=gate.progress_percentage,
        readiness_status=gate.readiness_status.value,
        ai_summary=overall_summary,
        findings_json=findings.model_dump_json(),
        state_snapshot_json=json.dumps(state_snapshot),
        model_name=model_used,
        invalidated_at=None,
    )
    db.add(assessment)
    db.flush()
    record_activity(
        db,
        project_id=project.id,
        action="assessment_created",
        details={
            "assessment_id": assessment.id,
            "progress_snapshot": gate.progress_percentage,
            "readiness_status": gate.readiness_status.value,
            "model_name": model_used,
            "ai_used": ai_used,
        },
    )
    db.commit()
    db.refresh(assessment)
    return serialize_assessment(assessment)


@router.get("/projects/{project_id}/assessments", response_model=List[AssessmentResponse])
def list_project_assessments(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    assessments = (
        db.query(Assessment)
        .filter(Assessment.project_id == project.id)
        .order_by(Assessment.created_at.desc())
        .all()
    )
    return [serialize_assessment(a) for a in assessments]


@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
def get_assessment_by_id(
    assessment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(db, assessment_id, current_user)
    return serialize_assessment(assessment)
