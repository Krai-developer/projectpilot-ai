from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.entities import (
    EvidenceType,
    MilestoneStatus,
    PriorityLevel,
    ProjectStatus,
    ReadinessStatus,
    RequirementStatus,
    TaskStatus,
    VerificationStatus,
)


# --- Auth Schemas ---

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Evidence Schemas ---

class EvidenceCreate(BaseModel):
    evidence_type: EvidenceType = EvidenceType.VERIFICATION_NOTE
    description: str = Field(..., min_length=1, max_length=2000)
    uri: str = Field(default="", max_length=1024)
    verification_status: VerificationStatus = VerificationStatus.PENDING


class EvidenceUpdate(BaseModel):
    evidence_type: Optional[EvidenceType] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    uri: Optional[str] = Field(default=None, max_length=1024)
    verification_status: Optional[VerificationStatus] = None


class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    evidence_type: str
    description: str
    uri: str
    verification_status: str
    verified_at: Optional[datetime] = None
    created_at: datetime


# --- Requirement Schemas ---

class RequirementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)
    is_mandatory: bool = True
    acceptance_criteria: str = Field(default="", max_length=4000)
    verification_notes: str = Field(default="", max_length=4000)
    status: RequirementStatus = RequirementStatus.UNMAPPED


class RequirementUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=4000)
    is_mandatory: Optional[bool] = None
    acceptance_criteria: Optional[str] = Field(default=None, max_length=4000)
    verification_notes: Optional[str] = Field(default=None, max_length=4000)
    status: Optional[RequirementStatus] = None


class RequirementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str
    is_mandatory: bool
    acceptance_criteria: str
    verification_notes: str
    status: str
    linked_task_ids: List[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# --- Milestone Schemas ---

class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)
    due_date: Optional[date] = None
    is_required: bool = True


class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=4000)
    due_date: Optional[date] = None
    is_required: Optional[bool] = None
    status: Optional[MilestoneStatus] = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str
    due_date: Optional[date] = None
    is_required: bool
    status: str
    computed_progress: float = 0.0
    total_tasks: int = 0
    completed_tasks: int = 0
    created_at: datetime
    updated_at: datetime


# --- Task Schemas ---

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)
    status: TaskStatus = TaskStatus.TO_DO
    priority: PriorityLevel = PriorityLevel.MEDIUM
    weight: float = Field(default=1.0, gt=0.0, le=1000.0)
    estimated_hours: float = Field(default=0.0, ge=0.0, le=10000.0)
    actual_hours: float = Field(default=0.0, ge=0.0, le=10000.0)
    due_date: Optional[date] = None
    milestone_id: Optional[int] = None
    notes: str = Field(default="", max_length=4000)
    requirement_ids: List[int] = Field(default_factory=list)
    dependency_ids: List[int] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=4000)
    status: Optional[TaskStatus] = None
    priority: Optional[PriorityLevel] = None
    weight: Optional[float] = Field(default=None, gt=0.0, le=1000.0)
    estimated_hours: Optional[float] = Field(default=None, ge=0.0, le=10000.0)
    actual_hours: Optional[float] = Field(default=None, ge=0.0, le=10000.0)
    due_date: Optional[date] = None
    milestone_id: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=4000)
    requirement_ids: Optional[List[int]] = None
    dependency_ids: Optional[List[int]] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    milestone_id: Optional[int] = None
    title: str
    description: str
    status: str
    priority: str
    weight: float
    estimated_hours: float
    actual_hours: float
    due_date: Optional[date] = None
    notes: str
    requirement_ids: List[int] = Field(default_factory=list)
    dependency_ids: List[int] = Field(default_factory=list)
    incomplete_prerequisite_ids: List[int] = Field(default_factory=list)
    evidence_items: List[EvidenceResponse] = Field(default_factory=list)
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# --- Completion Gate & Progress Schemas ---

class CompletionGateResult(BaseModel):
    progress_percentage: float
    completed_task_weight: float
    total_task_weight: float
    total_tasks: int
    completed_tasks: int
    readiness_status: ReadinessStatus
    eligible_for_completion: bool
    mandatory_requirements_total: int
    mandatory_requirements_satisfied: int
    unmapped_mandatory_requirements: List[Dict[str, Any]] = Field(default_factory=list)
    unsatisfied_mandatory_requirements: List[Dict[str, Any]] = Field(default_factory=list)
    incomplete_required_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    blocked_or_review_mandatory_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    overdue_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    unverified_acceptance_criteria: List[Dict[str, Any]] = Field(default_factory=list)
    failed_verification_checks: List[Dict[str, Any]] = Field(default_factory=list)
    unsatisfied_milestones: List[Dict[str, Any]] = Field(default_factory=list)
    unsatisfied_dependencies: List[Dict[str, Any]] = Field(default_factory=list)
    blocking_reasons: List[str] = Field(default_factory=list)


