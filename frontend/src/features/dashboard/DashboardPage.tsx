import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderKanban,
  PlayCircle,
  Plus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import {
  AIHealthStatus,
  Assessment,
  CompletionGateResult,
  DashboardSummary,
  Milestone,
  Task,
} from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { AIOrbAssistant } from '../../components/three/AIOrbAssistant';
import { ProgressRing3D } from '../../components/three/ProgressRing3D';
import { TiltCard3D } from '../../components/three/TiltCard3D';
import { ScrollReveal } from '../../components/three/ScrollReveal';
import { MilestoneVisualizer3D } from '../../components/three/MilestoneVisualizer3D';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [aiHealth, setAiHealth] = useState<AIHealthStatus | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [activeMilestones, setActiveMilestones] = useState<Milestone[]>([]);
  const [activeGate, setActiveGate] = useState<CompletionGateResult | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'thinking' | 'celebrating' | 'focused'>('idle');
  const [aiCommandOutput, setAiCommandOutput] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const loadProjectSpotlight = (projectId: number) => {
    if (typeof api.getTasks === 'function') {
      Promise.resolve(api.getTasks(projectId))
        .then((res) => {
          if (Array.isArray(res)) setActiveTasks(res);
        })
        .catch(() => setActiveTasks([]));
    }
    if (typeof api.getMilestones === 'function') {
      Promise.resolve(api.getMilestones(projectId))
        .then((res) => {
          if (Array.isArray(res)) setActiveMilestones(res);
        })
        .catch(() => setActiveMilestones([]));
    }
    if (typeof api.getProjectGate === 'function') {
      Promise.resolve(api.getProjectGate(projectId))
        .then((res) => {
          if (res && res.gate) setActiveGate(res.gate);
        })
        .catch(() => setActiveGate(null));
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setSummary(data);

      Promise.resolve(api.getAIHealth?.())
        .then((res) => {
          if (res) setAiHealth(res);
        })
        .catch(() => setAiHealth(null));

      if (data.projects.length > 0) {
        const targetId = selectedProjectId || data.projects[0].id;
        setSelectedProjectId(targetId);
        loadProjectSpotlight(targetId);
      } else {
        setActiveTasks([]);
        setActiveMilestones([]);
        setActiveGate(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleSelectProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    setAiCommandOutput(null);
    loadProjectSpotlight(projectId);
  };

  const handleCreateDemo = async () => {
    setCreatingDemo(true);
    try {
      const project = await api.createDemoProject();
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err?.message || 'Could not create demo project.');
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleRunAiAction = async (
    actionType: 'plan' | 'analyze' | 'next-step' | 'risks' | 'summary'
  ) => {
    if (!summary || summary.projects.length === 0) {
      await handleCreateDemo();
      return;
    }
    const targetProject =
      summary.projects.find((p) => p.id === selectedProjectId) || summary.projects[0];

    if (actionType === 'plan') {
      navigate(`/projects/${targetProject.id}?tab=tasks`);
      return;
    }

    setAiStatus('thinking');
    try {
      if (typeof api.runAssessment === 'function') {
        const report = await api.runAssessment(targetProject.id);
        setAiCommandOutput(report);
        setAiStatus('celebrating');
        loadDashboard();
      }
    } catch {
      setAiStatus('idle');
    } finally {
      setTimeout(() => setAiStatus('idle'), 3500);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true">
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
        <p className="font-semibold mb-2">Error loading dashboard</p>
        <p className="text-sm mb-4">{error}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const activeProject =
    summary.projects.find((p) => p.id === selectedProjectId) || summary.projects[0] || null;

  const remainingCount = activeProject
    ? Math.max(0, activeProject.total_tasks - activeProject.completed_tasks)
    : 0;

  const deadlineDays =
    activeProject && activeProject.deadline
      ? Math.ceil(
          (new Date(activeProject.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Brand Hero Command Center Banner */}
      <ScrollReveal>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0a1128] via-slate-900 to-indigo-950 p-6 rounded-3xl text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2.5 py-0.5 rounded-full">
                Deterministic Project Control
              </span>
              <span className="text-xs text-slate-400 font-medium">|</span>
              <span className="text-xs text-slate-300 font-medium">
                &ldquo;Your Project. Your Control. With AI.&rdquo;
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
              Command Center &amp; AI Intelligence
              <span className="sr-only"> — Project Completion Dashboard</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Real-time weighted progress calculations, active blocker resolution, and
              zero-compromise verification audit gates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 relative z-10">
            {summary.projects.length === 0 && (
              <button
                type="button"
                onClick={handleCreateDemo}
                disabled={creatingDemo}
                className="flex items-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                <Sparkles className="w-4 h-4 text-indigo-300" />
                <span>{creatingDemo ? 'Seeding Demo...' : 'Load Demo Project'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleRunAiAction('analyze')}
              className="flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>AI Status Scan</span>
            </button>
            {activeProject ? (
              <button
                type="button"
                onClick={() => navigate(`/projects/${activeProject.id}`)}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Award className="w-4 h-4" />
                <span>Verify Completion</span>
              </button>
            ) : (
              <Link
                to="/projects?new=1"
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </Link>
            )}
          </div>

          <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </ScrollReveal>

      {/* 4 Live Metric Cards matching Cockpit Reference */}
      <ScrollReveal delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Projects */}
          <TiltCard3D
            intensity={5}
            glowColor="rgba(6, 182, 212, 0.14)"
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Projects
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-black text-slate-900 dark:text-white tracking-tight"
              data-testid="metric-total-projects"
            >
              {summary.total_projects}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                {summary.projects.length} Portfolios
              </span>{' '}
              active
            </div>
          </TiltCard3D>

          {/* In Progress */}
          <TiltCard3D
            intensity={5}
            glowColor="rgba(6, 182, 212, 0.18)"
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                In Progress
              </span>
              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <PlayCircle className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight"
              data-testid="metric-in-progress"
            >
              {summary.projects_in_progress}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Tracking sprint targets</span>
            </div>
          </TiltCard3D>

          {/* Completed / Eligible */}
          <TiltCard3D
            intensity={5}
            glowColor="rgba(16, 185, 129, 0.18)"
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight"
              data-testid="metric-eligible"
            >
              {summary.projects_eligible_for_completion}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                100% Deterministic
              </span>{' '}
              sealed
            </div>
          </TiltCard3D>

          {/* At Risk / Blocked */}
          <TiltCard3D
            intensity={5}
            glowColor="rgba(244, 63, 94, 0.18)"
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                At Risk / Blocked
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div
              className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight"
              data-testid="metric-blockers"
            >
              {summary.projects_with_blockers}
            </div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Requires triage</span>
              </span>
              <span className="text-slate-400 font-normal" data-testid="metric-overdue">
                {summary.overdue_tasks_count} overdue
              </span>
            </div>
          </TiltCard3D>
        </div>
      </ScrollReveal>

      {/* Main Interactive Grid: 3D AI Assistant Cockpit (Left 5 cols) & Active Project 3D Spotlight (Right 7 cols) */}
      <ScrollReveal delay={0.1}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 3D AI Assistant Character & Quick Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    Interactive 3D Assistant
                  </h2>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                  Three.js PBR Engine
                </span>
              </div>

              {/* 3D Robot Orb Canvas */}
              <AIOrbAssistant
                projects={summary.projects}
                aiHealth={aiHealth}
                onAssessmentComplete={loadDashboard}
                variant="cockpit"
                status={aiStatus}
              />

              {/* 5 Functional AI Guidance Command Buttons */}
              <div className="mt-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                  AI Guidance Commands
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleRunAiAction('plan')}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50 dark:hover:bg-slate-800 hover:border-cyan-300 text-left transition-all group"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Project Plan</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Generate weighted tasks &amp; milestones
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunAiAction('analyze')}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50 dark:hover:bg-slate-800 hover:border-cyan-300 text-left transition-all group"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Analyze Status</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Evaluate velocity &amp; health score
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunAiAction('next-step')}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50 dark:hover:bg-slate-800 hover:border-cyan-300 text-left transition-all group"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Recommend Next</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Identify highest-leverage task
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunAiAction('risks')}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50 dark:hover:bg-slate-800 hover:border-rose-300 text-left transition-all group"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                      <span>Check Risks</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Detect schedule slippage &amp; blockers
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunAiAction('summary')}
                    className="col-span-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-all group"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                      <span>Generate Progress Summary</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Synthesize stakeholder executive update with completion readiness stats
                    </p>
                  </button>
                </div>
              </div>

              {aiCommandOutput && (
                <div className="mt-4 p-3.5 rounded-2xl bg-slate-900 text-white border border-cyan-500/30 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">
                      Latest AI Audit (#{aiCommandOutput.id})
                    </span>
                    <StatusBadge status={aiCommandOutput.readiness_status} />
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {aiCommandOutput.findings.overall_summary}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Project Progress Section & 3D Segmented Hologram (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
              {activeProject ? (
                <>
                  {/* Active Project Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-cyan-500" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Robotics &amp; AI
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            activeProject.status === 'Blocked'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : activeProject.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-cyan-100 text-cyan-700 border border-cyan-200'
                          }`}
                        >
                          {activeProject.status}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            activeProject.priority === 'Critical'
                              ? 'bg-red-50 text-red-600'
                              : activeProject.priority === 'High'
                              ? 'bg-orange-50 text-orange-600'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {activeProject.priority} Priority
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        <Link
                          to={`/projects/${activeProject.id}`}
                          className="hover:text-cyan-600 transition-colors"
                        >
                          {activeProject.name}
                        </Link>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {activeProject.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${activeProject.id}`)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                      >
                        <Award className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Quality Audit</span>
                      </button>
                    </div>
                  </div>

                  {/* 3D Segmented Progress Ring Visualization */}
                  <div className="mt-4">
                    <ProgressRing3D
                      percentage={activeProject.progress_percentage}
                      label="Deterministic"
                      eligible={activeProject.eligible_for_completion}
                      tasks={activeTasks.length > 0 ? activeTasks : undefined}
                      milestones={activeMilestones}
                      completedWeight={activeGate?.completed_task_weight}
                      totalWeight={activeGate?.total_task_weight}
                      completedTasks={activeProject.completed_tasks}
                      totalTasks={activeProject.total_tasks}
                      blockedTasks={activeProject.blocked_tasks}
                    />
                  </div>

                  {/* Deterministic Progress Breakdown Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Tasks Ratio
                      </div>
                      <div className="text-base font-extrabold text-slate-800 dark:text-white mt-0.5">
                        {activeProject.completed_tasks} / {activeProject.total_tasks} Done
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {remainingCount} remaining
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Weight Points
                      </div>
                      <div className="text-base font-extrabold text-cyan-600 dark:text-cyan-400 mt-0.5">
                        {activeGate
                          ? `${activeGate.completed_task_weight} / ${activeGate.total_task_weight} pts`
                          : `${activeProject.progress_percentage}%`}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        100% × (done / total weight)
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Blocked Items
                      </div>
                      <div
                        className={`text-base font-extrabold mt-0.5 ${
                          activeProject.blocked_tasks > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {activeProject.blocked_tasks} Blocked
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {activeProject.blocked_tasks > 0 ? 'Impediment detected' : 'Clear runway'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Target Deadline
                      </div>
                      <div className="text-base font-extrabold text-slate-800 dark:text-white mt-0.5">
                        {activeProject.deadline
                          ? new Date(activeProject.deadline).toLocaleDateString()
                          : 'Flexible'}
                      </div>
                      <div
                        className={`text-[10px] font-semibold mt-0.5 ${
                          deadlineDays !== null && deadlineDays < 0
                            ? 'text-rose-600'
                            : deadlineDays !== null && deadlineDays <= 7
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {deadlineDays === null
                          ? 'No hard deadline'
                          : deadlineDays < 0
                          ? `${Math.abs(deadlineDays)}d overdue`
                          : `${deadlineDays} days remaining`}
                      </div>
                    </div>
                  </div>

                  {/* Completion Readiness Mini Card */}
                  <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          activeProject.eligible_for_completion
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                        }`}
                      >
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">
                            {activeProject.eligible_for_completion
                              ? 'Certified Ready for Formal Seal'
                              : 'Completion Quality Gates Active'}
                          </span>
                          <span className="text-[10px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-full font-mono">
                            Score: {activeProject.progress_percentage}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                          {activeGate && activeGate.blocking_reasons.length > 0
                            ? activeGate.blocking_reasons[0]
                            : activeProject.eligible_for_completion
                            ? 'All verification evidence, tasks, and requirements are satisfied.'
                            : 'Open project workspace to inspect mandatory requirements and evidence.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${activeProject.id}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shrink-0"
                    >
                      Inspect Checklist
                    </button>
                  </div>
                </>
              ) : (
                /* Empty state inside right 3D cockpit when no projects exist yet */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-cyan-500" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Robotics &amp; AI
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-cyan-100 text-cyan-700 border border-cyan-200">
                          Ready to Initialize
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Autonomous Navigation Drone
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Create your first project or seed the demo workspace to activate live 3D
                        weighted progress tracking.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCreateDemo}
                        disabled={creatingDemo}
                        className="px-3 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs font-bold"
                      >
                        {creatingDemo ? 'Seeding...' : 'Load Demo Project'}
                      </button>
                      <Link
                        to="/projects?new=1"
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                      >
                        Create Project
                      </Link>
                    </div>
                  </div>

                  <ProgressRing3D
                    percentage={0}
                    label="Deterministic"
                    completedWeight={0}
                    totalWeight={0}
                    completedTasks={0}
                    totalTasks={0}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* 3D Milestone Visualization if milestones exist */}
      {activeMilestones.length > 0 && (
        <ScrollReveal delay={0.14}>
          <MilestoneVisualizer3D milestones={activeMilestones} />
        </ScrollReveal>
      )}

      {/* Bottom Section: Active Projects Portfolio & Recent Activity */}
      {summary.projects.length > 0 && (
        <ScrollReveal delay={0.18}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Projects Cards (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Active Projects
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any project card to preview in the 3D hologram or open its full gate
                    workspace.
                  </p>
                </div>
                <Link
                  to="/projects"
                  className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                >
                  <span>View All ({summary.projects.length})</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {summary.projects.map((proj) => {
                  const isSelected = activeProject?.id === proj.id;
                  return (
                    <TiltCard3D
                      key={proj.id}
                      intensity={4}
                      glowColor="rgba(6, 182, 212, 0.14)"
                      className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                        isSelected
                          ? 'bg-cyan-50/40 dark:bg-slate-900 border-cyan-400 shadow-md ring-2 ring-cyan-200 dark:ring-cyan-900'
                          : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      <div onClick={() => handleSelectProject(proj.id)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                            {proj.priority} Priority
                          </span>
                          <StatusBadge status={proj.status} />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/projects/${proj.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 transition-colors line-clamp-1"
                          >
                            {proj.name}
                          </Link>
                          <StatusBadge status={proj.readiness_status} />
                        </div>

                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {proj.description || 'No description provided.'}
                        </p>

                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {proj.progress_percentage}%
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {proj.completed_tasks}/{proj.total_tasks} tasks
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-cyan-500 to-indigo-600"
                              style={{ width: `${Math.min(100, proj.progress_percentage)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {proj.deadline
                              ? new Date(proj.deadline).toLocaleDateString()
                              : 'Flexible'}
                          </span>
                          <Link
                            to={`/projects/${proj.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            Open Gate →
                          </Link>
                        </div>
                      </div>
                    </TiltCard3D>
                  );
                })}
              </div>
            </div>

            {/* Live Activity Feed (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Recent Activity
                </h3>
                <span className="text-[10px] text-slate-400">Deterministic Audit</span>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 divide-y divide-slate-100 dark:divide-slate-800 space-y-3">
                {summary.recent_activity.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No recent audit events recorded.</p>
                ) : (
                  summary.recent_activity.slice(0, 6).map((act) => (
                    <div key={act.id} className="pt-3 first:pt-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-300 px-1.5 py-0.5 rounded capitalize">
                          {act.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(act.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {act.details?.title && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1 leading-snug">
                          {act.details.title}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollReveal>
      )}
    </div>
  );
};
