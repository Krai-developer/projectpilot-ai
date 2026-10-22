import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileCheck2,
  Kanban,
  ListFilter,
  Milestone as MilestoneIcon,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import {
  AITaskGenerationResponse,
  Assessment,
  CompletionGateResult,
  Evidence,
  EvidenceType,
  Milestone,
  NextStepRecommendation,
  PriorityLevel,
  Project,
  ProjectStatus,
  Requirement,
  RequirementStatus,
  Task,
  TaskStatus,
  VerificationStatus,
} from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

type TabKey = 'overview' | 'requirements' | 'tasks' | 'milestones' | 'evidence' | 'assessments';

const TASK_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Blocked', 'In Review', 'Done'];

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const pid = Number(projectId);

  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const [project, setProject] = useState<Project | null>(null);
  const [gate, setGate] = useState<CompletionGateResult | null>(null);
  const [nextSteps, setNextSteps] = useState<NextStepRecommendation[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Task view & filter state
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'kanban'>('list');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('');
  const [taskSearch, setTaskSearch] = useState<string>('');

  // Requirement form state
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqMandatory, setReqMandatory] = useState(true);
  const [reqCriteria, setReqCriteria] = useState('');

  // Task form state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<PriorityLevel>('Medium');
  const [taskWeight, setTaskWeight] = useState('2.0');
  const [taskEstHours, setTaskEstHours] = useState('4.0');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskMilestoneId, setTaskMilestoneId] = useState<string>('');
  const [taskReqIds, setTaskReqIds] = useState<number[]>([]);
  const [taskDepIds, setTaskDepIds] = useState<number[]>([]);

  // Milestone form state
  const [msTitle, setMsTitle] = useState('');
  const [msDesc, setMsDesc] = useState('');
  const [msDueDate, setMsDueDate] = useState('');
  const [msRequired, setMsRequired] = useState(true);

  // Evidence form state
  const [evTaskId, setEvTaskId] = useState<string>('');
  const [evType, setEvType] = useState<EvidenceType>('test_result');
  const [evDesc, setEvDesc] = useState('');
  const [evUri, setEvUri] = useState('');
  const [evStatus, setEvStatus] = useState<VerificationStatus>('pending');

  // AI Assessment & Task Generation state
  const [runningAssessment, setRunningAssessment] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiFocusArea, setAiFocusArea] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AITaskGenerationResponse | null>(null);
  const [approvingAI, setApprovingAI] = useState(false);

  // Complete Project Confirmation Modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completingProject, setCompletingProject] = useState(false);

  // Edit Project Modal state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editObjectives, setEditObjectives] = useState('');
  const [editCriteria, setEditCriteria] = useState('');

  const loadAll = async () => {
    if (!pid) return;
    setError(null);
    try {
      const [projData, gateData, reqData, taskData, msData, evData, assessData] = await Promise.all([
        api.getProject(pid),
        api.getProjectGate(pid),
        api.getRequirements(pid),
        api.getTasks(pid),
        api.getMilestones(pid),
        api.getProjectEvidence(pid),
        api.getProjectAssessments(pid),
      ]);
      setProject(projData);
      setGate(gateData.gate);
      setNextSteps(gateData.recommended_next_steps);
      setRequirements(reqData);
      setTasks(taskData);
      setMilestones(msData);
      setEvidenceList(evData);
      setAssessments(assessData);
      if (!evTaskId && taskData.length > 0) {
        setEvTaskId(String(taskData[0].id));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load project workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [pid]);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleRunAssessment = async () => {
    setRunningAssessment(true);
    setError(null);
    setBannerMessage(null);
    try {
      const report = await api.runAssessment(pid);
      await loadAll();
      switchTab('assessments');
      setBannerMessage(
        report.findings.ai_used
          ? `Assessment completed with local model (${report.model_name}).`
          : 'Deterministic completion assessment recorded (local Ollama offline fallback).'
      );
    } catch (err: any) {
      setError(err?.message || 'Assessment failed.');
    } finally {
      setRunningAssessment(false);
    }
  };

  const handleProjectStatusChange = async (newStatus: ProjectStatus) => {
    setError(null);
    try {
      await api.updateProject(pid, { status: newStatus });
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Invalid status transition.');
    }
  };

  const handleUpdateProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.updateProject(pid, {
        name: editName.trim(),
        description: editDesc.trim(),
        objectives: editObjectives.trim(),
        completion_criteria: editCriteria.trim(),
      });
      setShowEditProjectModal(false);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to update project.');
    }
  };

  const handleCompleteProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCompletingProject(true);
    try {
      await api.completeProject(pid, {
        confirm_completion: confirmCheck,
        completion_notes: completionNotes.trim(),
      });
      setShowCompleteModal(false);
      setConfirmCheck(false);
      setCompletionNotes('');
      setBannerMessage('Project officially marked as Completed.');
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Project completion rejected by completion gate.');
    } finally {
      setCompletingProject(false);
    }
  };

  // Requirement handlers
  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    setError(null);
    try {
      await api.createRequirement(pid, {
        title: reqTitle.trim(),
        description: reqDesc.trim(),
        is_mandatory: reqMandatory,
        acceptance_criteria: reqCriteria.trim(),
        status: 'Unmapped',
      });
      setReqTitle('');
      setReqDesc('');
      setReqCriteria('');
      setReqMandatory(true);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to add requirement.');
    }
  };

  const handleRequirementStatusChange = async (reqId: number, status: RequirementStatus) => {
    setError(null);
    try {
      await api.updateRequirement(reqId, { status });
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to update requirement status.');
    }
  };

  const handleDeleteRequirement = async (reqId: number) => {
    setError(null);
    try {
      await api.deleteRequirement(reqId);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete requirement.');
    }
  };

  // Task handlers
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setError(null);
    const weightNum = parseFloat(taskWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setError('Task weight must be a positive number greater than 0.');
      return;
    }

    try {
      await api.createTask(pid, {
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        priority: taskPriority,
        weight: weightNum,
        estimated_hours: parseFloat(taskEstHours) || 0,
        due_date: taskDueDate || null,
        milestone_id: taskMilestoneId ? Number(taskMilestoneId) : null,
        requirement_ids: taskReqIds,
        dependency_ids: taskDepIds,
      });
      setTaskTitle('');
      setTaskDesc('');
      setTaskWeight('2.0');
      setTaskEstHours('4.0');
      setTaskDueDate('');
      setTaskMilestoneId('');
      setTaskReqIds([]);
      setTaskDepIds([]);
      setShowTaskModal(false);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to create task.');
    }
  };

  const handleTaskStatusChange = async (taskId: number, status: TaskStatus) => {
    setError(null);
    try {
      await api.updateTask(taskId, { status });
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    setError(null);
    try {
      await api.deleteTask(taskId);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete task.');
    }
  };

  // Milestone handlers
  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    setError(null);
    try {
      await api.createMilestone(pid, {
        title: msTitle.trim(),
        description: msDesc.trim(),
        due_date: msDueDate || null,
        is_required: msRequired,
      });
      setMsTitle('');
      setMsDesc('');
      setMsDueDate('');
      setMsRequired(true);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to create milestone.');
    }
  };

  const handleDeleteMilestone = async (msId: number) => {
    setError(null);
    try {
      await api.deleteMilestone(msId);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete milestone.');
    }
  };

  // Evidence handlers
  const handleCreateEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTaskId || !evDesc.trim()) return;
    setError(null);
    try {
      await api.createEvidence(Number(evTaskId), {
        evidence_type: evType,
        description: evDesc.trim(),
        uri: evUri.trim(),
        verification_status: evStatus,
      });
      setEvDesc('');
      setEvUri('');
      setEvStatus('pending');
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to record evidence.');
    }
  };

  const handleEvidenceStatusChange = async (evidenceId: number, verification_status: VerificationStatus) => {
    setError(null);
    try {
      await api.updateEvidence(evidenceId, { verification_status });
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to update evidence status.');
    }
  };

  const handleDeleteEvidence = async (evidenceId: number) => {
    setError(null);
    try {
      await api.deleteEvidence(evidenceId);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete evidence.');
    }
  };

  // AI Plan Generation handlers
  const handleGenerateAISuggestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingAI(true);
    setError(null);
    try {
      const res = await api.generateTasksWithAI(pid, {
        project_description: project?.description,
        focus_area: aiFocusArea.trim() || undefined,
      });
      setAiSuggestions(res);
    } catch (err: any) {
      setError(err?.message || 'Local Ollama AI task generation failed.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleApproveAISuggestions = async () => {
    if (!aiSuggestions) return;
    setApprovingAI(true);
    setError(null);
    try {
      const result = await api.approveGeneratedPlan(pid, {
        requirements: aiSuggestions.requirements,
        milestones: aiSuggestions.milestones,
        tasks: aiSuggestions.tasks,
      });
      setShowAIModal(false);
      setAiSuggestions(null);
      setBannerMessage(
        `Saved ${result.created_requirements} requirement(s), ${result.created_milestones} milestone(s), and ${result.created_tasks} task(s) (${result.skipped_duplicates} duplicate(s) skipped).`
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to save generated items.');
    } finally {
      setApprovingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (!project || !gate) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
        <p className="font-semibold">Project not found</p>
        {error && <p className="text-xs mt-1">{error}</p>}
      </div>
    );
  }

  const filteredTasks = tasks.filter((t) => {
    if (taskStatusFilter && t.status !== taskStatusFilter) return false;
    if (taskPriorityFilter && t.priority !== taskPriorityFilter) return false;
    if (taskSearch) {
      const q = taskSearch.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Project Header Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.priority} />
              <StatusBadge status={project.status} />
              <StatusBadge status={gate.readiness_status} />
              <button
                type="button"
                onClick={() => {
                  setEditName(project.name);
                  setEditDesc(project.description);
                  setEditObjectives(project.objectives);
                  setEditCriteria(project.completion_criteria);
                  setShowEditProjectModal(true);
                }}
                aria-label="Edit project details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
              {project.description || 'No description set.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="project-status-select" className="sr-only">
              Project Status
            </label>
            <select
              id="project-status-select"
              value={project.status}
              onChange={(e) => handleProjectStatusChange(e.target.value as ProjectStatus)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
            >
              <option value="Planning">Status: Planning</option>
              <option value="In Progress">Status: In Progress</option>
              <option value="Blocked">Status: Blocked</option>
              <option value="Ready for Review">Status: Ready for Review</option>
              {project.status === 'Completed' && <option value="Completed">Status: Completed</option>}
              <option value="Archived">Status: Archived</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 transition"
            >
              <Sparkles className="h-4 w-4" />
              AI Suggest Tasks
            </button>

            <button
              type="button"
              onClick={handleRunAssessment}
              disabled={runningAssessment}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium shadow-sm transition"
            >
              <Bot className="h-4 w-4" />
              {runningAssessment ? 'Assessing...' : 'Assess Project Completion'}
            </button>

            {gate.eligible_for_completion && project.status !== 'Completed' && (
              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete Project
              </button>
            )}
          </div>
        </div>

        {/* Authoritative Weighted Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Authoritative Weighted Progress ({gate.completed_task_weight} / {gate.total_task_weight} weight units •{' '}
              {gate.completed_tasks}/{gate.total_tasks} tasks Done)
            </span>
            <span className="font-mono font-bold text-sm" data-testid="project-progress-value">
              {gate.progress_percentage}%
            </span>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                gate.eligible_for_completion ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, gate.progress_percentage)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Note: Weighted progress measures recorded task completion (100 × completed_weight / total_weight).
            Final completion eligibility requires all mandatory requirements, milestones, and verified evidence checks to pass.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {bannerMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button type="button" onClick={() => setBannerMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 gap-1" role="tablist">
        {(
          [
            { key: 'overview', label: 'Overview' },
            { key: 'requirements', label: `Requirements (${requirements.length})` },
            { key: 'tasks', label: `Tasks (${tasks.length})` },
            { key: 'milestones', label: `Milestones (${milestones.length})` },
            { key: 'evidence', label: `Evidence (${evidenceList.length})` },
            { key: 'assessments', label: `Assessment History (${assessments.length})` },
          ] as Array<{ key: TabKey; label: string }>
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Completion Gate Checklist */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold">Deterministic Completion Gate</h2>
                  <p className="text-xs text-slate-500">
                    All mandatory criteria below must pass before the project becomes Eligible for Completion.
                  </p>
                </div>
                <StatusBadge status={gate.readiness_status} />
              </div>

              {gate.blocking_reasons.length > 0 ? (
                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 mb-4">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" />
                    Remaining Completion Blockers ({gate.blocking_reasons.length})
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-amber-700 dark:text-amber-300">
                    {gate.blocking_reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-semibold">All Mandatory Completion Gate Checks Passed!</p>
                      <p>This project is eligible for completion confirmation.</p>
                    </div>
                  </div>
                  {project.status !== 'Completed' && (
                    <button
                      type="button"
                      onClick={() => setShowCompleteModal(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      Confirm Completion
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500">Mandatory Requirements Satisfied</p>
                  <p className="text-lg font-bold mt-0.5">
                    {gate.mandatory_requirements_satisfied} / {gate.mandatory_requirements_total}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500">Unmapped Mandatory Requirements</p>
                  <p className="text-lg font-bold mt-0.5 text-rose-600 dark:text-rose-400">
                    {gate.unmapped_mandatory_requirements.length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500">Incomplete Required Tasks</p>
                  <p className="text-lg font-bold mt-0.5">
                    {gate.incomplete_required_tasks.length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500">Unverified Acceptance / Evidence</p>
                  <p className="text-lg font-bold mt-0.5 text-amber-600 dark:text-amber-400">
                    {gate.unverified_acceptance_criteria.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Project Objectives & Completion Criteria */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Objectives
                </h3>
                <p className="text-xs whitespace-pre-line text-slate-700 dark:text-slate-300">
                  {project.objectives || 'No explicit objectives recorded.'}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Completion Criteria
                </h3>
                <p className="text-xs whitespace-pre-line text-slate-700 dark:text-slate-300">
                  {project.completion_criteria || 'Standard deterministic completion gate applies.'}
                </p>
              </div>
            </div>
          </div>

          {/* Next 3 Actionable Steps */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h2 className="text-base font-bold mb-1">Recommended Next 3 Actions</h2>
            <p className="text-xs text-slate-500 mb-4">
              Prioritized by mandatory requirements, dependencies, blockers, and deadlines.
            </p>
            {nextSteps.length === 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                No remaining actions required! Project satisfies all completion criteria.
              </p>
            ) : (
              <div className="space-y-3">
                {nextSteps.map((step, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Step #{i + 1}
                      </span>
                      <StatusBadge status={step.priority} />
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{step.title}</p>
                    <p className="text-slate-600 dark:text-slate-400">{step.why_it_matters}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REQUIREMENTS */}
      {activeTab === 'requirements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-fit">
            <h2 className="text-base font-bold mb-3">Add Requirement</h2>
            <form onSubmit={handleCreateRequirement} className="space-y-3 text-xs">
              <div>
                <label htmlFor="req-title" className="block font-medium mb-1">
                  Requirement Title *
                </label>
                <input
                  id="req-title"
                  type="text"
                  required
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="e.g., Role-Based Access Control"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="req-desc" className="block font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="req-desc"
                  rows={2}
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  placeholder="Detailed specification..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="req-criteria" className="block font-medium mb-1">
                  Acceptance Criteria
                </label>
                <textarea
                  id="req-criteria"
                  rows={2}
                  value={reqCriteria}
                  onChange={(e) => setReqCriteria(e.target.value)}
                  placeholder="How will this requirement be verified?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={reqMandatory}
                  onChange={(e) => setReqMandatory(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium">Mandatory for project completion</span>
              </label>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                Add Requirement
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-3">
            {requirements.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                No requirements added yet. Add at least one mandatory requirement to enable completion tracking.
              </div>
            ) : (
              requirements.map((req) => {
                const isUnmappedMandatory = req.is_mandatory && req.linked_task_ids.length === 0;
                return (
                  <div
                    key={req.id}
                    className={`rounded-xl bg-white dark:bg-slate-900 border p-4 shadow-sm ${
                      isUnmappedMandatory
                        ? 'border-rose-300 dark:border-rose-800'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold">{req.title}</h3>
                          <StatusBadge status={req.is_mandatory ? 'Mandatory' : 'Optional'} />
                          <StatusBadge status={req.status} />
                          {isUnmappedMandatory && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Unmapped Mandatory Requirement
                            </span>
                          )}
                        </div>
                        {req.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {req.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <label htmlFor={`req-status-${req.id}`} className="sr-only">
                          Requirement Status
                        </label>
                        <select
                          id={`req-status-${req.id}`}
                          value={req.status}
                          onChange={(e) =>
                            handleRequirementStatusChange(req.id, e.target.value as RequirementStatus)
                          }
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          <option value="Unmapped">Unmapped</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Needs Verification">Needs Verification</option>
                          <option value="Satisfied">Satisfied</option>
                          <option value="Failed">Failed</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequirement(req.id)}
                          aria-label={`Delete requirement ${req.title}`}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Acceptance Criteria: <strong>{req.acceptance_criteria || 'Not specified'}</strong>
                      </span>
                      <span>Linked Tasks: {req.linked_task_ids.length}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TASKS (List & Kanban Views) */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                aria-label="Filter tasks by status"
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">All Statuses</option>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                aria-label="Filter tasks by priority"
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                <button
                  type="button"
                  onClick={() => setTaskViewMode('list')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
                    taskViewMode === 'list'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ListFilter className="h-3.5 w-3.5" /> List
                </button>
                <button
                  type="button"
                  onClick={() => setTaskViewMode('kanban')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
                    taskViewMode === 'kanban'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Kanban className="h-3.5 w-3.5" /> Kanban
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowTaskModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
              >
                <Plus className="h-4 w-4" /> Add Task
              </button>
            </div>
          </div>

          {taskViewMode === 'list' ? (
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                  No tasks match the current filters.
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm">{task.title}</span>
                        <StatusBadge status={task.priority} />
                        <StatusBadge status={task.status} />
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          Weight: {task.weight}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                        <span>
                          Hours: {task.actual_hours}/{task.estimated_hours}h
                        </span>
                        <span>Linked Reqs: {task.requirement_ids.length}</span>
                        <span>
                          Verified Evidence:{' '}
                          {task.evidence_items.filter((e) => e.verification_status === 'verified').length}
                        </span>
                        {task.incomplete_prerequisite_ids.length > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            Waiting on {task.incomplete_prerequisite_ids.length} prerequisite task(s)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label htmlFor={`task-status-${task.id}`} className="sr-only">
                        Status for {task.title}
                      </label>
                      <select
                        id={`task-status-${task.id}`}
                        value={task.status}
                        onChange={(e) => handleTaskStatusChange(task.id, e.target.value as TaskStatus)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        aria-label={`Delete task ${task.title}`}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {TASK_STATUSES.map((colStatus) => {
                const colTasks = filteredTasks.filter((t) => t.status === colStatus);
                return (
                  <div
                    key={colStatus}
                    className="rounded-xl bg-slate-100/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold">{colStatus}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white dark:bg-slate-800">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-semibold">{t.title}</p>
                            <StatusBadge status={t.priority} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>W: {t.weight}</span>
                            <select
                              value={t.status}
                              onChange={(e) => handleTaskStatusChange(t.id, e.target.value as TaskStatus)}
                              aria-label={`Kanban status for ${t.title}`}
                              className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MILESTONES */}
      {activeTab === 'milestones' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-fit">
            <h2 className="text-base font-bold mb-1">Add Milestone</h2>
            <p className="text-xs text-slate-500 mb-3">
              Milestone status is calculated deterministically from linked tasks, never merely by date.
            </p>
            <form onSubmit={handleCreateMilestone} className="space-y-3 text-xs">
              <div>
                <label htmlFor="ms-title" className="block font-medium mb-1">
                  Milestone Title *
                </label>
                <input
                  id="ms-title"
                  type="text"
                  required
                  value={msTitle}
                  onChange={(e) => setMsTitle(e.target.value)}
                  placeholder="e.g., Beta Security Sign-Off"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="ms-desc" className="block font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="ms-desc"
                  rows={2}
                  value={msDesc}
                  onChange={(e) => setMsDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="ms-due" className="block font-medium mb-1">
                  Target Due Date
                </label>
                <input
                  id="ms-due"
                  type="date"
                  value={msDueDate}
                  onChange={(e) => setMsDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={msRequired}
                  onChange={(e) => setMsRequired(e.target.checked)}
                />
                <span className="font-medium">Required milestone for completion</span>
              </label>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                Create Milestone
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-3">
            {milestones.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                No milestones recorded for this project.
              </div>
            ) : (
              milestones.map((ms) => (
                <div
                  key={ms.id}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <MilestoneIcon className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-sm font-bold">{ms.title}</h3>
                        <StatusBadge status={ms.is_required ? 'Required' : 'Optional'} />
                        <StatusBadge status={ms.status} />
                      </div>
                      {ms.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{ms.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMilestone(ms.id)}
                      aria-label={`Delete milestone ${ms.title}`}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">
                        Linked Tasks: {ms.completed_tasks}/{ms.total_tasks} Done
                      </span>
                      <span className="font-mono font-semibold">{ms.computed_progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600"
                        style={{ width: `${Math.min(100, ms.computed_progress)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: EVIDENCE */}
      {activeTab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-fit">
            <h2 className="text-base font-bold mb-1">Record Task Evidence</h2>
            <p className="text-xs text-slate-500 mb-3">
              Note: A link or description alone is never treated as proof that a test passed until
              its verification status is explicitly marked <strong>verified</strong>.
            </p>
            <form onSubmit={handleCreateEvidence} className="space-y-3 text-xs">
              <div>
                <label htmlFor="ev-task" className="block font-medium mb-1">
                  Target Task *
                </label>
                <select
                  id="ev-task"
                  required
                  value={evTaskId}
                  onChange={(e) => setEvTaskId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">Select a task...</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ev-type" className="block font-medium mb-1">
                  Evidence Type
                </label>
                <select
                  id="ev-type"
                  value={evType}
                  onChange={(e) => setEvType(e.target.value as EvidenceType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="test_result">Test Result</option>
                  <option value="verification_note">Verification Note</option>
                  <option value="documentation_link">Documentation Link</option>
                  <option value="repository_link">Repository Link</option>
                  <option value="deployment_link">Deployment Link</option>
                  <option value="other">Other Reference</option>
                </select>
              </div>
              <div>
                <label htmlFor="ev-desc" className="block font-medium mb-1">
                  Evidence Summary / Test Output *
                </label>
                <textarea
                  id="ev-desc"
                  rows={2}
                  required
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  placeholder="e.g., pytest suite 24 passed, 0 failed"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="ev-uri" className="block font-medium mb-1">
                  Reference URI / Link
                </label>
                <input
                  id="ev-uri"
                  type="text"
                  value={evUri}
                  onChange={(e) => setEvUri(e.target.value)}
                  placeholder="https://... or repo://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="ev-status" className="block font-medium mb-1">
                  Initial Verification Status
                </label>
                <select
                  id="ev-status"
                  value={evStatus}
                  onChange={(e) => setEvStatus(e.target.value as VerificationStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="pending">Pending Verification</option>
                  <option value="verified">Verified</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={tasks.length === 0}
                className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
              >
                Save Evidence
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-3">
            {evidenceList.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                No verification evidence recorded yet.
              </div>
            ) : (
              evidenceList.map((ev) => {
                const parentTask = tasks.find((t) => t.id === ev.task_id);
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-indigo-500" />
                        <span className="font-bold">{parentTask?.title || `Task #${ev.task_id}`}</span>
                        <StatusBadge status={ev.evidence_type.replace(/_/g, ' ')} />
                        <StatusBadge status={ev.verification_status} />
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{ev.description}</p>
                      {ev.uri && (
                        <p className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 break-all">
                          {ev.uri}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label htmlFor={`ev-verify-${ev.id}`} className="sr-only">
                        Verification status
                      </label>
                      <select
                        id={`ev-verify-${ev.id}`}
                        value={ev.verification_status}
                        onChange={(e) =>
                          handleEvidenceStatusChange(ev.id, e.target.value as VerificationStatus)
                        }
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        <option value="pending">pending</option>
                        <option value="verified">verified</option>
                        <option value="failed">failed</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvidence(ev.id)}
                        aria-label="Delete evidence"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ASSESSMENT HISTORY */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Completion Assessment Reports</h2>
              <p className="text-xs text-slate-500">
                Historical snapshots of deterministic readiness gates and local Ollama AI commentary.
                Assessments are automatically marked Stale when project tasks or requirements change.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunAssessment}
              disabled={runningAssessment}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              {runningAssessment ? 'Running...' : 'Run New Assessment'}
            </button>
          </div>

          {assessments.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
              No assessments run yet. Click &ldquo;Assess Project Completion&rdquo; to generate a report.
            </div>
          ) : (
            assessments.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">Assessment #{a.id}</span>
                    <StatusBadge status={a.readiness_status} />
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Progress: {a.progress_snapshot}%
                    </span>
                    {a.is_stale ? (
                      <span
                        data-testid={`assessment-stale-${a.id}`}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      >
                        Stale (Invalidated by Project Changes)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Current Snapshot
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Model: <span className="font-mono">{a.model_name}</span> •{' '}
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Overall Summary</p>
                  <p className="text-slate-600 dark:text-slate-300">{a.findings.overall_summary}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="font-semibold mb-2">
                      Completed Work ({a.findings.completed_work.length})
                    </p>
                    {a.findings.completed_work.length === 0 ? (
                      <p className="text-slate-400">None recorded at snapshot time.</p>
                    ) : (
                      <ul className="list-disc list-inside space-y-1">
                        {a.findings.completed_work.map((cw, i) => (
                          <li key={i}>{cw.title}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="font-semibold mb-2">
                      Remaining Tasks ({a.findings.remaining_tasks.length})
                    </p>
                    {a.findings.remaining_tasks.length === 0 ? (
                      <p className="text-emerald-600">All tasks Done.</p>
                    ) : (
                      <ul className="list-disc list-inside space-y-1">
                        {a.findings.remaining_tasks.map((rt, i) => (
                          <li key={i}>
                            {rt.title} ({rt.status})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="font-semibold mb-2">
                      Missing / Unsatisfied Requirements ({a.findings.missing_requirements.length})
                    </p>
                    {a.findings.missing_requirements.length === 0 ? (
                      <p className="text-emerald-600">All mandatory requirements satisfied.</p>
                    ) : (
                      <ul className="list-disc list-inside space-y-1 text-rose-600 dark:text-rose-400">
                        {a.findings.missing_requirements.map((mr, i) => (
                          <li key={i}>
                            {mr.title}: {mr.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {a.findings.recommended_next_actions.length > 0 && (
                  <div className="text-xs">
                    <p className="font-semibold mb-2">Recommended Next Actions</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {a.findings.recommended_next_actions.map((act, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900"
                        >
                          <p className="font-semibold">{act.title}</p>
                          <p className="text-slate-600 dark:text-slate-400 mt-1">
                            {act.why_it_matters}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {a.findings.limitations_or_uncertainties.length > 0 && (
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-semibold">Limitations & Uncertainties: </span>
                    {a.findings.limitations_or_uncertainties.join(' • ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Add Task */}
      {showTaskModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-task-modal-title"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 id="add-task-modal-title" className="text-base font-bold">
                Create Project Task
              </h2>
              <button type="button" onClick={() => setShowTaskModal(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label htmlFor="task-title-input" className="block font-medium mb-1">
                  Task Title *
                </label>
                <input
                  id="task-title-input"
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Implement token revocation endpoint"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="task-desc-input" className="block font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="task-desc-input"
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="task-prio-input" className="block font-medium mb-1">
                    Priority
                  </label>
                  <select
                    id="task-prio-input"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as PriorityLevel)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="task-weight-input" className="block font-medium mb-1">
                    Weight (&gt;0)
                  </label>
                  <input
                    id="task-weight-input"
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={taskWeight}
                    onChange={(e) => setTaskWeight(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="task-hours-input" className="block font-medium mb-1">
                    Est. Hours
                  </label>
                  <input
                    id="task-hours-input"
                    type="number"
                    step="any"
                    min="0"
                    value={taskEstHours}
                    onChange={(e) => setTaskEstHours(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="task-due-input" className="block font-medium mb-1">
                    Due Date
                  </label>
                  <input
                    id="task-due-input"
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="task-ms-input" className="block font-medium mb-1">
                    Milestone
                  </label>
                  <select
                    id="task-ms-input"
                    value={taskMilestoneId}
                    onChange={(e) => setTaskMilestoneId(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">None</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {requirements.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Link to Requirements</p>
                  <div className="max-h-28 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                    {requirements.map((r) => (
                      <label key={r.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={taskReqIds.includes(r.id)}
                          onChange={(e) =>
                            setTaskReqIds((prev) =>
                              e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                            )
                          }
                        />
                        <span>
                          {r.title} ({r.is_mandatory ? 'Mandatory' : 'Optional'})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {tasks.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Prerequisite Tasks (Dependencies)</p>
                  <div className="max-h-28 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                    {tasks.map((t) => (
                      <label key={t.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={taskDepIds.includes(t.id)}
                          onChange={(e) =>
                            setTaskDepIds((prev) =>
                              e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                            )
                          }
                        />
                        <span>
                          {t.title} ({t.status})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: AI Task & Requirement Generation + Review Interface */}
      {showAIModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto text-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-bold">Local Ollama AI Plan Generator</h2>
              </div>
              <button type="button" onClick={() => setShowAIModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateAISuggestions} className="flex gap-2">
              <input
                type="text"
                value={aiFocusArea}
                onChange={(e) => setAiFocusArea(e.target.value)}
                placeholder="Optional focus area (e.g., Authentication, Testing, API Security)..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={generatingAI}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
              >
                {generatingAI ? 'Querying Ollama...' : 'Generate Suggestions'}
              </button>
            </form>

            {aiSuggestions && (
              <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-slate-500">
                  Review and edit the generated items below before approving them into your project
                  database. Duplicate titles are automatically skipped.
                </p>

                <div>
                  <h3 className="font-bold mb-2">
                    Suggested Requirements ({aiSuggestions.requirements.length})
                  </h3>
                  <div className="space-y-2">
                    {aiSuggestions.requirements.map((r, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <input
                          type="text"
                          value={r.title}
                          onChange={(e) => {
                            const updated = [...aiSuggestions.requirements];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setAiSuggestions({ ...aiSuggestions, requirements: updated });
                          }}
                          className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAiSuggestions({
                              ...aiSuggestions,
                              requirements: aiSuggestions.requirements.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-rose-500 px-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold mb-2">Suggested Tasks ({aiSuggestions.tasks.length})</h3>
                  <div className="space-y-2">
                    {aiSuggestions.tasks.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <input
                          type="text"
                          value={t.title}
                          onChange={(e) => {
                            const updated = [...aiSuggestions.tasks];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setAiSuggestions({ ...aiSuggestions, tasks: updated });
                          }}
                          className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <StatusBadge status={t.priority} />
                        <button
                          type="button"
                          onClick={() =>
                            setAiSuggestions({
                              ...aiSuggestions,
                              tasks: aiSuggestions.tasks.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-rose-500 px-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAiSuggestions(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveAISuggestions}
                    disabled={approvingAI}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    {approvingAI ? 'Saving...' : 'Approve & Save to Project'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Explicit Completion Confirmation */}
      {showCompleteModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-project-modal-title"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl text-xs space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ClipboardCheck className="h-6 w-6" />
              <h2 id="complete-project-modal-title" className="text-base font-bold">
                Confirm Project Completion
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              All mandatory requirements, required milestones, task dependencies, and verified
              evidence checks have passed. Please explicitly confirm to mark{' '}
              <strong>{project.name}</strong> as Completed.
            </p>
            <form onSubmit={handleCompleteProject} className="space-y-3">
              <div>
                <label htmlFor="completion-notes" className="block font-medium mb-1">
                  Release / Sign-Off Notes
                </label>
                <textarea
                  id="completion-notes"
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Optional final release notes..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmCheck}
                  onChange={(e) => setConfirmCheck(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm that all mandatory acceptance criteria and verification evidence have been
                  reviewed and satisfied.
                </span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!confirmCheck || completingProject}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold"
                >
                  {completingProject ? 'Completing...' : 'Mark Project Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Project */}
      {showEditProjectModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl text-xs space-y-3">
            <h2 className="text-base font-bold">Edit Project Details</h2>
            <form onSubmit={handleUpdateProjectDetails} className="space-y-3">
              <div>
                <label htmlFor="edit-proj-name" className="block font-medium mb-1">
                  Name
                </label>
                <input
                  id="edit-proj-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="edit-proj-desc" className="block font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="edit-proj-desc"
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="edit-proj-obj" className="block font-medium mb-1">
                  Objectives
                </label>
                <textarea
                  id="edit-proj-obj"
                  rows={2}
                  value={editObjectives}
                  onChange={(e) => setEditObjectives(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="edit-proj-crit" className="block font-medium mb-1">
                  Completion Criteria
                </label>
                <textarea
                  id="edit-proj-crit"
                  rows={2}
                  value={editCriteria}
                  onChange={(e) => setEditCriteria(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
