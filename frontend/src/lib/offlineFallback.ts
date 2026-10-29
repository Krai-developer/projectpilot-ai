import {
  ActivityLog,
  Assessment,
  CompletionGateResult,
  DashboardSummary,
  Evidence,
  Milestone,
  NextStepRecommendation,
  Project,
  Requirement,
  Task,
  TokenResponse,
  User,
} from '../types';

const STORAGE_KEY = 'projectpilot_offline_store_v2';

interface OfflineStore {
  users: (User & { password?: string })[];
  currentUserId: number;
  projects: Project[];
  requirements: Requirement[];
  milestones: Milestone[];
  tasks: Task[];
  evidence: Evidence[];
  assessments: Assessment[];
  activity: ActivityLog[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function createInitialStore(): OfflineStore {
  const now = nowIso();
  const demoUser: User & { password?: string } = {
    id: 1,
    email: 'pilot@projectpilot.ai',
    full_name: 'Alex Mercer',
    created_at: now,
    updated_at: now,
  };

  const demoProject: Project = {
    id: 1,
    owner_id: 1,
    name: 'Autonomous Flight Telemetry Core',
    description:
      'Real-time 3D telemetry ingestion, deterministic flight safety cutoff verification, and AI readiness gating.',
    objectives: 'Achieve <5ms packet latency and 100% mandatory safety gate verification.',
    completion_criteria: 'All mandatory requirements satisfied and verified.',
    status: 'In Progress',
    priority: 'High',
    start_date: '2026-10-01',
    deadline: '2026-12-15',
    progress_percentage: 62.5,
    readiness_status: 'In Progress',
    eligible_for_completion: false,
    total_tasks: 4,
    completed_tasks: 2,
    blocked_tasks: 0,
    overdue_tasks: 0,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  const requirements: Requirement[] = [
    {
      id: 1,
      project_id: 1,
      title: 'Sub-5ms Telemetry Stream Processing',
      description: 'Ingest and validate high-frequency sensor frames with zero dropped packets.',
      is_mandatory: true,
      acceptance_criteria: 'Sustained 1,000 Hz frame validation under load.',
      verification_notes: 'Verified via benchmark stress suite.',
      status: 'Satisfied',
      linked_task_ids: [1, 2],
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      project_id: 1,
      title: 'Deterministic Emergency Cutoff Interlock',
      description: 'Hardware-in-the-loop safety cutoff must trigger within 2ms of anomaly detection.',
      is_mandatory: true,
      acceptance_criteria: 'Verified cutoff log attached as task evidence.',
      verification_notes: '',
      status: 'In Progress',
      linked_task_ids: [3, 4],
      created_at: now,
      updated_at: now,
    },
  ];

  const milestones: Milestone[] = [
    {
      id: 1,
      project_id: 1,
      title: 'Phase 1: Core Telemetry Pipeline',
      description: 'Complete ingestion engine and ring-buffer validation.',
      due_date: '2026-11-15',
      is_required: true,
      status: 'Completed',
      computed_progress: 100,
      total_tasks: 2,
      completed_tasks: 2,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      project_id: 1,
      title: 'Phase 2: Safety Interlock Certification',
      description: 'Verify emergency cutoff handler and attach formal test logs.',
      due_date: '2026-12-15',
      is_required: true,
      status: 'In Progress',
      computed_progress: 0,
      total_tasks: 2,
      completed_tasks: 0,
      created_at: now,
      updated_at: now,
    },
  ];

  const evidence: Evidence[] = [
    {
      id: 1,
      task_id: 1,
      evidence_type: 'test_result',
      description: '10M Frame Stress Benchmark Log',
      uri: 'https://telemetry.projectpilot.local/reports/bench-01',
      verification_status: 'verified',
      verified_at: now,
      created_at: now,
    },
  ];

  const tasks: Task[] = [
    {
      id: 1,
      project_id: 1,
      milestone_id: 1,
      title: 'Implement zero-copy ring buffer parser',
      description: 'Parse incoming binary telemetry frames without heap allocations.',
      status: 'Done',
      priority: 'High',
      weight: 5,
      estimated_hours: 8,
      actual_hours: 7,
      due_date: '2026-11-05',
      notes: 'Passes 10M frame stress test.',
      requirement_ids: [1],
      dependency_ids: [],
      incomplete_prerequisite_ids: [],
      evidence_items: [evidence[0]],
      completed_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      project_id: 1,
      milestone_id: 1,
      title: 'Calibrate 3D gyroscopic state estimator',
      description: 'Synchronize quaternion attitude stream with cockpit HUD.',
      status: 'Done',
      priority: 'High',
      weight: 5,
      estimated_hours: 6,
      actual_hours: 6,
      due_date: '2026-11-12',
      notes: 'Phase drift < 0.05 deg.',
      requirement_ids: [1],
      dependency_ids: [],
      incomplete_prerequisite_ids: [],
      evidence_items: [],
      completed_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      project_id: 1,
      milestone_id: 2,
      title: 'Implement emergency cutoff signal handler',
      description: 'Trigger deterministic actuator lock on boundary violation.',
      status: 'In Progress',
      priority: 'Critical',
      weight: 4,
      estimated_hours: 10,
      actual_hours: 4,
      due_date: '2026-12-01',
      notes: 'Verified under fault injection.',
      requirement_ids: [2],
      dependency_ids: [],
      incomplete_prerequisite_ids: [],
      evidence_items: [],
      completed_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      project_id: 1,
      milestone_id: 2,
      title: 'Attach hardware-in-the-loop verification report',
      description: 'Upload signed telemetry capture from bench test.',
      status: 'To Do',
      priority: 'High',
      weight: 2,
      estimated_hours: 4,
      actual_hours: 0,
      due_date: '2026-12-10',
      notes: 'Report linked in task evidence.',
      requirement_ids: [2],
      dependency_ids: [],
      incomplete_prerequisite_ids: [],
      evidence_items: [],
      completed_at: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const assessments: Assessment[] = [
    {
      id: 1,
      project_id: 1,
      progress_snapshot: 62.5,
      readiness_status: 'In Progress',
      ai_summary:
        'Phase 1 telemetry ingestion is complete and verified. 2 tasks in Phase 2 remain before the completion gate unlocks.',
      findings: {
        overall_summary:
          'Phase 1 telemetry ingestion is complete and verified. 2 tasks in Phase 2 remain before the completion gate unlocks.',
        recorded_progress_percentage: 62.5,
        readiness_status: 'In Progress',
        eligible_for_completion: false,
        completed_work: [
          { id: 1, title: 'Implement zero-copy ring buffer parser' },
          { id: 2, title: 'Calibrate 3D gyroscopic state estimator' },
        ],
        remaining_tasks: [
          { id: 3, title: 'Implement emergency cutoff signal handler' },
          { id: 4, title: 'Attach hardware-in-the-loop verification report' },
        ],
        missing_requirements: [{ id: 2, title: 'Deterministic Emergency Cutoff Interlock' }],
        blocked_or_overdue_tasks: [],
        unverified_acceptance_criteria: [],
        failed_verification_checks: [],
        recommended_next_actions: [
          {
            task_id: 3,
            title: 'Implement emergency cutoff signal handler',
            priority: 'Critical',
            why_it_matters: 'Required for mandatory safety requirement #2.',
            action_type: 'complete_task',
          },
        ],
        limitations_or_uncertainties: [],
        blocking_reasons: ['2 task(s) are not yet Done.'],
        ai_used: false,
        ai_error: null,
      },
      state_snapshot: {
        progress_percentage: 62.5,
        completed_tasks: 2,
        total_tasks: 4,
      },
      model_name: 'deterministic-fallback-engine',
      is_stale: false,
      created_at: now,
      invalidated_at: null,
    },
  ];

  const activity: ActivityLog[] = [
    {
      id: 1,
      project_id: 1,
      task_id: null,
      action: 'project_created',
      details: { message: 'Initialized Autonomous Flight Telemetry Core workspace.' },
      created_at: now,
    },
  ];

  return {
    users: [demoUser],
    currentUserId: 1,
    projects: [demoProject],
    requirements,
    milestones,
    tasks,
    evidence,
    assessments,
    activity,
  };
}

function loadStore(): OfflineStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as OfflineStore;
    }
  } catch {
    // ignore corrupt storage
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: OfflineStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

function computeGate(store: OfflineStore, projectId: number): CompletionGateResult {
  const tasks = store.tasks.filter((t) => t.project_id === projectId);
  const reqs = store.requirements.filter((r) => r.project_id === projectId);

  const totalWeight = tasks.reduce((sum, t) => sum + (Number(t.weight) || 1), 0);
  const completedWeight = tasks
    .filter((t) => t.status === 'Done')
    .reduce((sum, t) => sum + (Number(t.weight) || 1), 0);
  const progress =
    totalWeight > 0 ? Number(((completedWeight / totalWeight) * 100).toFixed(1)) : 0;

  const incompleteTasks = tasks.filter((t) => t.status !== 'Done');
  const blockedTasks = tasks.filter((t) => t.status === 'Blocked');
  const mandatoryReqs = reqs.filter((r) => r.is_mandatory);
  const unmappedMandatory = mandatoryReqs.filter((r) => (r.linked_task_ids || []).length === 0);
  const unsatisfiedMandatory = mandatoryReqs.filter((r) => r.status !== 'Satisfied');

  const blockingReasons: string[] = [];
  if (tasks.length === 0) {
    blockingReasons.push('Project must have at least 1 task.');
  }
  if (incompleteTasks.length > 0) {
    blockingReasons.push(`${incompleteTasks.length} task(s) are not yet Done.`);
  }
  if (blockedTasks.length > 0) {
    blockingReasons.push(`${blockedTasks.length} task(s) are currently Blocked.`);
  }
  if (unsatisfiedMandatory.length > 0) {
    blockingReasons.push(
      `${unsatisfiedMandatory.length} mandatory requirement(s) are not yet Satisfied.`
    );
  }

  const eligible = blockingReasons.length === 0;

  return {
    progress_percentage: progress,
    completed_task_weight: completedWeight,
    total_task_weight: totalWeight,
    total_tasks: tasks.length,
    completed_tasks: tasks.filter((t) => t.status === 'Done').length,
    readiness_status: eligible ? 'Eligible for Completion' : 'In Progress',
    eligible_for_completion: eligible,
    mandatory_requirements_total: mandatoryReqs.length,
    mandatory_requirements_satisfied:
      mandatoryReqs.length - unsatisfiedMandatory.length,
    unmapped_mandatory_requirements: unmappedMandatory.map((r) => ({
      id: r.id,
      title: r.title,
    })),
    unsatisfied_mandatory_requirements: unsatisfiedMandatory.map((r) => ({
      id: r.id,
      title: r.title,
    })),
    incomplete_required_tasks: incompleteTasks.map((t) => ({ id: t.id, title: t.title })),
    blocked_or_review_mandatory_tasks: blockedTasks.map((t) => ({ id: t.id, title: t.title })),
    overdue_tasks: [],
    unverified_acceptance_criteria: [],
    failed_verification_checks: [],
    unsatisfied_milestones: [],
    unsatisfied_dependencies: [],
    blocking_reasons: blockingReasons,
  };
}

function recomputeProject(store: OfflineStore, projectId: number): Project {
  const project = store.projects.find((p) => p.id === projectId)!;
  const tasks = store.tasks.filter((t) => t.project_id === projectId);
  const reqs = store.requirements.filter((r) => r.project_id === projectId);

  for (const t of tasks) {
    t.evidence_items = store.evidence.filter((e) => e.task_id === t.id);
  }

  for (const r of reqs) {
    const linked = tasks.filter((t) => (t.requirement_ids || []).includes(r.id));
    r.linked_task_ids = linked.map((t) => t.id);
    if (linked.length === 0) {
      r.status = 'Unmapped';
    } else if (linked.every((t) => t.status === 'Done')) {
      r.status = 'Satisfied';
    } else {
      r.status = 'In Progress';
    }
  }

  const gate = computeGate(store, projectId);
  project.total_tasks = gate.total_tasks;
  project.completed_tasks = gate.completed_tasks;
  project.blocked_tasks = tasks.filter((t) => t.status === 'Blocked').length;
  project.progress_percentage = gate.progress_percentage;
  project.eligible_for_completion = gate.eligible_for_completion;
  project.readiness_status =
    project.status === 'Completed' ? 'Completed' : gate.readiness_status;
  project.updated_at = nowIso();
  return project;
}

export function handleOfflineRequest<T>(path: string, options: RequestInit = {}): T {
  const store = loadStore();
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const cleanPath = path.split('?')[0];

  if (cleanPath === '/health') {
    return { status: 'healthy', database: 'local-storage', timestamp: nowIso() } as unknown as T;
  }
  if (cleanPath === '/health/ai') {
    return {
      status: 'unavailable',
      ollama_reachable: false,
      model_ready: false,
      configured_model: 'deterministic-engine',
      ollama_base_url: 'http://localhost:11434',
      available_models: [],
      fallback_mode: 'deterministic_rules_active',
      error: null,
      timestamp: nowIso(),
    } as unknown as T;
  }

  if (cleanPath === '/auth/login' || cleanPath === '/auth/register') {
    const now = nowIso();
    const email = String(body.email || 'pilot@projectpilot.ai').trim().toLowerCase();
    let existingUser = store.users.find((u) => u.email.toLowerCase() === email);
    if (!existingUser) {
      existingUser = {
        id: store.users.length + 1,
        email,
        full_name: String(body.full_name || email.split('@')[0]).trim(),
        created_at: now,
        updated_at: now,
      };
      store.users.push(existingUser);
    }
    store.currentUserId = existingUser.id;
    saveStore(store);
    const response: TokenResponse = {
      access_token: `offline-token-${existingUser.id}-${Date.now()}`,
      token_type: 'bearer',
      user: existingUser,
    };
    return response as unknown as T;
  }

  if (cleanPath === '/auth/me') {
    const user = store.users.find((u) => u.id === store.currentUserId) || store.users[0];
    return user as unknown as T;
  }

  if (cleanPath === '/auth/logout') {
    return { message: 'Logged out' } as unknown as T;
  }

  if (cleanPath === '/dashboard') {
    store.projects.forEach((p) => recomputeProject(store, p.id));
    saveStore(store);
    const summary: DashboardSummary = {
      total_projects: store.projects.length,
      projects_in_progress: store.projects.filter((p) => p.status === 'In Progress').length,
      projects_eligible_for_completion: store.projects.filter((p) => p.eligible_for_completion)
        .length,
      projects_with_blockers: store.projects.filter((p) => p.blocked_tasks > 0).length,
      overdue_tasks_count: 0,
      upcoming_deadlines: [],
      projects: store.projects,
      recent_activity: store.activity.slice(0, 15),
      latest_assessments: store.assessments.slice(0, 5),
    };
    return summary as unknown as T;
  }

  if (cleanPath === '/projects' && method === 'GET') {
    store.projects.forEach((p) => recomputeProject(store, p.id));
    saveStore(store);
    return store.projects as unknown as T;
  }

  if ((cleanPath === '/projects' || cleanPath === '/projects/demo') && method === 'POST') {
    const now = nowIso();
    const newId = store.projects.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const newProj: Project = {
      id: newId,
      owner_id: store.currentUserId,
      name: body.name || `Cockpit Project #${newId}`,
      description: body.description || 'Structured project with deterministic quality gates.',
      objectives: body.objectives || 'Complete all mandatory requirements and tasks.',
      completion_criteria: body.completion_criteria || '100% required tasks Done.',
      status: body.status || 'In Progress',
      priority: body.priority || 'High',
      start_date: body.start_date || now.slice(0, 10),
      deadline: body.deadline || '2026-12-31',
      progress_percentage: 0,
      readiness_status: 'In Progress',
      eligible_for_completion: false,
      total_tasks: 0,
      completed_tasks: 0,
      blocked_tasks: 0,
      overdue_tasks: 0,
      created_at: now,
      updated_at: now,
      completed_at: null,
    };
    store.projects.unshift(newProj);
    saveStore(store);
    return newProj as unknown as T;
  }

  const projMatch = cleanPath.match(/^\/projects\/(\d+)$/);
  if (projMatch) {
    const pid = Number(projMatch[1]);
    if (method === 'GET') {
      const p = recomputeProject(store, pid);
      saveStore(store);
      return p as unknown as T;
    }
    if (method === 'PATCH') {
      const p = store.projects.find((item) => item.id === pid)!;
      Object.assign(p, body, { updated_at: nowIso() });
      recomputeProject(store, pid);
      saveStore(store);
      return p as unknown as T;
    }
    if (method === 'DELETE') {
      store.projects = store.projects.filter((item) => item.id !== pid);
      saveStore(store);
      return undefined as unknown as T;
    }
  }

  const gateMatch = cleanPath.match(/^\/projects\/(\d+)\/gate$/);
  if (gateMatch) {
    const pid = Number(gateMatch[1]);
    recomputeProject(store, pid);
    const gate = computeGate(store, pid);
    const recs: NextStepRecommendation[] = gate.blocking_reasons.map((r, idx) => ({
      task_id: null,
      title: r,
      priority: idx === 0 ? 'Critical' : 'High',
      why_it_matters: 'Required to unlock formal project completion.',
      action_type: 'resolve_blocker',
    }));
    return { gate, recommended_next_steps: recs } as unknown as T;
  }

  const actMatch = cleanPath.match(/^\/projects\/(\d+)\/activity$/);
  if (actMatch) {
    const pid = Number(actMatch[1]);
    return store.activity.filter((a) => a.project_id === pid) as unknown as T;
  }

  const reqsMatch = cleanPath.match(/^\/projects\/(\d+)\/requirements$/);
  if (reqsMatch) {
    const pid = Number(reqsMatch[1]);
    if (method === 'GET') {
      recomputeProject(store, pid);
      return store.requirements.filter((r) => r.project_id === pid) as unknown as T;
    }
    if (method === 'POST') {
      const now = nowIso();
      const id = store.requirements.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      const req: Requirement = {
        id,
        project_id: pid,
        title: body.title || 'New Requirement',
        description: body.description || '',
        is_mandatory: body.is_mandatory ?? true,
        acceptance_criteria: body.acceptance_criteria || '',
        verification_notes: body.verification_notes || '',
        status: 'Unmapped',
        linked_task_ids: [],
        created_at: now,
        updated_at: now,
      };
      store.requirements.push(req);
      recomputeProject(store, pid);
      saveStore(store);
      return req as unknown as T;
    }
  }

  const msMatch = cleanPath.match(/^\/projects\/(\d+)\/milestones$/);
  if (msMatch) {
    const pid = Number(msMatch[1]);
    if (method === 'GET') {
      return store.milestones.filter((m) => m.project_id === pid) as unknown as T;
    }
    if (method === 'POST') {
      const now = nowIso();
      const id = store.milestones.reduce((m, item) => Math.max(m, item.id), 0) + 1;
      const ms: Milestone = {
        id,
        project_id: pid,
        title: body.title || 'New Milestone',
        description: body.description || '',
        due_date: body.due_date || null,
        is_required: body.is_required ?? true,
        status: 'In Progress',
        computed_progress: 0,
        total_tasks: 0,
        completed_tasks: 0,
        created_at: now,
        updated_at: now,
      };
      store.milestones.push(ms);
      saveStore(store);
      return ms as unknown as T;
    }
  }

  const tasksMatch = cleanPath.match(/^\/projects\/(\d+)\/tasks$/);
  if (tasksMatch) {
    const pid = Number(tasksMatch[1]);
    if (method === 'GET') {
      recomputeProject(store, pid);
      return store.tasks.filter((t) => t.project_id === pid) as unknown as T;
    }
    if (method === 'POST') {
      const id = store.tasks.reduce((m, item) => Math.max(m, item.id), 0) + 1;
      const now = nowIso();
      const t: Task = {
        id,
        project_id: pid,
        milestone_id: body.milestone_id || null,
        title: body.title || 'New Task',
        description: body.description || '',
        status: body.status || 'To Do',
        priority: body.priority || 'Medium',
        weight: Number(body.weight) || 1,
        estimated_hours: Number(body.estimated_hours) || 2,
        actual_hours: Number(body.actual_hours) || 0,
        due_date: body.due_date || null,
        notes: body.notes || '',
        requirement_ids: body.requirement_ids || [],
        dependency_ids: body.dependency_ids || [],
        incomplete_prerequisite_ids: [],
        evidence_items: [],
        completed_at: body.status === 'Done' ? now : null,
        created_at: now,
        updated_at: now,
      };
      store.tasks.push(t);
      recomputeProject(store, pid);
      saveStore(store);
      return t as unknown as T;
    }
  }

  const singleTaskMatch = cleanPath.match(/^\/tasks\/(\d+)$/);
  if (singleTaskMatch) {
    const tid = Number(singleTaskMatch[1]);
    const task = store.tasks.find((t) => t.id === tid)!;
    if (method === 'PATCH') {
      Object.assign(task, body, {
        updated_at: nowIso(),
        completed_at: body.status === 'Done' ? nowIso() : task.completed_at,
      });
      recomputeProject(store, task.project_id);
      saveStore(store);
      return task as unknown as T;
    }
    if (method === 'DELETE') {
      store.tasks = store.tasks.filter((t) => t.id !== tid);
      recomputeProject(store, task.project_id);
      saveStore(store);
      return undefined as unknown as T;
    }
  }

  const evProjMatch = cleanPath.match(/^\/projects\/(\d+)\/evidence$/);
  if (evProjMatch) {
    const pid = Number(evProjMatch[1]);
    const taskIds = store.tasks.filter((t) => t.project_id === pid).map((t) => t.id);
    return store.evidence.filter((e) => taskIds.includes(e.task_id)) as unknown as T;
  }

  const evTaskMatch = cleanPath.match(/^\/tasks\/(\d+)\/evidence$/);
  if (evTaskMatch && method === 'POST') {
    const tid = Number(evTaskMatch[1]);
    const task = store.tasks.find((t) => t.id === tid)!;
    const id = store.evidence.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    const now = nowIso();
    const ev: Evidence = {
      id,
      task_id: tid,
      evidence_type: body.evidence_type || 'verification_note',
      description: body.description || 'Verification Evidence',
      uri: body.uri || '',
      verification_status: 'verified',
      verified_at: now,
      created_at: now,
    };
    store.evidence.push(ev);
    recomputeProject(store, task.project_id);
    saveStore(store);
    return ev as unknown as T;
  }

  const assessMatch = cleanPath.match(/^\/projects\/(\d+)\/assessments$/);
  if (assessMatch) {
    const pid = Number(assessMatch[1]);
    if (method === 'GET') {
      return store.assessments.filter((a) => a.project_id === pid) as unknown as T;
    }
    if (method === 'POST') {
      const p = recomputeProject(store, pid);
      const gate = computeGate(store, pid);
      const id = store.assessments.reduce((m, a) => Math.max(m, a.id), 0) + 1;
      const now = nowIso();
      const newAssessment: Assessment = {
        id,
        project_id: pid,
        progress_snapshot: p.progress_percentage,
        readiness_status: gate.readiness_status,
        ai_summary: gate.eligible_for_completion
          ? 'All deterministic completion gates and mandatory requirements are satisfied.'
          : `Project is at ${p.progress_percentage}% weighted completion. Resolve remaining gate items to unlock formal completion.`,
        findings: {
          overall_summary: gate.eligible_for_completion
            ? 'All deterministic completion gates and mandatory requirements are satisfied.'
            : `Project is at ${p.progress_percentage}% weighted completion. Resolve remaining gate items to unlock formal completion.`,
          recorded_progress_percentage: p.progress_percentage,
          readiness_status: gate.readiness_status,
          eligible_for_completion: gate.eligible_for_completion,
          completed_work: [],
          remaining_tasks: gate.incomplete_required_tasks,
          missing_requirements: gate.unsatisfied_mandatory_requirements,
          blocked_or_overdue_tasks: gate.blocked_or_review_mandatory_tasks,
          unverified_acceptance_criteria: [],
          failed_verification_checks: [],
          recommended_next_actions: gate.blocking_reasons.map((r) => ({
            task_id: null,
            title: r,
            priority: 'High',
            why_it_matters: 'Required for completion gate.',
            action_type: 'resolve_blocker',
          })),
          limitations_or_uncertainties: [],
          blocking_reasons: gate.blocking_reasons,
          ai_used: false,
          ai_error: null,
        },
        state_snapshot: {
          progress_percentage: p.progress_percentage,
          completed_tasks: p.completed_tasks,
          total_tasks: p.total_tasks,
        },
        model_name: 'deterministic-fallback-engine',
        is_stale: false,
        created_at: now,
        invalidated_at: null,
      };
      store.assessments.unshift(newAssessment);
      recomputeProject(store, pid);
      saveStore(store);
      return newAssessment as unknown as T;
    }
  }

  const completeMatch = cleanPath.match(/^\/projects\/(\d+)\/complete$/);
  if (completeMatch && method === 'POST') {
    const pid = Number(completeMatch[1]);
    const p = recomputeProject(store, pid);
    p.status = 'Completed';
    p.readiness_status = 'Completed';
    p.completed_at = nowIso();
    saveStore(store);
    return p as unknown as T;
  }

  return {} as unknown as T;
}
