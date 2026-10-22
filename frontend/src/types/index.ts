export type ProjectStatus =
  | 'Planning'
  | 'In Progress'
  | 'Blocked'
  | 'Ready for Review'
  | 'Completed'
  | 'Archived';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type RequirementStatus =
  | 'Unmapped'
  | 'In Progress'
  | 'Needs Verification'
  | 'Satisfied'
  | 'Failed';

export type MilestoneStatus = 'Pending' | 'In Progress' | 'Blocked' | 'Completed';

export type TaskStatus = 'To Do' | 'In Progress' | 'Blocked' | 'In Review' | 'Done';

export type EvidenceType =
  | 'test_result'
  | 'verification_note'
  | 'documentation_link'
  | 'repository_link'
  | 'deployment_link'
  | 'other';

export type VerificationStatus = 'pending' | 'verified' | 'failed';

export type ReadinessStatus =
  | 'In Progress'
  | 'Not Ready'
  | 'Needs Verification'
  | 'Eligible for Completion'
  | 'Completed';

export interface User {
  id: number;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Project {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  objectives: string;
  completion_criteria: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  start_date: string | null;
  deadline: string | null;
  progress_percentage: number;
  readiness_status: ReadinessStatus;
  eligible_for_completion: boolean;
  total_tasks: number;
  completed_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Requirement {
  id: number;
  project_id: number;
  title: string;
  description: string;
  is_mandatory: boolean;
  acceptance_criteria: string;
  verification_notes: string;
  status: RequirementStatus;
  linked_task_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  description: string;
  due_date: string | null;
  is_required: boolean;
  status: MilestoneStatus;
  computed_progress: number;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: number;
  task_id: number;
  evidence_type: EvidenceType;
  description: string;
  uri: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  milestone_id: number | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityLevel;
  weight: number;
  estimated_hours: number;
  actual_hours: number;
  due_date: string | null;
  notes: string;
  requirement_ids: number[];
  dependency_ids: number[];
  incomplete_prerequisite_ids: number[];
  evidence_items: Evidence[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NextStepRecommendation {
  task_id: number | null;
  title: string;
  priority: string;
  why_it_matters: string;
  action_type: string;
}

export interface CompletionGateResult {
  progress_percentage: number;
  completed_task_weight: number;
  total_task_weight: number;
  total_tasks: number;
  completed_tasks: number;
  readiness_status: ReadinessStatus;
  eligible_for_completion: boolean;
  mandatory_requirements_total: number;
  mandatory_requirements_satisfied: number;
  unmapped_mandatory_requirements: Array<Record<string, any>>;
  unsatisfied_mandatory_requirements: Array<Record<string, any>>;
  incomplete_required_tasks: Array<Record<string, any>>;
  blocked_or_review_mandatory_tasks: Array<Record<string, any>>;
  overdue_tasks: Array<Record<string, any>>;
  unverified_acceptance_criteria: Array<Record<string, any>>;
  failed_verification_checks: Array<Record<string, any>>;
  unsatisfied_milestones: Array<Record<string, any>>;
  unsatisfied_dependencies: Array<Record<string, any>>;
  blocking_reasons: string[];
}

export interface AssessmentFindings {
  overall_summary: string;
  recorded_progress_percentage: number;
  readiness_status: ReadinessStatus;
  eligible_for_completion: boolean;
  completed_work: Array<Record<string, any>>;
  remaining_tasks: Array<Record<string, any>>;
  missing_requirements: Array<Record<string, any>>;
  blocked_or_overdue_tasks: Array<Record<string, any>>;
  unverified_acceptance_criteria: Array<Record<string, any>>;
  failed_verification_checks: Array<Record<string, any>>;
  recommended_next_actions: NextStepRecommendation[];
  limitations_or_uncertainties: string[];
  blocking_reasons: string[];
  ai_used: boolean;
  ai_error?: string | null;
}

export interface Assessment {
  id: number;
  project_id: number;
  progress_snapshot: number;
  readiness_status: ReadinessStatus;
  ai_summary: string;
  findings: AssessmentFindings;
  state_snapshot: Record<string, any>;
  model_name: string;
  is_stale: boolean;
  created_at: string;
  invalidated_at: string | null;
}

export interface ActivityLog {
  id: number;
  project_id: number;
  task_id: number | null;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

export interface DashboardSummary {
  total_projects: number;
  projects_in_progress: number;
  projects_eligible_for_completion: number;
  projects_with_blockers: number;
  overdue_tasks_count: number;
  upcoming_deadlines: Array<{
    type: 'project' | 'task';
    id: number;
    project_id: number;
    project_name: string;
    title: string;
    due_date: string;
    days_remaining: number;
    status: string;
  }>;
  projects: Project[];
  recent_activity: ActivityLog[];
  latest_assessments: Assessment[];
}

export interface GeneratedRequirementItem {
  title: string;
  description: string;
  is_mandatory: boolean;
  acceptance_criteria: string;
}

export interface GeneratedMilestoneItem {
  title: string;
  description: string;
  is_required: boolean;
}

export interface GeneratedTaskItem {
  title: string;
  description: string;
  priority: PriorityLevel;
  weight: number;
  estimated_hours: number;
  linked_requirement_titles: string[];
  milestone_title?: string | null;
  acceptance_notes: string;
}

export interface AITaskGenerationResponse {
  project_id: number;
  model_name: string;
  ai_used: boolean;
  warning?: string | null;
  requirements: GeneratedRequirementItem[];
  milestones: GeneratedMilestoneItem[];
  tasks: GeneratedTaskItem[];
}

export interface AIHealthStatus {
  status: 'available' | 'model_missing' | 'unavailable';
  ollama_reachable: boolean;
  model_ready: boolean;
  configured_model: string;
  ollama_base_url: string;
  available_models: string[];
  fallback_mode: string;
  error: string | null;
  timestamp: string;
}
