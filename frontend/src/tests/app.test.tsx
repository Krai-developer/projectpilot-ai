import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../hooks/useAuth';
import { AuthPage } from '../features/auth/AuthPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { api } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      getMe: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      getDashboard: vi.fn(),
      getProject: vi.fn(),
      getProjectGate: vi.fn(),
      getRequirements: vi.fn(),
      getTasks: vi.fn(),
      updateTask: vi.fn(),
      getMilestones: vi.fn(),
      getProjectEvidence: vi.fn(),
      getProjectAssessments: vi.fn(),
      runAssessment: vi.fn(),
    },
  };
});

describe('ProjectPilot AI Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('validates authentication form inputs (email & password length)', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <AuthPage />
        </MemoryRouter>
      </AuthProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /Sign In to Workspace/i });
    await user.click(submitBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    await user.type(emailInput, 'dev@example.com');
    await user.type(passwordInput, 'short');
    await user.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
  });

  it('renders dashboard loading, error state, and real database metrics', async () => {
    // 1. Error state
    vi.mocked(api.getDashboard).mockRejectedValueOnce(new Error('Database connection lost'));
    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Database connection lost/i)).toBeInTheDocument();
    unmount();

    // 2. Success state with metrics
    vi.mocked(api.getDashboard).mockResolvedValueOnce({
      total_projects: 3,
      projects_in_progress: 2,
      projects_eligible_for_completion: 1,
      projects_with_blockers: 1,
      overdue_tasks_count: 4,
      upcoming_deadlines: [],
      projects: [
        {
          id: 10,
          owner_id: 1,
          name: 'Payment Core Engine',
          description: 'Idempotent ledger service',
          objectives: 'Zero double charges',
          completion_criteria: 'All checks pass',
          status: 'In Progress',
          priority: 'High',
          start_date: null,
          deadline: null,
          progress_percentage: 65.5,
          readiness_status: 'In Progress',
          eligible_for_completion: false,
          total_tasks: 4,
          completed_tasks: 2,
          blocked_tasks: 0,
          overdue_tasks: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: null,
        },
      ],
      recent_activity: [],
      latest_assessments: [],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('metric-total-projects')).toHaveTextContent('3');
    expect(screen.getByTestId('metric-eligible')).toHaveTextContent('1');
    expect(screen.getByText('Payment Core Engine')).toBeInTheDocument();
    expect(screen.getByText('65.5%')).toBeInTheDocument();
  });

  it('displays project progress, handles task status updates, and renders AI assessments', async () => {
    const user = userEvent.setup();

    vi.mocked(api.getProject).mockResolvedValue({
      id: 1,
      owner_id: 1,
      name: 'Zero-Trust Auth Gateway',
      description: 'Local gateway service',
      objectives: 'Enforce Argon2id',
      completion_criteria: 'All mandatory tasks Done',
      status: 'In Progress',
      priority: 'Critical',
      start_date: null,
      deadline: null,
      progress_percentage: 50.0,
      readiness_status: 'In Progress',
      eligible_for_completion: false,
      total_tasks: 2,
      completed_tasks: 1,
      blocked_tasks: 0,
      overdue_tasks: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    vi.mocked(api.getProjectGate).mockResolvedValue({
      gate: {
        progress_percentage: 50.0,
        completed_task_weight: 5.0,
        total_task_weight: 10.0,
        total_tasks: 2,
        completed_tasks: 1,
        readiness_status: 'In Progress',
        eligible_for_completion: false,
        mandatory_requirements_total: 1,
        mandatory_requirements_satisfied: 0,
        unmapped_mandatory_requirements: [],
        unsatisfied_mandatory_requirements: [{ requirement_id: 1, title: 'Argon2id', reason: 'Pending task' }],
        incomplete_required_tasks: [{ task_id: 2, title: 'Write token verifier', status: 'To Do', priority: 'High' }],
        blocked_or_review_mandatory_tasks: [],
        overdue_tasks: [],
        unverified_acceptance_criteria: [],
        failed_verification_checks: [],
        unsatisfied_milestones: [],
        unsatisfied_dependencies: [],
        blocking_reasons: ['1 required task(s) are not Done.'],
      },
      recommended_next_steps: [
        {
          task_id: 2,
          title: 'Write token verifier',
          priority: 'High',
          why_it_matters: 'Required for mandatory requirement Argon2id.',
          action_type: 'task_execution',
        },
      ],
    });

    vi.mocked(api.getRequirements).mockResolvedValue([
      {
        id: 1,
        project_id: 1,
        title: 'Argon2id Hashing',
        description: 'Secure password hashing',
        is_mandatory: true,
        acceptance_criteria: 'Unit tests pass',
        verification_notes: '',
        status: 'In Progress',
        linked_task_ids: [1, 2],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    vi.mocked(api.getTasks).mockResolvedValue([
      {
        id: 1,
        project_id: 1,
        milestone_id: null,
        title: 'Setup Argon2id config',
        description: '',
        status: 'Done',
        priority: 'High',
        weight: 5.0,
        estimated_hours: 2,
        actual_hours: 2,
        due_date: null,
        notes: '',
        requirement_ids: [1],
        dependency_ids: [],
        incomplete_prerequisite_ids: [],
        evidence_items: [],
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 2,
        project_id: 1,
        milestone_id: null,
        title: 'Write token verifier',
        description: '',
        status: 'To Do',
        priority: 'High',
        weight: 5.0,
        estimated_hours: 3,
        actual_hours: 0,
        due_date: null,
        notes: '',
        requirement_ids: [1],
        dependency_ids: [],
        incomplete_prerequisite_ids: [],
        evidence_items: [],
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    vi.mocked(api.getMilestones).mockResolvedValue([]);
    vi.mocked(api.getProjectEvidence).mockResolvedValue([]);
    vi.mocked(api.getProjectAssessments).mockResolvedValue([
      {
        id: 101,
        project_id: 1,
        progress_snapshot: 50.0,
        readiness_status: 'In Progress',
        ai_summary: 'Project is 50% complete. Token verifier task remains.',
        findings: {
          overall_summary: 'Project is 50% complete. Token verifier task remains.',
          recorded_progress_percentage: 50.0,
          readiness_status: 'In Progress',
          eligible_for_completion: false,
          completed_work: [{ task_id: 1, title: 'Setup Argon2id config' }],
          remaining_tasks: [{ task_id: 2, title: 'Write token verifier', status: 'To Do' }],
          missing_requirements: [],
          blocked_or_overdue_tasks: [],
          unverified_acceptance_criteria: [],
          failed_verification_checks: [],
          recommended_next_actions: [
            {
              task_id: 2,
              title: 'Write token verifier',
              priority: 'High',
              why_it_matters: 'Unlocks completion gate.',
              action_type: 'task_execution',
            },
          ],
          limitations_or_uncertainties: ['No test evidence verified yet.'],
          blocking_reasons: ['1 required task(s) are not Done.'],
          ai_used: true,
          ai_error: null,
        },
        state_snapshot: {},
        model_name: 'llama3.2:3b',
        is_stale: true,
        created_at: new Date().toISOString(),
        invalidated_at: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify progress percentage display
    expect(await screen.findByTestId('project-progress-value')).toHaveTextContent('50%');

    // Switch to Tasks tab and change status
    const tasksTab = screen.getByRole('tab', { name: /Tasks \(2\)/i });
    await user.click(tasksTab);

    const statusSelect = screen.getByLabelText(/Status for Write token verifier/i);
    vi.mocked(api.updateTask).mockResolvedValueOnce({} as any);
    await user.selectOptions(statusSelect, 'Done');
    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith(2, { status: 'Done' });
    });

    // Switch to Assessment History tab and verify rendering & stale indicator
    const assessTab = screen.getByRole('tab', { name: /Assessment History \(1\)/i });
    await user.click(assessTab);

    expect(
      await screen.findByText(/Project is 50% complete. Token verifier task remains./i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('assessment-stale-101')).toHaveTextContent(/Stale/i);
  });
});
