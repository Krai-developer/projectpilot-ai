from datetime import date, datetime, timezone
import json
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import (
    ActivityLog,
    Assessment,
    Milestone,
    MilestoneStatus,
    PriorityLevel,
    Project,
    ProjectStatus,
    ReadinessStatus,
    Requirement,
    RequirementStatus,
    Task,
    TaskStatus,
    VerificationStatus,
    utcnow,
)
from app.schemas.schemas import CompletionGateResult, NextStepRecommendation


VALID_PROJECT_TRANSITIONS: Dict[str, Set[str]] = {
    ProjectStatus.PLANNING.value: {
        ProjectStatus.PLANNING.value,
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.BLOCKED.value,
        ProjectStatus.ARCHIVED.value,
    },
    ProjectStatus.IN_PROGRESS.value: {
        ProjectStatus.PLANNING.value,
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.BLOCKED.value,
        ProjectStatus.READY_FOR_REVIEW.value,
        ProjectStatus.COMPLETED.value,
        ProjectStatus.ARCHIVED.value,
    },
    ProjectStatus.BLOCKED.value: {
        ProjectStatus.PLANNING.value,
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.BLOCKED.value,
        ProjectStatus.ARCHIVED.value,
    },
    ProjectStatus.READY_FOR_REVIEW.value: {
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.BLOCKED.value,
        ProjectStatus.READY_FOR_REVIEW.value,
        ProjectStatus.COMPLETED.value,
        ProjectStatus.ARCHIVED.value,
    },
    ProjectStatus.COMPLETED.value: {
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.READY_FOR_REVIEW.value,
        ProjectStatus.COMPLETED.value,
        ProjectStatus.ARCHIVED.value,
    },
    ProjectStatus.ARCHIVED.value: {
        ProjectStatus.PLANNING.value,
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.ARCHIVED.value,
    },
}

PRIORITY_RANK: Dict[str, int] = {
    PriorityLevel.CRITICAL.value: 4,
    PriorityLevel.HIGH.value: 3,
    PriorityLevel.MEDIUM.value: 2,
    PriorityLevel.LOW.value: 1,
}


def validate_project_status_transition(current_status: str, target_status: str) -> None:
    allowed = VALID_PROJECT_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project status transition from '{current_status}' to '{target_status}'.",
        )


def calculate_weighted_progress(tasks: List[Task], project_id: Optional[int] = None) -> Tuple[float, float, float]:
    """
    Calculate weighted progress deterministically:
    progress = 100 * completed_task_weight / total_task_weight

    Handles empty task lists safely without division by zero.
    Validates that all weights are positive and tasks belong to the project.
    """
    if not tasks:
        return 0.0, 0.0, 0.0

    total_weight = 0.0
    completed_weight = 0.0

    for t in tasks:
        if project_id is not None and t.project_id != project_id:
            raise ValueError(f"Task {t.id} does not belong to project {project_id}")
        if t.weight is None or t.weight <= 0:
            raise ValueError(f"Task '{t.title}' has non-positive weight ({t.weight}). All task weights must be > 0.")
        if t.status not in {s.value for s in TaskStatus}:
            raise ValueError(f"Task '{t.title}' has invalid status '{t.status}'.")

        total_weight += float(t.weight)
        if t.status == TaskStatus.DONE.value:
            completed_weight += float(t.weight)

    if total_weight <= 0.0:
        return 0.0, 0.0, 0.0

    progress = round((100.0 * completed_weight) / total_weight, 2)
    return progress, round(completed_weight, 2), round(total_weight, 2)


def validate_no_dependency_cycle(
    project_tasks: List[Task],
    source_task_id: Optional[int],
    proposed_dependency_ids: List[int],
) -> None:
    """
    Validate that proposed_dependency_ids belong to the same project,
    contain no self-dependency, and introduce no circular dependencies.
    """
    task_map = {t.id: t for t in project_tasks}
    for dep_id in proposed_dependency_ids:
        if dep_id not in task_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dependency task ID {dep_id} does not exist in this project.",
            )
        if source_task_id is not None and dep_id == source_task_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A task cannot depend on itself.",
            )

    if source_task_id is None:
        return

    adj: Dict[int, Set[int]] = {
        t.id: {d.id for d in t.dependencies} for t in project_tasks
    }
    adj[source_task_id] = set(proposed_dependency_ids)

    visited: Set[int] = set()
    rec_stack: Set[int] = set()

    def dfs(node: int) -> bool:
        visited.add(node)
        rec_stack.add(node)
        for neighbor in adj.get(node, set()):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        rec_stack.remove(node)
        return False

    for node_id in adj:
        if node_id not in visited:
            if dfs(node_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Circular task dependency detected. Dependencies must form a directed acyclic graph.",
                )


