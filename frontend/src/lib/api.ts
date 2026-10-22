import {
  AIHealthStatus,
  AITaskGenerationResponse,
  ActivityLog,
  Assessment,
  CompletionGateResult,
  DashboardSummary,
  Evidence,
  GeneratedMilestoneItem,
  GeneratedRequirementItem,
  GeneratedTaskItem,
  Milestone,
  NextStepRecommendation,
  Project,
  Requirement,
  Task,
  TokenResponse,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const TOKEN_STORAGE_KEY = 'projectpilot_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (typeof data.detail === 'object' && data.detail.message) {
        const reasons = Array.isArray(data.detail.blocking_reasons)
          ? ` ${data.detail.blocking_reasons.join(' ')}`
          : '';
        message = `${data.detail.message}${reasons}`;
      } else if (Array.isArray(data.detail)) {
        message = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
      }
    }
    throw new ApiError(message, response.status, data?.detail);
  }

  return data as T;
}

export const api = {
  // System health
  getHealth: () => request<{ status: string; database: string; timestamp: string }>('/health'),
  getAIHealth: () => request<AIHealthStatus>('/health/ai'),

  // Auth
  register: (payload: { email: string; password: string; full_name?: string }) =>
    request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),
  getMe: () => request<User>('/auth/me'),

  // Dashboard & Projects
  getDashboard: () => request<DashboardSummary>('/dashboard'),
  getProjects: (statusFilter?: string) => {
    const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    return request<Project[]>(`/projects${qs}`);
  },
  createProject: (payload: Partial<Project>) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createDemoProject: () =>
    request<Project>('/projects/demo', {
      method: 'POST',
    }),
  getProject: (projectId: number) => request<Project>(`/projects/${projectId}`),
  updateProject: (projectId: number, payload: Partial<Project>) =>
    request<Project>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteProject: (projectId: number) =>
    request<void>(`/projects/${projectId}`, {
      method: 'DELETE',
    }),
  getProjectGate: (projectId: number) =>
    request<{ gate: CompletionGateResult; recommended_next_steps: NextStepRecommendation[] }>(
      `/projects/${projectId}/gate`
    ),
  getProjectActivity: (projectId: number) =>
    request<ActivityLog[]>(`/projects/${projectId}/activity`),
  completeProject: (projectId: number, payload: { confirm_completion: boolean; completion_notes?: string }) =>
    request<Project>(`/projects/${projectId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Requirements
  getRequirements: (projectId: number) =>
    request<Requirement[]>(`/projects/${projectId}/requirements`),
  createRequirement: (projectId: number, payload: Partial<Requirement>) =>
    request<Requirement>(`/projects/${projectId}/requirements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRequirement: (requirementId: number, payload: Partial<Requirement>) =>
    request<Requirement>(`/requirements/${requirementId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteRequirement: (requirementId: number) =>
    request<void>(`/requirements/${requirementId}`, {
      method: 'DELETE',
    }),

  // Milestones
  getMilestones: (projectId: number) =>
    request<Milestone[]>(`/projects/${projectId}/milestones`),
  createMilestone: (projectId: number, payload: Partial<Milestone>) =>
    request<Milestone>(`/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMilestone: (milestoneId: number, payload: Partial<Milestone>) =>
    request<Milestone>(`/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteMilestone: (milestoneId: number) =>
    request<void>(`/milestones/${milestoneId}`, {
      method: 'DELETE',
    }),

  // Tasks & Evidence
  getTasks: (projectId: number, params?: { status?: string; priority?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    return request<Task[]>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (projectId: number, payload: Record<string, any>) =>
    request<Task>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (taskId: number, payload: Record<string, any>) =>
    request<Task>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteTask: (taskId: number) =>
    request<void>(`/tasks/${taskId}`, {
      method: 'DELETE',
    }),
  getProjectEvidence: (projectId: number) =>
    request<Evidence[]>(`/projects/${projectId}/evidence`),
  createEvidence: (taskId: number, payload: Partial<Evidence>) =>
    request<Evidence>(`/tasks/${taskId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateEvidence: (evidenceId: number, payload: Partial<Evidence>) =>
    request<Evidence>(`/evidence/${evidenceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteEvidence: (evidenceId: number) =>
    request<void>(`/evidence/${evidenceId}`, {
      method: 'DELETE',
    }),

  // AI & Assessments
  generateTasksWithAI: (
    projectId: number,
    payload: { project_description?: string; focus_area?: string }
  ) =>
    request<AITaskGenerationResponse>(`/projects/${projectId}/ai/generate-tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveGeneratedPlan: (
    projectId: number,
    payload: {
      requirements: GeneratedRequirementItem[];
      milestones: GeneratedMilestoneItem[];
      tasks: GeneratedTaskItem[];
    }
  ) =>
    request<{
      created_requirements: number;
      created_milestones: number;
      created_tasks: number;
      skipped_duplicates: number;
    }>(`/projects/${projectId}/ai/approve-tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  runAssessment: (projectId: number) =>
    request<Assessment>(`/projects/${projectId}/assessments`, {
      method: 'POST',
    }),
  getProjectAssessments: (projectId: number) =>
    request<Assessment[]>(`/projects/${projectId}/assessments`),
  getAssessment: (assessmentId: number) =>
    request<Assessment>(`/assessments/${assessmentId}`),
};
