from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_owned_evidence,
    get_owned_project,
    get_owned_task,
)
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    Milestone,
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
    EvidenceCreate,
    EvidenceResponse,
    EvidenceUpdate,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from app.services.completion_service import (
    invalidate_assessments_and_sync_project_state,
    record_activity,
    validate_no_dependency_cycle,
)

router = APIRouter(prefix="/api", tags=["Tasks & Evidence"])


def serialize_task(task: Task) -> TaskResponse:
    deps = list(task.dependencies or [])
    incomplete_prereq_ids = [d.id for d in deps if d.status != TaskStatus.DONE.value]
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        milestone_id=task.milestone_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        weight=task.weight,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours,
        due_date=task.due_date,
        notes=task.notes,
        requirement_ids=[r.id for r in (task.requirements or [])],
        dependency_ids=[d.id for d in deps],
        incomplete_prerequisite_ids=incomplete_prereq_ids,
        evidence_items=[EvidenceResponse.model_validate(ev) for ev in (task.evidence_items or [])],
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _sync_requirement_statuses(project_requirements: List[Requirement]) -> None:
    """
    Keep requirement status synchronized when tasks are mapped/unmapped,
    without auto-marking a requirement Satisfied unless already verified.
    """
    for req in project_requirements:
        linked = list(req.tasks or [])
        if not linked and req.status != RequirementStatus.FAILED.value:
            req.status = RequirementStatus.UNMAPPED.value
        elif linked and req.status == RequirementStatus.UNMAPPED.value:
            req.status = RequirementStatus.IN_PROGRESS.value


@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
def list_tasks(
    project_id: int,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    milestone_id: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    tasks = list(project.tasks or [])

    if status_filter:
        tasks = [t for t in tasks if t.status == status_filter]
    if priority:
        tasks = [t for t in tasks if t.priority == priority]
    if milestone_id is not None:
        tasks = [t for t in tasks if t.milestone_id == milestone_id]
    if search:
        q = search.strip().lower()
        tasks = [t for t in tasks if q in t.title.lower() or q in t.description.lower()]

    return [serialize_task(t) for t in tasks]


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    project_id: int,
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)

    if payload.milestone_id is not None:
        milestone = (
            db.query(Milestone)
            .filter(Milestone.id == payload.milestone_id, Milestone.project_id == project.id)
            .first()
        )
        if not milestone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specified milestone does not belong to this project.",
            )

    linked_requirements: List[Requirement] = []
    if payload.requirement_ids:
        linked_requirements = (
            db.query(Requirement)
            .filter(
                Requirement.id.in_(payload.requirement_ids),
                Requirement.project_id == project.id,
            )
            .all()
        )
        if len(linked_requirements) != len(set(payload.requirement_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more requirement_ids do not belong to this project.",
            )

    project_tasks = list(project.tasks or [])
    validate_no_dependency_cycle(project_tasks, None, payload.dependency_ids)
    dep_tasks = [t for t in project_tasks if t.id in set(payload.dependency_ids)]

    if payload.status == TaskStatus.DONE:
        incomplete_deps = [d.title for d in dep_tasks if d.status != TaskStatus.DONE.value]
        if incomplete_deps:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot mark task as Done while prerequisite task(s) are incomplete: {', '.join(incomplete_deps)}",
            )

    task = Task(
        project_id=project.id,
        milestone_id=payload.milestone_id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        status=payload.status.value,
        priority=payload.priority.value,
        weight=payload.weight,
        estimated_hours=payload.estimated_hours,
        actual_hours=payload.actual_hours,
        due_date=payload.due_date,
        notes=payload.notes.strip(),
        completed_at=utcnow() if payload.status == TaskStatus.DONE else None,
    )
    task.requirements = linked_requirements
    task.dependencies = dep_tasks

    db.add(task)
    db.flush()
    db.refresh(project)
    _sync_requirement_statuses(project.requirements)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Task '{task.title}' created"
    )
    record_activity(
        db,
        project_id=project.id,
        task_id=task.id,
        action="task_created",
        details={"title": task.title, "status": task.status, "weight": task.weight},
    )
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = get_owned_task(db, task_id, current_user)
    project = task.project

    if "milestone_id" in payload.model_fields_set:
        if payload.milestone_id is not None:
            milestone = (
                db.query(Milestone)
                .filter(Milestone.id == payload.milestone_id, Milestone.project_id == project.id)
                .first()
            )
            if not milestone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified milestone does not belong to this project.",
                )
        task.milestone_id = payload.milestone_id

    if payload.requirement_ids is not None:
        linked_requirements = (
            db.query(Requirement)
            .filter(
                Requirement.id.in_(payload.requirement_ids),
                Requirement.project_id == project.id,
            )
            .all()
        )
        if len(linked_requirements) != len(set(payload.requirement_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more requirement_ids do not belong to this project.",
            )
        task.requirements = linked_requirements

    if payload.dependency_ids is not None:
        project_tasks = list(project.tasks or [])
        validate_no_dependency_cycle(project_tasks, task.id, payload.dependency_ids)
        task.dependencies = [t for t in project_tasks if t.id in set(payload.dependency_ids)]

    target_status = payload.status.value if payload.status is not None else task.status
    if target_status == TaskStatus.DONE.value:
        incomplete_deps = [d.title for d in (task.dependencies or []) if d.status != TaskStatus.DONE.value]
        if incomplete_deps:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot mark task as Done while prerequisite task(s) are incomplete: {', '.join(incomplete_deps)}",
            )
        if task.status != TaskStatus.DONE.value:
            task.completed_at = utcnow()
    else:
        task.completed_at = None

    task.status = target_status

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip()
    if payload.priority is not None:
        task.priority = payload.priority.value
    if payload.weight is not None:
        task.weight = payload.weight
    if payload.estimated_hours is not None:
        task.estimated_hours = payload.estimated_hours
    if payload.actual_hours is not None:
        task.actual_hours = payload.actual_hours
    if "due_date" in payload.model_fields_set:
        task.due_date = payload.due_date
    if payload.notes is not None:
        task.notes = payload.notes.strip()

    db.flush()
    db.refresh(project)
    _sync_requirement_statuses(project.requirements)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Task '{task.title}' updated to status '{task.status}'"
    )
    record_activity(
        db,
        project_id=project.id,
        task_id=task.id,
        action="task_updated",
        details={"title": task.title, "status": task.status, "weight": task.weight},
    )
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = get_owned_task(db, task_id, current_user)
    project = task.project
    title = task.title
    db.delete(task)
    db.flush()
    db.refresh(project)
    _sync_requirement_statuses(project.requirements)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Task '{title}' deleted"
    )
    record_activity(
        db,
        project_id=project.id,
        action="task_deleted",
        details={"title": title},
    )
    db.commit()
    return None