def compute_milestone_status_and_progress(milestone: Milestone) -> Tuple[str, float, int, int]:
    """
    Compute milestone status based on linked task progress and blockers.
    Never automatically marks a milestone Completed merely because its due date has passed.
    """
    linked_tasks = milestone.tasks or []
    total_tasks = len(linked_tasks)
    if total_tasks == 0:
        return MilestoneStatus.PENDING.value, 0.0, 0, 0

    completed_tasks = sum(1 for t in linked_tasks if t.status == TaskStatus.DONE.value)
    blocked_tasks = sum(1 for t in linked_tasks if t.status == TaskStatus.BLOCKED.value)
    in_progress_tasks = sum(
        1 for t in linked_tasks if t.status in {TaskStatus.IN_PROGRESS.value, TaskStatus.IN_REVIEW.value}
    )
    progress, _, _ = calculate_weighted_progress(linked_tasks, milestone.project_id)

    if blocked_tasks > 0:
        computed_status = MilestoneStatus.BLOCKED.value
    elif completed_tasks == total_tasks:
        computed_status = MilestoneStatus.COMPLETED.value
    elif completed_tasks > 0 or in_progress_tasks > 0:
        computed_status = MilestoneStatus.IN_PROGRESS.value
    else:
        computed_status = MilestoneStatus.PENDING.value

    return computed_status, progress, total_tasks, completed_tasks


def is_task_mandatory(task: Task) -> bool:
    """
    Determine whether a task is required for completion eligibility.
    A task is mandatory if:
    - It is linked to at least one mandatory requirement, OR
    - It belongs to a required milestone, OR
    - The project has no requirements defined yet (in which case all tasks are treated as required).
    """
    if any(r.is_mandatory for r in (task.requirements or [])):
        return True
    if task.milestone is not None and task.milestone.is_required:
        return True
    if task.project and len(task.project.requirements or []) == 0:
        return True
    return False


