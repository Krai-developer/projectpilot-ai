from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_owned_milestone, get_owned_project
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import Milestone, MilestoneStatus, User
from app.schemas.schemas import MilestoneCreate, MilestoneResponse, MilestoneUpdate
from app.services.completion_service import (
    compute_milestone_status_and_progress,
    invalidate_assessments_and_sync_project_state,
    record_activity,
)

router = APIRouter(prefix="/api", tags=["Milestones"])


def serialize_milestone(milestone: Milestone) -> MilestoneResponse:
    computed_status, progress, total_tasks, completed_tasks = compute_milestone_status_and_progress(milestone)
    return MilestoneResponse(
        id=milestone.id,
        project_id=milestone.project_id,
        title=milestone.title,
        description=milestone.description,
        due_date=milestone.due_date,
        is_required=milestone.is_required,
        status=computed_status,
        computed_progress=progress,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        created_at=milestone.created_at,
        updated_at=milestone.updated_at,
    )


@router.get("/projects/{project_id}/milestones", response_model=List[MilestoneResponse])
def list_milestones(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    return [serialize_milestone(m) for m in project.milestones]


@router.post(
    "/projects/{project_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_milestone(
    project_id: int,
    payload: MilestoneCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    milestone = Milestone(
        project_id=project.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        due_date=payload.due_date,
        is_required=payload.is_required,
        status=MilestoneStatus.PENDING.value,
    )
    db.add(milestone)
    db.flush()
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Milestone '{milestone.title}' created"
    )
    record_activity(
        db,
        project_id=project.id,
        action="milestone_created",
        details={"milestone_id": milestone.id, "title": milestone.title},
    )
    db.commit()
    db.refresh(milestone)
    return serialize_milestone(milestone)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneResponse)
def update_milestone(
    milestone_id: int,
    payload: MilestoneUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    milestone = get_owned_milestone(db, milestone_id, current_user)
    if payload.title is not None:
        milestone.title = payload.title.strip()
    if payload.description is not None:
        milestone.description = payload.description.strip()
    if "due_date" in payload.model_fields_set:
        milestone.due_date = payload.due_date
    if payload.is_required is not None:
        milestone.is_required = payload.is_required

    computed_status, _, _, _ = compute_milestone_status_and_progress(milestone)
    milestone.status = computed_status

    db.flush()
    project = milestone.project
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Milestone '{milestone.title}' updated"
    )
    record_activity(
        db,
        project_id=project.id,
        action="milestone_updated",
        details={"milestone_id": milestone.id, "title": milestone.title},
    )
    db.commit()
    db.refresh(milestone)
    return serialize_milestone(milestone)


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    milestone_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    milestone = get_owned_milestone(db, milestone_id, current_user)
    project = milestone.project
    title = milestone.title
    db.delete(milestone)
    db.flush()
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Milestone '{title}' deleted"
    )
    record_activity(
        db,
        project_id=project.id,
        action="milestone_deleted",
        details={"title": title},
    )
    db.commit()
    return None
