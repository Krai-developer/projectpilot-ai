from datetime import datetime, timedelta, timezone
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    ActivityLog,
    Assessment,
    EvidenceType,
    Milestone,
    MilestoneStatus,
    PriorityLevel,
    Project,
    ProjectStatus,
    Requirement,
    RequirementStatus,
    Task,
    TaskEvidence,
    TaskStatus,
    User,
    VerificationStatus,
    utcnow,
)
from app.schemas.schemas import (
    ActivityLogResponse,
    AssessmentReportFindings,
    AssessmentResponse,
    DashboardSummaryResponse,
    ProjectCompleteRequest,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.completion_service import (
    evaluate_project_completion_gate,
    generate_deterministic_next_steps,
    invalidate_assessments_and_sync_project_state,
    record_activity,
    validate_project_status_transition,
)

router = APIRouter(prefix="/api", tags=["Projects & Dashboard"])


def serialize_project(project: Project) -> ProjectResponse:
    gate = evaluate_project_completion_gate(project)
    tasks = list(project.tasks or [])
    blocked_count = sum(1 for t in tasks if t.status == TaskStatus.BLOCKED.value)
    return ProjectResponse(
        id=project.id,
        owner_id=project.owner_id,
        name=project.name,
        description=project.description,
        objectives=project.objectives,
        completion_criteria=project.completion_criteria,
        status=project.status,
        priority=project.priority,
        start_date=project.start_date,
        deadline=project.deadline,
        progress_percentage=gate.progress_percentage,
        readiness_status=gate.readiness_status.value,
        eligible_for_completion=gate.eligible_for_completion,
        total_tasks=gate.total_tasks,
        completed_tasks=gate.completed_tasks,
        blocked_tasks=blocked_count,
        overdue_tasks=len(gate.overdue_tasks),
        created_at=project.created_at,
        updated_at=project.updated_at,
        completed_at=project.completed_at,
    )


def serialize_assessment(assessment: Assessment) -> AssessmentResponse:
    try:
        findings_raw = json.loads(assessment.findings_json or "{}")
    except json.JSONDecodeError:
        findings_raw = {}
    try:
        snapshot_raw = json.loads(assessment.state_snapshot_json or "{}")
    except json.JSONDecodeError:
        snapshot_raw = {}

    findings = AssessmentReportFindings(
        overall_summary=findings_raw.get("overall_summary", assessment.ai_summary),
        recorded_progress_percentage=findings_raw.get("recorded_progress_percentage", assessment.progress_snapshot),
        readiness_status=findings_raw.get("readiness_status", assessment.readiness_status),
        eligible_for_completion=findings_raw.get("eligible_for_completion", False),
        completed_work=findings_raw.get("completed_work", []),
        remaining_tasks=findings_raw.get("remaining_tasks", []),
        missing_requirements=findings_raw.get("missing_requirements", []),
        blocked_or_overdue_tasks=findings_raw.get("blocked_or_overdue_tasks", []),
        unverified_acceptance_criteria=findings_raw.get("unverified_acceptance_criteria", []),
        failed_verification_checks=findings_raw.get("failed_verification_checks", []),
        recommended_next_actions=findings_raw.get("recommended_next_actions", []),
        limitations_or_uncertainties=findings_raw.get("limitations_or_uncertainties", []),
        blocking_reasons=findings_raw.get("blocking_reasons", []),
        ai_used=findings_raw.get("ai_used", False),
        ai_error=findings_raw.get("ai_error"),
    )

    return AssessmentResponse(
        id=assessment.id,
        project_id=assessment.project_id,
        progress_snapshot=assessment.progress_snapshot,
        readiness_status=assessment.readiness_status,
        ai_summary=assessment.ai_summary,
        findings=findings,
        state_snapshot=snapshot_raw,
        model_name=assessment.model_name,
        is_stale=assessment.invalidated_at is not None,
        created_at=assessment.created_at,
        invalidated_at=assessment.invalidated_at,
    )


def serialize_activity(log: ActivityLog) -> ActivityLogResponse:
    try:
        details = json.loads(log.details_json or "{}")
    except json.JSONDecodeError:
        details = {}
    return ActivityLogResponse(
        id=log.id,
        project_id=log.project_id,
        task_id=log.task_id,
        action=log.action,
        details=details,
        created_at=log.created_at,
    )


@router.get("/dashboard", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    today = datetime.now(timezone.utc).date()

    serialized_projects: List[ProjectResponse] = []
    projects_in_progress = 0
    projects_eligible = 0
    projects_with_blockers = 0
    overdue_tasks_count = 0
    upcoming_deadlines: List[Dict[str, Any]] = []

    for p in projects:
        proj_resp = serialize_project(p)
        serialized_projects.append(proj_resp)

        if p.status in {ProjectStatus.IN_PROGRESS.value, ProjectStatus.READY_FOR_REVIEW.value}:
            projects_in_progress += 1
        if proj_resp.eligible_for_completion and p.status != ProjectStatus.COMPLETED.value:
            projects_eligible += 1
        if p.status == ProjectStatus.BLOCKED.value or proj_resp.blocked_tasks > 0:
            projects_with_blockers += 1
        overdue_tasks_count += proj_resp.overdue_tasks

        if p.deadline and p.status not in {ProjectStatus.COMPLETED.value, ProjectStatus.ARCHIVED.value}:
            upcoming_deadlines.append(
                {
                    "type": "project",
                    "id": p.id,
                    "project_id": p.id,
                    "project_name": p.name,
                    "title": p.name,
                    "due_date": p.deadline.isoformat(),
                    "days_remaining": (p.deadline - today).days,
                    "status": p.status,
                }
            )
        for t in (p.tasks or []):
            if t.due_date and t.status != TaskStatus.DONE.value:
                upcoming_deadlines.append(
                    {
                        "type": "task",
                        "id": t.id,
                        "project_id": p.id,
                        "project_name": p.name,
                        "title": t.title,
                        "due_date": t.due_date.isoformat(),
                        "days_remaining": (t.due_date - today).days,
                        "status": t.status,
                    }
                )

    upcoming_deadlines.sort(key=lambda item: item["due_date"])

    project_ids = [p.id for p in projects]
    recent_logs: List[ActivityLogResponse] = []
    latest_assessments: List[AssessmentResponse] = []

    if project_ids:
        logs = (
            db.query(ActivityLog)
            .filter(ActivityLog.project_id.in_(project_ids))
            .order_by(ActivityLog.created_at.desc())
            .limit(15)
            .all()
        )
        recent_logs = [serialize_activity(l) for l in logs]

        assessments = (
            db.query(Assessment)
            .filter(Assessment.project_id.in_(project_ids))
            .order_by(Assessment.created_at.desc())
            .limit(8)
            .all()
        )
        latest_assessments = [serialize_assessment(a) for a in assessments]

    return DashboardSummaryResponse(
        total_projects=len(projects),
        projects_in_progress=projects_in_progress,
        projects_eligible_for_completion=projects_eligible,
        projects_with_blockers=projects_with_blockers,
        overdue_tasks_count=overdue_tasks_count,
        upcoming_deadlines=upcoming_deadlines[:10],
        projects=serialized_projects,
        recent_activity=recent_logs,
        latest_assessments=latest_assessments,
    )


@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    include_archived: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Project).filter(Project.owner_id == current_user.id)
    if status_filter:
        query = query.filter(Project.status == status_filter)
    elif not include_archived:
        query = query.filter(Project.status != ProjectStatus.ARCHIVED.value)

    projects = query.order_by(Project.updated_at.desc()).all()
    return [serialize_project(p) for p in projects]


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.start_date and payload.deadline and payload.deadline < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project deadline cannot be earlier than start date.",
        )

    project = Project(
        owner_id=current_user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        objectives=payload.objectives.strip(),
        completion_criteria=payload.completion_criteria.strip(),
        status=payload.status.value,
        priority=payload.priority.value,
        start_date=payload.start_date,
        deadline=payload.deadline,
    )
    db.add(project)
    db.flush()
    record_activity(
        db,
        project_id=project.id,
        action="project_created",
        details={"name": project.name, "status": project.status},
    )
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@router.post("/projects/demo", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_demo_project(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = datetime.now(timezone.utc).date()
    project = Project(
        owner_id=current_user.id,
        name="EdgeTelemetry Microservice v2",
        description=(
            "Production-grade local telemetry ingestion API with SQLite WAL persistence, "
            "cryptographic device authentication, and automated schema validation."
        ),
        objectives=(
            "1. Guarantee zero dropped telemetry payloads under 500 req/s local burst.\n"
            "2. Enforce strict Argon2id token validation on every ingestion endpoint.\n"
            "3. Provide verified integration test evidence before release sign-off."
        ),
        completion_criteria="All mandatory requirements satisfied, all required milestones completed, and test evidence verified.",
        status=ProjectStatus.IN_PROGRESS.value,
        priority=PriorityLevel.HIGH.value,
        start_date=today - timedelta(days=10),
        deadline=today + timedelta(days=14),
    )
    db.add(project)
    db.flush()

    req1 = Requirement(
        project_id=project.id,
        title="Authenticated Ingestion Endpoint",
        description="Reject unauthenticated or expired device tokens with HTTP 401.",
        is_mandatory=True,
        acceptance_criteria="Pytest security suite passes with 100% assertion coverage.",
        verification_notes="Verified via automated pytest run.",
        status=RequirementStatus.SATISFIED.value,
    )
    req2 = Requirement(
        project_id=project.id,
        title="Batch SQLite WAL Persistence",
        description="Persist telemetry batches atomically with retry-safe idempotency keys.",
        is_mandatory=True,
        acceptance_criteria="Zero duplicate records when batch request is replayed.",
        verification_notes="Implementation complete; awaiting final verification check.",
        status=RequirementStatus.IN_PROGRESS.value,
    )
    req3 = Requirement(
        project_id=project.id,
        title="Dead-Letter Queue Diagnostic Export",
        description="Provide JSON export endpoint for rejected malformed payloads.",
        is_mandatory=True,
        acceptance_criteria="Endpoint returns paginated malformed payload diagnostics.",
        status=RequirementStatus.UNMAPPED.value,
    )
    req4 = Requirement(
        project_id=project.id,
        title="Prometheus Metrics Exporter (Optional)",
        description="Optional /metrics endpoint for local Grafana scraping.",
        is_mandatory=False,
        acceptance_criteria="Exposes counter for ingested_events_total.",
        status=RequirementStatus.IN_PROGRESS.value,
    )
    db.add_all([req1, req2, req3, req4])
    db.flush()

    ms1 = Milestone(
        project_id=project.id,
        title="Phase 1: Core Security & Schema",
        description="Authentication middleware and payload schema validation.",
        due_date=today - timedelta(days=2),
        is_required=True,
        status=MilestoneStatus.COMPLETED.value,
    )
    ms2 = Milestone(
        project_id=project.id,
        title="Phase 2: Storage & Reliability Gate",
        description="WAL persistence, idempotency, and dead-letter handling.",
        due_date=today + timedelta(days=7),
        is_required=True,
        status=MilestoneStatus.IN_PROGRESS.value,
    )
    db.add_all([ms1, ms2])
    db.flush()

    t1 = Task(
        project_id=project.id,
        milestone_id=ms1.id,
        title="Implement Argon2id device token middleware",
        description="Validate bearer tokens and reject revoked device sessions.",
        status=TaskStatus.DONE.value,
        priority=PriorityLevel.CRITICAL.value,
        weight=3.0,
        estimated_hours=4.0,
        actual_hours=3.5,
        due_date=today - timedelta(days=4),
        notes="Completed and verified with unit tests.",
        completed_at=utcnow(),
    )
    t1.requirements = [req1]

    t2 = Task(
        project_id=project.id,
        milestone_id=ms2.id,
        title="Build atomic SQLite batch writer with idempotency key",
        description="Use transaction batching and unique batch_id constraint.",
        status=TaskStatus.IN_PROGRESS.value,
        priority=PriorityLevel.HIGH.value,
        weight=4.0,
        estimated_hours=6.0,
        actual_hours=3.0,
        due_date=today + timedelta(days=3),
        notes="Core writer ready; adding replay integration test.",
    )
    t2.requirements = [req2]
    t2.dependencies = [t1]

    t3 = Task(
        project_id=project.id,
        milestone_id=ms2.id,
        title="Stress test concurrent WAL writes under lock contention",
        description="Simulate 20 concurrent workers writing 1,000 events.",
        status=TaskStatus.BLOCKED.value,
        priority=PriorityLevel.HIGH.value,
        weight=3.0,
        estimated_hours=5.0,
        actual_hours=1.0,
        due_date=today - timedelta(days=1),
        notes="Blocked until atomic batch writer task (t2) is Done.",
    )
    t3.requirements = [req2]
    t3.dependencies = [t2]

    t4 = Task(
        project_id=project.id,
        milestone_id=None,
        title="Add optional Prometheus counter endpoint",
        description="Expose /metrics in plain text format.",
        status=TaskStatus.TO_DO.value,
        priority=PriorityLevel.LOW.value,
        weight=1.0,
        estimated_hours=2.0,
        actual_hours=0.0,
        due_date=today + timedelta(days=12),
    )
    t4.requirements = [req4]

    db.add_all([t1, t2, t3, t4])
    db.flush()

    ev1 = TaskEvidence(
        task_id=t1.id,
        evidence_type=EvidenceType.TEST_RESULT.value,
        description="pytest tests/test_device_auth.py — 12 passed in 0.48s",
        uri="repo://tests/test_device_auth.py",
        verification_status=VerificationStatus.VERIFIED.value,
        verified_at=utcnow(),
    )
    ev2 = TaskEvidence(
        task_id=t2.id,
        evidence_type=EvidenceType.REPOSITORY_LINK.value,
        description="Draft PR #14: Batch writer implementation",
        uri="https://git.example.local/telemetry/pull/14",
        verification_status=VerificationStatus.PENDING.value,
    )
    db.add_all([ev1, ev2])
    db.flush()

    db.refresh(project)
    invalidate_assessments_and_sync_project_state(db, project, reason="Demo project initialized")
    record_activity(
        db,
        project_id=project.id,
        action="demo_project_created",
        details={"name": project.name},
    )
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    return serialize_project(project)


@router.get("/projects/{project_id}/gate")
def get_project_completion_gate(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    gate = evaluate_project_completion_gate(project)
    next_steps = generate_deterministic_next_steps(project, gate)
    return {
        "gate": gate,
        "recommended_next_steps": next_steps,
    }


@router.get("/projects/{project_id}/activity", response_model=List[ActivityLogResponse])
def get_project_activity(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.project_id == project.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(50)
        .all()
    )
    return [serialize_activity(l) for l in logs]


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)

    if payload.status is not None:
        target_status = payload.status.value
        validate_project_status_transition(project.status, target_status)
        if target_status == ProjectStatus.COMPLETED.value and project.status != ProjectStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot mark project Completed directly via status patch. "
                    "Use POST /api/projects/{project_id}/complete with explicit confirmation "
                    "after satisfying all completion gate criteria."
                ),
            )
        if target_status != ProjectStatus.COMPLETED.value:
            project.completed_at = None
        project.status = target_status

    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description.strip()
    if payload.objectives is not None:
        project.objectives = payload.objectives.strip()
    if payload.completion_criteria is not None:
        project.completion_criteria = payload.completion_criteria.strip()
    if payload.priority is not None:
        project.priority = payload.priority.value
    if "start_date" in payload.model_fields_set:
        project.start_date = payload.start_date
    if "deadline" in payload.model_fields_set:
        project.deadline = payload.deadline

    if project.start_date and project.deadline and project.deadline < project.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project deadline cannot be earlier than start date.",
        )

    record_activity(
        db,
        project_id=project.id,
        action="project_updated",
        details={"name": project.name, "status": project.status},
    )
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    db.delete(project)
    db.commit()
    return None


@router.post("/projects/{project_id}/complete", response_model=ProjectResponse)
def complete_project(
    project_id: int,
    payload: ProjectCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)

    if not payload.confirm_completion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit confirmation (confirm_completion=true) is required to mark a project Completed.",
        )

    validate_project_status_transition(project.status, ProjectStatus.COMPLETED.value)
    gate = evaluate_project_completion_gate(project)

    if not gate.eligible_for_completion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Project does not satisfy all mandatory completion gate criteria.",
                "readiness_status": gate.readiness_status.value,
                "blocking_reasons": gate.blocking_reasons,
            },
        )

    project.status = ProjectStatus.COMPLETED.value
    project.completed_at = utcnow()
    record_activity(
        db,
        project_id=project.id,
        action="project_completed",
        details={
            "progress_percentage": gate.progress_percentage,
            "completion_notes": payload.completion_notes,
        },
    )
    db.commit()
    db.refresh(project)
    return serialize_project(project)