def evaluate_project_completion_gate(project: Project, reference_date: Optional[date] = None) -> CompletionGateResult:
    """
    Deterministic backend evaluation of project progress and completion eligibility.
    Never uses AI to determine progress or completion gate eligibility.
    """
    today = reference_date or datetime.now(timezone.utc).date()
    tasks = list(project.tasks or [])
    requirements = list(project.requirements or [])
    milestones = list(project.milestones or [])

    progress_pct, completed_weight, total_weight = calculate_weighted_progress(tasks, project.id)
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.DONE.value)

    mandatory_reqs = [r for r in requirements if r.is_mandatory]
    unmapped_mandatory_reqs: List[Dict[str, Any]] = []
    unsatisfied_mandatory_reqs: List[Dict[str, Any]] = []
    unverified_acceptance_criteria: List[Dict[str, Any]] = []
    failed_verification_checks: List[Dict[str, Any]] = []
    mandatory_reqs_satisfied_count = 0

    for req in mandatory_reqs:
        linked_tasks = list(req.tasks or [])
        if not linked_tasks:
            unmapped_mandatory_reqs.append(
                {
                    "requirement_id": req.id,
                    "title": req.title,
                    "reason": "Mandatory requirement is not mapped to any tasks.",
                }
            )
            unsatisfied_mandatory_reqs.append(
                {
                    "requirement_id": req.id,
                    "title": req.title,
                    "status": req.status,
                    "reason": "Unmapped to tasks",
                }
            )
            continue

        if req.status == RequirementStatus.FAILED.value:
            failed_verification_checks.append(
                {
                    "type": "requirement",
                    "id": req.id,
                    "title": req.title,
                    "reason": "Mandatory requirement is marked as Failed.",
                }
            )

        all_linked_done = all(t.status == TaskStatus.DONE.value for t in linked_tasks)

        # Check evidence across linked tasks: description/link alone is NEVER proof; verification_status must be 'verified'
        has_verified_evidence = False
        has_failed_evidence = False
        for t in linked_tasks:
            for ev in (t.evidence_items or []):
                if ev.verification_status == VerificationStatus.VERIFIED.value:
                    has_verified_evidence = True
                elif ev.verification_status == VerificationStatus.FAILED.value:
                    has_failed_evidence = True

        if not all_linked_done:
            unsatisfied_mandatory_reqs.append(
                {
                    "requirement_id": req.id,
                    "title": req.title,
                    "status": req.status,
                    "reason": "One or more linked tasks are not Done.",
                }
            )
        elif has_failed_evidence or req.status == RequirementStatus.FAILED.value:
            unsatisfied_mandatory_reqs.append(
                {
                    "requirement_id": req.id,
                    "title": req.title,
                    "status": req.status,
                    "reason": "Verification check or evidence failed.",
                }
            )
        elif not has_verified_evidence or req.status != RequirementStatus.SATISFIED.value:
            unverified_acceptance_criteria.append(
                {
                    "requirement_id": req.id,
                    "title": req.title,
                    "acceptance_criteria": req.acceptance_criteria,
                    "reason": (
                        "Requirement tasks are Done, but verified task evidence and/or "
                        "explicit 'Satisfied' requirement verification is missing."
                    ),
                }
            )
            unsatisfied_mandatory_reqs.append(
                {
                    "requirement_id": req.id,
                    "title": req.title,
                    "status": req.status,
                    "reason": "Awaiting verified evidence and Satisfied status.",
                }
            )
        else:
            mandatory_reqs_satisfied_count += 1

    incomplete_required_tasks: List[Dict[str, Any]] = []
    blocked_or_review_mandatory_tasks: List[Dict[str, Any]] = []
    overdue_tasks: List[Dict[str, Any]] = []
    unsatisfied_dependencies: List[Dict[str, Any]] = []

    for t in tasks:
        mandatory = is_task_mandatory(t)
        if t.due_date and t.due_date < today and t.status != TaskStatus.DONE.value:
            overdue_tasks.append(
                {
                    "task_id": t.id,
                    "title": t.title,
                    "due_date": t.due_date.isoformat(),
                    "status": t.status,
                    "is_mandatory": mandatory,
                }
            )

        incomplete_deps = [d for d in (t.dependencies or []) if d.status != TaskStatus.DONE.value]
        if incomplete_deps and (mandatory or t.status == TaskStatus.DONE.value):
            unsatisfied_dependencies.append(
                {
                    "task_id": t.id,
                    "title": t.title,
                    "incomplete_dependency_ids": [d.id for d in incomplete_deps],
                    "incomplete_dependency_titles": [d.title for d in incomplete_deps],
                }
            )

        for ev in (t.evidence_items or []):
            if ev.verification_status == VerificationStatus.FAILED.value and mandatory:
                failed_verification_checks.append(
                    {
                        "type": "task_evidence",
                        "id": ev.id,
                        "task_id": t.id,
                        "title": t.title,
                        "reason": f"Evidence '{ev.description}' has verification_status='failed'.",
                    }
                )

        if mandatory:
            if t.status in {TaskStatus.BLOCKED.value, TaskStatus.IN_REVIEW.value}:
                blocked_or_review_mandatory_tasks.append(
                    {
                        "task_id": t.id,
                        "title": t.title,
                        "status": t.status,
                        "reason": f"Mandatory task is currently '{t.status}'.",
                    }
                )
            if t.status != TaskStatus.DONE.value:
                incomplete_required_tasks.append(
                    {
                        "task_id": t.id,
                        "title": t.title,
                        "status": t.status,
                        "priority": t.priority,
                    }
                )
            else:
                verified_evs = [
                    ev for ev in (t.evidence_items or [])
                    if ev.verification_status == VerificationStatus.VERIFIED.value
                ]
                if not verified_evs:
                    unverified_acceptance_criteria.append(
                        {
                            "task_id": t.id,
                            "title": t.title,
                            "reason": "Mandatory task is marked Done but has no verified evidence.",
                        }
                    )

    unsatisfied_milestones: List[Dict[str, Any]] = []
    for m in milestones:
        computed_status, _, m_total, m_done = compute_milestone_status_and_progress(m)
        if m.is_required:
            if m_total == 0 or computed_status != MilestoneStatus.COMPLETED.value:
                unsatisfied_milestones.append(
                    {
                        "milestone_id": m.id,
                        "title": m.title,
                        "status": computed_status,
                        "completed_tasks": m_done,
                        "total_tasks": m_total,
                        "reason": (
                            "Required milestone has no linked tasks."
                            if m_total == 0
                            else "Required milestone has incomplete tasks."
                        ),
                    }
                )

    blocking_reasons: List[str] = []
    if total_tasks == 0:
        blocking_reasons.append("Project has no tasks recorded.")
    if len(mandatory_reqs) == 0:
        blocking_reasons.append("Project has no mandatory requirements defined.")
    if unmapped_mandatory_reqs:
        blocking_reasons.append(f"{len(unmapped_mandatory_reqs)} mandatory requirement(s) are not mapped to any tasks.")
    if incomplete_required_tasks:
        blocking_reasons.append(f"{len(incomplete_required_tasks)} required task(s) are not Done.")
    if blocked_or_review_mandatory_tasks:
        blocking_reasons.append(
            f"{len(blocked_or_review_mandatory_tasks)} mandatory task(s) are Blocked or awaiting review."
        )
    if unsatisfied_dependencies:
        blocking_reasons.append(f"{len(unsatisfied_dependencies)} task dependency prerequisite(s) remain incomplete.")
    if unsatisfied_milestones:
        blocking_reasons.append(f"{len(unsatisfied_milestones)} required milestone(s) are not yet completed.")
    if failed_verification_checks:
        blocking_reasons.append(f"{len(failed_verification_checks)} verification check(s) failed.")
    if unverified_acceptance_criteria:
        blocking_reasons.append(
            f"{len(unverified_acceptance_criteria)} mandatory item(s) lack verified evidence or satisfied acceptance criteria."
        )

    eligible = len(blocking_reasons) == 0

    if project.status == ProjectStatus.COMPLETED.value and eligible:
        readiness = ReadinessStatus.COMPLETED
    elif eligible:
        readiness = ReadinessStatus.ELIGIBLE_FOR_COMPLETION
    elif failed_verification_checks or blocked_or_review_mandatory_tasks or unmapped_mandatory_reqs or total_tasks == 0 or len(mandatory_reqs) == 0:
        readiness = ReadinessStatus.NOT_READY
    elif (
        len(incomplete_required_tasks) == 0
        and len(unsatisfied_dependencies) == 0
        and len(unsatisfied_milestones) == 0
        and len(unverified_acceptance_criteria) > 0
    ):
        readiness = ReadinessStatus.NEEDS_VERIFICATION
    else:
        readiness = ReadinessStatus.IN_PROGRESS

    return CompletionGateResult(
        progress_percentage=progress_pct,
        completed_task_weight=completed_weight,
        total_task_weight=total_weight,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        readiness_status=readiness,
        eligible_for_completion=eligible,
        mandatory_requirements_total=len(mandatory_reqs),
        mandatory_requirements_satisfied=mandatory_reqs_satisfied_count,
        unmapped_mandatory_requirements=unmapped_mandatory_reqs,
        unsatisfied_mandatory_requirements=unsatisfied_mandatory_reqs,
        incomplete_required_tasks=incomplete_required_tasks,
        blocked_or_review_mandatory_tasks=blocked_or_review_mandatory_tasks,
        overdue_tasks=overdue_tasks,
        unverified_acceptance_criteria=unverified_acceptance_criteria,
        failed_verification_checks=failed_verification_checks,
        unsatisfied_milestones=unsatisfied_milestones,
        unsatisfied_dependencies=unsatisfied_dependencies,
        blocking_reasons=blocking_reasons,
    )