# --- Evidence Management Endpoints ---

@router.get("/projects/{project_id}/evidence", response_model=List[EvidenceResponse])
def list_project_evidence(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    items: List[EvidenceResponse] = []
    for t in (project.tasks or []):
        for ev in (t.evidence_items or []):
            items.append(EvidenceResponse.model_validate(ev))
    return items


@router.post(
    "/tasks/{task_id}/evidence",
    response_model=EvidenceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task_evidence(
    task_id: int,
    payload: EvidenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = get_owned_task(db, task_id, current_user)
    project = task.project

    ev = TaskEvidence(
        task_id=task.id,
        evidence_type=payload.evidence_type.value,
        description=payload.description.strip(),
        uri=payload.uri.strip(),
        verification_status=payload.verification_status.value,
        verified_at=(
            utcnow() if payload.verification_status == VerificationStatus.VERIFIED else None
        ),
    )
    db.add(ev)
    db.flush()
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Evidence added to task '{task.title}'"
    )
    record_activity(
        db,
        project_id=project.id,
        task_id=task.id,
        action="evidence_recorded",
        details={
            "evidence_type": ev.evidence_type,
            "verification_status": ev.verification_status,
        },
    )
    db.commit()
    db.refresh(ev)
    return EvidenceResponse.model_validate(ev)


@router.patch("/evidence/{evidence_id}", response_model=EvidenceResponse)
def update_task_evidence(
    evidence_id: int,
    payload: EvidenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = get_owned_evidence(db, evidence_id, current_user)
    task = ev.task
    project = task.project

    if payload.evidence_type is not None:
        ev.evidence_type = payload.evidence_type.value
    if payload.description is not None:
        ev.description = payload.description.strip()
    if payload.uri is not None:
        ev.uri = payload.uri.strip()
    if payload.verification_status is not None:
        ev.verification_status = payload.verification_status.value
        ev.verified_at = (
            utcnow() if payload.verification_status == VerificationStatus.VERIFIED else None
        )

    db.flush()
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Evidence verification status updated on task '{task.title}'"
    )
    record_activity(
        db,
        project_id=project.id,
        task_id=task.id,
        action="evidence_updated",
        details={
            "evidence_id": ev.id,
            "verification_status": ev.verification_status,
        },
    )
    db.commit()
    db.refresh(ev)
    return EvidenceResponse.model_validate(ev)


@router.delete("/evidence/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_evidence(
    evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = get_owned_evidence(db, evidence_id, current_user)
    task = ev.task
    project = task.project
    db.delete(ev)
    db.flush()
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Evidence deleted from task '{task.title}'"
    )
    record_activity(
        db,
        project_id=project.id,
        task_id=task.id,
        action="evidence_deleted",
        details={"task_title": task.title},
    )
    db.commit()
    return None
