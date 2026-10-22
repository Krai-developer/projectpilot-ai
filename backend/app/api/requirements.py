from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project, get_owned_requirement
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import Requirement, User
from app.schemas.schemas import RequirementCreate, RequirementResponse, RequirementUpdate
from app.services.completion_service import (
    invalidate_assessments_and_sync_project_state,
    record_activity,
)

router = APIRouter(prefix="/api", tags=["Requirements"])


def serialize_requirement(req: Requirement) -> RequirementResponse:
    return RequirementResponse(
        id=req.id,
        project_id=req.project_id,
        title=req.title,
        description=req.description,
        is_mandatory=req.is_mandatory,
        acceptance_criteria=req.acceptance_criteria,
        verification_notes=req.verification_notes,
        status=req.status,
        linked_task_ids=[t.id for t in (req.tasks or [])],
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.get("/projects/{project_id}/requirements", response_model=List[RequirementResponse])
def list_requirements(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    return [serialize_requirement(r) for r in project.requirements]


@router.post(
    "/projects/{project_id}/requirements",
    response_model=RequirementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_requirement(
    project_id: int,
    payload: RequirementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(db, project_id, current_user)
    req = Requirement(
        project_id=project.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        is_mandatory=payload.is_mandatory,
        acceptance_criteria=payload.acceptance_criteria.strip(),
        verification_notes=payload.verification_notes.strip(),
        status=payload.status.value,
    )
    db.add(req)
    db.flush()
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Requirement '{req.title}' created"
    )
    record_activity(
        db,
        project_id=project.id,
        action="requirement_created",
        details={"requirement_id": req.id, "title": req.title, "is_mandatory": req.is_mandatory},
    )
    db.commit()
    db.refresh(req)
    return serialize_requirement(req)


@router.patch("/requirements/{requirement_id}", response_model=RequirementResponse)
def update_requirement(
    requirement_id: int,
    payload: RequirementUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = get_owned_requirement(db, requirement_id, current_user)
    if payload.title is not None:
        req.title = payload.title.strip()
    if payload.description is not None:
        req.description = payload.description.strip()
    if payload.is_mandatory is not None:
        req.is_mandatory = payload.is_mandatory
    if payload.acceptance_criteria is not None:
        req.acceptance_criteria = payload.acceptance_criteria.strip()
    if payload.verification_notes is not None:
        req.verification_notes = payload.verification_notes.strip()
    if payload.status is not None:
        req.status = payload.status.value

    db.flush()
    project = req.project
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Requirement '{req.title}' updated"
    )
    record_activity(
        db,
        project_id=project.id,
        action="requirement_updated",
        details={"requirement_id": req.id, "title": req.title, "status": req.status},
    )
    db.commit()
    db.refresh(req)
    return serialize_requirement(req)


@router.delete("/requirements/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_requirement(
    requirement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = get_owned_requirement(db, requirement_id, current_user)
    project = req.project
    title = req.title
    db.delete(req)
    db.flush()
    db.refresh(project)
    invalidate_assessments_and_sync_project_state(
        db, project, reason=f"Requirement '{title}' deleted"
    )
    record_activity(
        db,
        project_id=project.id,
        action="requirement_deleted",
        details={"title": title},
    )
    db.commit()
    return None