def generate_deterministic_next_steps(project: Project, gate: CompletionGateResult) -> List[NextStepRecommendation]:
    """
    Recommend up to 3 concrete, actionable next steps based on:
    1. Unmapped mandatory requirements or failed verification checks
    2. Blocked tasks or overdue mandatory tasks with satisfied prerequisites
    3. Highest-priority actionable incomplete tasks (dependencies satisfied)
    4. Unverified acceptance criteria / pending evidence verification
    """
    recommendations: List[NextStepRecommendation] = []

    for unmapped in gate.unmapped_mandatory_requirements:
        if len(recommendations) >= 3:
            break
        recommendations.append(
            NextStepRecommendation(
                task_id=None,
                title=f"Map tasks to mandatory requirement: {unmapped['title']}",
                priority=PriorityLevel.CRITICAL.value,
                why_it_matters="Mandatory requirement has no linked tasks and blocks completion eligibility.",
                action_type="requirement_mapping",
            )
        )

    for failed in gate.failed_verification_checks:
        if len(recommendations) >= 3:
            break
        recommendations.append(
            NextStepRecommendation(
                task_id=failed.get("task_id"),
                title=f"Resolve failed verification: {failed['title']}",
                priority=PriorityLevel.CRITICAL.value,
                why_it_matters=failed["reason"],
                action_type="verification_fix",
            )
        )

    tasks = list(project.tasks or [])
    incomplete_tasks = [t for t in tasks if t.status != TaskStatus.DONE.value]

    def task_sort_key(t: Task):
        mandatory = 1 if is_task_mandatory(t) else 0
        deps_ready = 1 if all(d.status == TaskStatus.DONE.value for d in (t.dependencies or [])) else 0
        is_blocked = 1 if t.status == TaskStatus.BLOCKED.value else 0
        prio = PRIORITY_RANK.get(t.priority, 2)
        due_ord = t.due_date.toordinal() if t.due_date else 9999999
        remaining_effort = max(0.0, float(t.estimated_hours or 0.0) - float(t.actual_hours or 0.0))
        return (-mandatory, -deps_ready, -is_blocked, -prio, due_ord, remaining_effort)

    for t in sorted(incomplete_tasks, key=task_sort_key):
        if len(recommendations) >= 3:
            break
        mandatory = is_task_mandatory(t)
        incomplete_deps = [d.title for d in (t.dependencies or []) if d.status != TaskStatus.DONE.value]
        reasons = []
        if mandatory:
            reasons.append("linked to mandatory project completion criteria")
        if t.status == TaskStatus.BLOCKED.value:
            reasons.append("currently Blocked and requires unblocking")
        if incomplete_deps:
            reasons.append(f"waiting on prerequisite(s): {', '.join(incomplete_deps)}")
        else:
            reasons.append("all task prerequisites are satisfied")
        if t.due_date:
            reasons.append(f"due on {t.due_date.isoformat()}")

        recommendations.append(
            NextStepRecommendation(
                task_id=t.id,
                title=t.title,
                priority=t.priority,
                why_it_matters=f"Priority {t.priority} task ({t.status}) — " + "; ".join(reasons) + ".",
                action_type="task_execution",
            )
        )

    for unverified in gate.unverified_acceptance_criteria:
        if len(recommendations) >= 3:
            break
        recommendations.append(
            NextStepRecommendation(
                task_id=unverified.get("task_id"),
                title=f"Verify evidence & acceptance criteria for: {unverified['title']}",
                priority=PriorityLevel.HIGH.value,
                why_it_matters=unverified["reason"],
                action_type="verification",
            )
        )

    return recommendations[:3]


