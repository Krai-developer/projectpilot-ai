from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import (
    Assessment,
    Milestone,
    Project,
    Requirement,
    Task,
    TaskEvidence,
    User,
)


def get_owned_project(db: Session, project_id: int, user: User) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


def get_owned_requirement(db: Session, requirement_id: int, user: User) -> Requirement:
    requirement = (
        db.query(Requirement)
        .join(Project, Requirement.project_id == Project.id)
        .filter(Requirement.id == requirement_id, Project.owner_id == user.id)
        .first()
    )
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )
    return requirement


def get_owned_milestone(db: Session, milestone_id: int, user: User) -> Milestone:
    milestone = (
        db.query(Milestone)
        .join(Project, Milestone.project_id == Project.id)
        .filter(Milestone.id == milestone_id, Project.owner_id == user.id)
        .first()
    )
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )
    return milestone


def get_owned_task(db: Session, task_id: int, user: User) -> Task:
    task = (
        db.query(Task)
        .join(Project, Task.project_id == Project.id)
        .filter(Task.id == task_id, Project.owner_id == user.id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return task


def get_owned_evidence(db: Session, evidence_id: int, user: User) -> TaskEvidence:
    evidence = (
        db.query(TaskEvidence)
        .join(Task, TaskEvidence.task_id == Task.id)
        .join(Project, Task.project_id == Project.id)
        .filter(TaskEvidence.id == evidence_id, Project.owner_id == user.id)
        .first()
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record not found",
        )
    return evidence


def get_owned_assessment(db: Session, assessment_id: int, user: User) -> Assessment:
    assessment = (
        db.query(Assessment)
        .join(Project, Assessment.project_id == Project.id)
        .filter(Assessment.id == assessment_id, Project.owner_id == user.id)
        .first()
    )
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )
    return assessment
