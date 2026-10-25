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

const STORAGE_KEY = 'projectpilot_offline_store_v1';

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
  };

  const demoProject: Project = {
    id: 1,
    owner_id: 1,
    name: 'Autonomous Flight Telemetry Core',
    description:
      'Real-time 3D telemetry ingestion, deterministic flight safety cutoff verification, and AI readiness gating.',
    objectives: 'Achieve <5ms packet latency and 100% mandatory safety gate verification.',
    category: 'Aerospace & AI Systems',
    target_completion_date: '2026-12-15',
    status: 'In Progress',
    progress_percentage: 62.5,
    total_tasks: 4,
    completed_tasks: 2,
    blocked_tasks: 0,
    total_requirements: 2,
    covered_requirements: 2,
    completed_weight: 10,
    total_weight: 16,
    can_mark_complete: false,
    confirmed_by_user: false,
    completion_notes: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  const requirements: Requirement[] = [
    {
      id: 1,
      project_id: 1,
      code: 'REQ-01',
      title: 'Sub-5ms Telemetry Stream Processing',
      description: 'Ingest and validate high-frequency sensor frames with zero dropped packets.',
      category: 'Performance',
      priority: 'Critical',
      is_mandatory: true,
      acceptance_criteria: 'Sustained 1,000 Hz frame validation under load.',
      is_covered: true,
      linked_task_ids: [1, 2],
      completed_task_count: 2,
      total_task_count: 2,
      created_at: now,
    },
    {
      id: 2,
      project_id: 1,
      code: 'REQ-02',
      title: 'Deterministic Emergency Cutoff Interlock',
      description: 'Hardware-in-the-loop safety cutoff must trigger within 2ms of anomaly detection.',
      category: 'Safety',
      priority: 'Critical',
      is_mandatory: true,
      acceptance_criteria: 'Verified cutoff log attached as task evidence.',
      is_covered: true,
      linked_task_ids: [3, 4],
      completed_task_count: 0,
      total_task_count: 2,
      created_at: now,
    },
  ];

  const milestones: Milestone[] = [
    {
      id: 1,
      project_id: 1,
      name: 'Phase 1: Core Telemetry Pipeline',
      description: 'Complete ingestion engine and ring-buffer validation.',
      sequence_order: 1,
      target_date: '2026-11-15',
      status: 'Completed',
      progress_percentage: 100,
      total_tasks: 2,
      completed_tasks: 2,
      created_at: now,
    },
    {
      id: 2,
      project_id: 1,
      name: 'Phase 2: Safety Interlock Certification',
      description: 'Verify emergency cutoff handler and attach formal test logs.',
      sequence_order: 2,
      target_date: '2026-12-15',
      status: 'In Progress',
      progress_percentage: 0,
      total_tasks: 2,
      completed_tasks: 0,
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
      is_required_for_completion: true,
      is_blocked: false,
      blocker_reason: null,
      acceptance_criteria: 'Passes 10M frame stress test.',
      due_date: '2026-11-05',
      assignee: 'Alex Mercer',
      requirement_ids: [1],
      evidence_count: 1,
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
      is_required_for_completion: true,
      is_blocked: false,
      blocker_reason: null,
      acceptance_criteria: 'Phase drift < 0.05 deg.',
      due_date: '2026-11-12',
      assignee: 'Alex Mercer',
      requirement_ids: [1],
      evidence_count: 1,
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
      is_required_for_completion: true,
      is_blocked: false,
      blocker_reason: null,
      acceptance_criteria: 'Verified under fault injection.',
      due_date: '2026-12-01',
      assignee: 'Alex Mercer',
      requirement_ids: [2],
      evidence_count: 0,
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
      is_required_for_completion: true,
      is_blocked: false,
      blocker_reason: null,
      acceptance_criteria: 'Report linked in task evidence.',
      due_date: '2026-12-10',
      assignee: 'Alex Mercer',
      requirement_ids: [2],
      evidence_count: 0,
      completed_at: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const evidence: Evidence[] = [
    {
      id: 1,
      project_id: 1,
      task_id: 1,
      evidence_type: 'Test Report',
      title: '10M Frame Stress Benchmark Log',
      content_or_url: 'https://telemetry.projectpilot.local/reports/bench-01',
      is_verified: true,
      uploaded_by: 'Alex Mercer',
      created_at: now,
    },
  ];

  const assessments: Assessment[] = [
    {
      id: 1,
      project_id: 1,
      readiness_status: 'Nearly Ready',
      confidence_score: 84,
      summary:
        'Phase 1 telemetry ingestion is complete and verified. 2 required tasks in Phase 2 remain before the completion gate unlocks.',
      missing_items: [
        'Complete required task: Implement emergency cutoff signal handler',
        'Complete required task: Attach hardware-in-the-loop verification report',
      ],
      blocker_analysis: 'No active blockers detected.',
      requirement_Preset_gaps: ['REQ-02 has 2 incomplete linked tasks.'],
      recommended_next_steps: [
        'Finish "Implement emergency cutoff signal handler" (weight 4.0)',
        'Attach verification evidence for Phase 2 safety certification',
      ],
      evidence_gaps: [],
       deterministic_metrics_snapshot: {
        progress_percentage: 62.5,
        completed_tasks: 2,
        total_tasks: 4,
        blocked_tasks: 0,
      },
      model_used: 'deterministic-fallback-engine',
      is_fallback: true,
      is_outdated: false,
      created_at: now,
    } as unknown as Assessment,
  ];

  const activity: ActivityLog[] = [
    {
      id: 1,
      project_id: 1,
      actor: 'Alex Mercer',
      action_type: 'PROJECT_INITIALIZED',
      message: 'Initialized Autonomous Flight Telemetry Core workspace.',
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

function recomputeProject(store: OfflineStore, projectId: number): Project {
  const project = store.projects.find((p) => p.id === projectId)!;
  const tasks = store.tasks.filter((t) => t.project_id === projectId);
  const reqs = store.requirements.filter((r) => r.project_id === projectId);
  const evs = store.evidence.filter((e) => e.project_id === projectId);

  for (const t of tasks) {
    t.evidence_count = evs.filter((e) => e.task_id === t.id).length;
  }

  for (const r of reqs) {
    const linked = tasks.filter((t) => (t.requirement_ids || []).includes(r.id));
    r.linked_task_ids = linked.map((t) => t.id);
    r.total_task_count = linked.length;
    r.completed_task_count = linked.filter((t) => t.status === 'Done').length;
    r.is_covered = linked.length > 0 && r.completed_task_count === linked.length;
  }

  const totalWeight = tasks.reduce((sum, t) => sum + (Number(t.weight) || 1), 0);
  const completedWeight = tasks
    .filter((t) => t.status === 'Done')
    .reduce((sum, t) => sum + (Number(t.weight) || 1), 0);

  project.total_tasks = tasks.length;
  project.completed_tasks = tasks.filter((t) => t.status === 'Done').length;
  project.blocked_tasks = tasks.filter((t) => t.is_blocked || t.status === 'Blocked').length;
  project.total_requirements = reqs.length;
  project.covered_requirements = reqs.filter((r) => r.is_covered).length;
  project.total_weight = totalWeight;
  project.completed_weight = completedWeight;
  project.progress_percentage =
    totalWeight > 0 ? Number(((completedWeight / totalWeight) * 100).toFixed(1)) : 0;

  const gate = computeGate(store, projectId);
  project.can_mark_complete = gate.can_mark_complete;
  project.updated_at = nowIso();
  return project;
}

function computeGate(store: OfflineStore, projectId: number): CompletionGateResult {
  const project = store.projects.find((p) => p.id === projectId);
  const tasks = store.tasks.filter((t) => t.project_id === projectId);
  const reqs = store.requirements.filter((r) => r.project_id === projectId);
  const assessments = store.assessments.filter((a) => a.project_id === projectId);

  const blockingReasons: string[] = [];
  if (tasks.length === 0) {
    blockingReasons.push('Project must have at least 1 task.');
  }
  const incompleteRequired = tasks.filter(
    (t) => t.is_required_for_completion && t.status !== 'Done'
  );
  if (incompleteRequired.length > 0) {
    blockingReasons.push(`${incompleteRequired.length} required task(s) are not yet Done.`);
  }
  const blocked = tasks.filter((t) => t.is_blocked || t.status === 'Blocked');
  if (blocked.length > 0) {
    blockingReasons.push(`${blocked.length} task(s) are currently Blocked.`);
  }
  const mandatoryUncovered = reqs.filter((r) => r.is_mandatory && !r.is_covered);
  if (mandatoryUncovered.length > 0) {
    blockingReasons.push(
      `${mandatoryUncovered.length} mandatory requirement(s) are not fully covered by Done tasks.`
    );
  }
  const latestAssessment = assessments[0];
  if (!latestAssessment || latestAssessment.is_outdated) {
    blockingReasons.push('A current (non-outdated) AI Readiness Assessment is required.');
  }

  return {
    can_mark_complete: blockingReasons.length === 0,
    progress_percentage: project?.progress_percentage ?? 0,
    has_at_least_one_task: tasks.length > 0,
    all_required_tasks_done: tasks.length > 0 && incompleteRequired.length === 0,
    zero_blocked_tasks: blocked.length === 0,
    all_mandatory_requirements_covered: mandatoryUncovered.length === 0,
    has_current_assessment: Boolean(latestAssessment && !latestAssessment.is_outdated),
    blocking_reasons: blockingReasons,
    incomplete_required_tasks: incompleteRequired.map((t) => ({ id: t.id, title: t.title })),
    uncovered_mandatory_requirements: mandatoryUncovered.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
    })),
  };
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
    const email = String(body.email || 'pilot@projectpilot.ai').trim().toLowerCase();
    let user = store.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      user = {
        id: store.users.length + 1,
        email,
        full_name: body.full_name?.trim() || email.split('@')[0],
        created_at: nowIso(),
      };
      store.users.push(user);
    }
    store.currentUserId = user.id;
    saveStore(store);
    const response: TokenResponse = {
      access_token: `offline-token-${user.id}-${Date.now()}`,
      token_type: 'bearer',
      user,
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
      completed_projects: store.projects.filter((p) => p.status === 'Completed').length,
      in_progress_projects: store.projects.filter((p) => p.status === 'In Progress').length,
      at_risk_or_blocked_projects: store.projects.filter(
        (p) => p.status === 'At Risk' || p.blocked_tasks > 0
      ).length,
      overall_completion_rate:
        store.projects.length > 0
          ? Number(
              (
                store.projects.reduce((s, p) => s + p.progress_percentage, 0) /
                store.projects.length
              ).toFixed(1)
            )
          : 0,
      projects: store.projects,
      recent_activity: store.activity.slice(0, 15),
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
      name: body.name || `Demo Cockpit Project #${newId}`,
      description: body.description || 'Structured project with deterministic quality gates.',
      objectives: body.objectives || 'Complete all mandatory requirements and tasks.',
      category: body.category || 'Engineering',
      target_completion_date: body.target_completion_date || '2026-12-31',
      status: body.status || 'In Progress',
      progress_percentage: 0,
      total_tasks: 0,
      completed_tasks: 0,
      blocked_tasks: 0,
      total_requirements: 0,
      covered_requirements: 0,
      completed_weight: 0,
      total_weight: 0,
      can_mark_complete: false,
      confirmed_by_user: false,
      completion_notes: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
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
    const recs: NextStepRecommendation[] = gate.blocking_reasons.map((r, i) => ({
      priority_rank: i + 1,
      category: 'Gate Blocker',
      action: r,
      impact: 'Required to unlock project completion.',
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
      const id = store.requirements.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      const req: Requirement = {
        id,
        project_id: pid,
        code: body.code || `REQ-0${id}`,
        title: body.title || 'New Requirement',
        description: body.description || '',
        category: body.category || 'Functional',
        priority: body.priority || 'High',
        is_mandatory: body.is_mandatory ?? true,
        acceptance_criteria: body.acceptance_criteria || '',
        is_covered: false,
        linked_task_ids: [],
        completed_task_count: 0,
        total_task_count: 0,
        created_at: nowIso(),
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
      const id = store.milestones.reduce((m, item) => Math.max(m, item.id), 0) + 1;
      const ms: Milestone = {
        id,
        project_id: pid,
        name: body.name || 'New Milestone',
        description: body.description || '',
        sequence_order: body.sequence_order || id,
        target_date: body.target_date || null,
        status: 'In Progress',
        progress_percentage: 0,
        total_tasks: 0,
        completed_tasks: 0,
        created_at: nowIso(),
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
        is_required_for_completion: body.is_required_for_completion ?? true,
        is_blocked: Boolean(body.is_blocked),
        blocker_reason: body.blocker_reason || null,
        acceptance_criteria: body.acceptance_criteria || '',
        due_date: body.due_date || null,
        assignee: body.assignee || 'Alex Mercer',
        requirement_ids: body.requirement_ids || [],
        evidence_count: 0,
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
    return store.evidence.filter((e) => e.project_id === pid) as unknown as T;
  }

  const evTaskMatch = cleanPath.match(/^\/tasks\/(\d+)\/evidence$/);
  if (evTaskMatch && method === 'POST') {
    const tid = Number(evTaskMatch[1]);
    const task = store.tasks.find((t) => t.id === tid)!;
    const id = store.evidence.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    const ev: Evidence = {
      id,
      project_id: task.project_id,
      task_id: tid,
      evidence_type: body.evidence_type || 'Link',
      title: body.title || 'Verification Evidence',
      content_or_url: body.content_or_url || '',
      is_verified: true,
      uploaded_by: 'Alex Mercer',
      created_at: nowIso(),
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
      const newAssessment: Assessment = {
        id,
        project_id: pid,
        readiness_status: gate.can_mark_complete
          ? 'Ready for Completion'
          : p.progress_percentage >= 50
            ? 'Nearly Ready'
            : 'In Progress',
        confidence_score: Math.min(100, Math.round(p.progress_percentage + 20)),
        summary: gate.can_mark_complete
          ? 'All deterministic completion gates and mandatory requirements are satisfied.'
          : `Project is at ${p.progress_percentage}% weighted completion. Resolve remaining gate items to unlock formal completion.`,
        missing_items: gate.blocking_reasons,
        blocker_analysis:
          p.blocked_tasks > 0
            ? `${p.blocked_tasks} blocked task(s) require immediate resolution.`
            : 'Zero blocked tasks detected.',
        requirement_coverage_gaps: gate.uncovered_mandatory_requirements.map(
          (r) => `${r.code}: ${r.title}`
        ),
        recommended_next_steps:
          gate.blocking_reasons.length > 0
            ? gate.blocking_reasons
            : ['Confirm formal project completion in the Readiness Gate panel.'],
        evidence_gaps: [],
        deterministic_metrics_snapshot: {
          progress_percentage: p.progress_percentage,
          completed_tasks: p.completed_tasks,
          total_tasks: p.total_tasks,
          blocked_tasks: p.blocked_tasks,
        },
        model_used: 'deterministic-fallback-engine',
        is_fallback: true,
        is_outdated: false,
        created_at: nowIso(),
      } as unknown as Assessment;
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
    p.confirmed_by_user = true;
    p.completion_notes = body.completion_notes || 'Completed';
    p.completed_at = nowIso();
    saveStore(store);
    return p as unknown as T;
  }

  return {} as unknown as T;
}