def build_project_state_snapshot(project: Project, gate: CompletionGateResult) -> Dict[str, Any]:
    return {
        "project_id": project.id,
        "project_status": project.status,
        "progress_percentage": gate.progress_percentage,
        "readiness_status": gate.readiness_status.value,
        "eligible_for_completion": gate.eligible_for_completion,
        "requirements": [
            {
                "id": r.id,
                "title": r.title,
                "is_mandatory": r.is_mandatory,
                "status": r.status,
                "linked_task_ids": sorted(t.id for t in (r.tasks or [])),
            }
            for r in sorted(project.requirements or [], key=lambda x: x.id)
        ],
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "weight": t.weight,
                "dependency_ids": sorted(d.id for d in (t.dependencies or [])),
                "verified_evidence_count": sum(
                    1 for ev in (t.evidence_items or [])
                    if ev.verification_status == VerificationStatus.VERIFIED.value
                ),
            }
            for t in sorted(project.tasks or [], key=lambda x: x.id)
        ],
        "milestones": [
            {
                "id": m.id,
                "title": m.title,
                "is_required": m.is_required,
                "status": compute_milestone_status_and_progress(m)[0],
            }
            for m in sorted(project.milestones or [], key=lambda x: x.id)
        ],
    }


def record_activity(
    db: Session,
    project_id: int,
    action: str,
    details: Optional[Dict[str, Any]] = None,
    task_id: Optional[int] = None,
) -> ActivityLog:
    log_entry = ActivityLog(
        project_id=project_id,
        task_id=task_id,
        action=action,
        details_json=json.dumps(details or {}),
    )
    db.add(log_entry)
    return log_entry


def invalidate_assessments_and_sync_project_state(
    db: Session,
    project: Project,
    reason: str,
) -> None:
    """
    Mark active assessments on the project as stale (invalidated_at = utcnow()).
    Also sync milestone statuses and, if the project was marked 'Completed'
    but is no longer eligible for completion, automatically revert it to 'In Progress'
    and require reassessment.
    """
    now = utcnow()
    for assessment in (project.assessments or []):
        if assessment.invalidated_at is None:
            assessment.invalidated_at = now

    for m in (project.milestones or []):
        computed_status, _, _, _ = compute_milestone_status_and_progress(m)
        m.status = computed_status

    gate = evaluate_project_completion_gate(project)
    if project.status == ProjectStatus.COMPLETED.value and not gate.eligible_for_completion:
        project.status = ProjectStatus.IN_PROGRESS.value
        project.completed_at = None
        record_activity(
            db,
            project_id=project.id,
            action="completion_invalidated",
            details={
                "reason": reason,
                "blocking_reasons": gate.blocking_reasons,
            },
        )