# --- Project Schemas ---

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=5000)
    objectives: str = Field(default="", max_length=5000)
    completion_criteria: str = Field(default="", max_length=5000)
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: PriorityLevel = PriorityLevel.MEDIUM
    start_date: Optional[date] = None
    deadline: Optional[date] = None

    @field_validator("status")
    @classmethod
    def disallow_direct_completed_on_create(cls, v: ProjectStatus) -> ProjectStatus:
        if v == ProjectStatus.COMPLETED:
            raise ValueError("A newly created project cannot start in Completed status.")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    objectives: Optional[str] = Field(default=None, max_length=5000)
    completion_criteria: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[ProjectStatus] = None
    priority: Optional[PriorityLevel] = None
    start_date: Optional[date] = None
    deadline: Optional[date] = None


class ProjectCompleteRequest(BaseModel):
    confirm_completion: bool = Field(
        ...,
        description="Explicit user confirmation required to mark an eligible project as Completed.",
    )
    completion_notes: str = Field(default="", max_length=2000)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    description: str
    objectives: str
    completion_criteria: str
    status: str
    priority: str
    start_date: Optional[date] = None
    deadline: Optional[date] = None
    progress_percentage: float = 0.0
    readiness_status: str = ReadinessStatus.IN_PROGRESS.value
    eligible_for_completion: bool = False
    total_tasks: int = 0
    completed_tasks: int = 0
    blocked_tasks: int = 0
    overdue_tasks: int = 0
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    task_id: Optional[int] = None
    action: str
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# --- AI & Assessment Schemas ---

class NextStepRecommendation(BaseModel):
    task_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    priority: str = Field(default="High", max_length=50)
    why_it_matters: str = Field(..., min_length=1, max_length=1000)
    action_type: str = Field(default="task_execution", max_length=100)


class StructuredAIAssessmentOutput(BaseModel):
    overall_summary: str = Field(..., min_length=1, max_length=3000)
    recommended_next_actions: List[NextStepRecommendation] = Field(default_factory=list, max_length=10)
    limitations_or_uncertainties: List[str] = Field(default_factory=list, max_length=10)
    risk_highlights: List[str] = Field(default_factory=list, max_length=10)


class AssessmentReportFindings(BaseModel):
    overall_summary: str
    recorded_progress_percentage: float
    readiness_status: str
    eligible_for_completion: bool
    completed_work: List[Dict[str, Any]] = Field(default_factory=list)
    remaining_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    missing_requirements: List[Dict[str, Any]] = Field(default_factory=list)
    blocked_or_overdue_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    unverified_acceptance_criteria: List[Dict[str, Any]] = Field(default_factory=list)
    failed_verification_checks: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_next_actions: List[NextStepRecommendation] = Field(default_factory=list)
    limitations_or_uncertainties: List[str] = Field(default_factory=list)
    blocking_reasons: List[str] = Field(default_factory=list)
    ai_used: bool = False
    ai_error: Optional[str] = None


class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    progress_snapshot: float
    readiness_status: str
    ai_summary: str
    findings: AssessmentReportFindings
    state_snapshot: Dict[str, Any] = Field(default_factory=dict)
    model_name: str
    is_stale: bool = False
    created_at: datetime
    invalidated_at: Optional[datetime] = None


class GeneratedRequirementItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    is_mandatory: bool = True
    acceptance_criteria: str = Field(default="", max_length=2000)


class GeneratedMilestoneItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    is_required: bool = True


class GeneratedTaskItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    priority: PriorityLevel = PriorityLevel.MEDIUM
    weight: float = Field(default=1.0, gt=0.0, le=100.0)
    estimated_hours: float = Field(default=2.0, ge=0.0, le=500.0)
    linked_requirement_titles: List[str] = Field(default_factory=list)
    milestone_title: Optional[str] = None
    acceptance_notes: str = Field(default="", max_length=2000)


class AITaskGenerationRequest(BaseModel):
    project_description: Optional[str] = Field(default=None, max_length=5000)
    focus_area: Optional[str] = Field(default=None, max_length=1000)
    idempotency_key: Optional[str] = Field(default=None, max_length=128)


class AITaskGenerationResponse(BaseModel):
    project_id: int
    model_name: str
    ai_used: bool
    warning: Optional[str] = None
    requirements: List[GeneratedRequirementItem] = Field(default_factory=list)
    milestones: List[GeneratedMilestoneItem] = Field(default_factory=list)
    tasks: List[GeneratedTaskItem] = Field(default_factory=list)


class ApproveGeneratedPlanRequest(BaseModel):
    idempotency_key: Optional[str] = Field(default=None, max_length=128)
    requirements: List[GeneratedRequirementItem] = Field(default_factory=list)
    milestones: List[GeneratedMilestoneItem] = Field(default_factory=list)
    tasks: List[GeneratedTaskItem] = Field(default_factory=list)


class ApproveGeneratedPlanResponse(BaseModel):
    created_requirements: int
    created_milestones: int
    created_tasks: int
    skipped_duplicates: int


class DashboardSummaryResponse(BaseModel):
    total_projects: int
    projects_in_progress: int
    projects_eligible_for_completion: int
    projects_with_blockers: int
    overdue_tasks_count: int
    upcoming_deadlines: List[Dict[str, Any]] = Field(default_factory=list)
    projects: List[ProjectResponse] = Field(default_factory=list)
    recent_activity: List[ActivityLogResponse] = Field(default_factory=list)
    latest_assessments: List[AssessmentResponse] = Field(default_factory=list)
