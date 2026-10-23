import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { AIHealthStatus, DashboardSummary, Milestone } from '../../types';
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
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setSummary(data);

      // Non-blocking fetch of AI health and primary project milestones for 3D visualizer
      Promise.resolve(api.getAIHealth?.())
        .then((res) => {
          if (res) setAiHealth(res);
        })
        .catch(() => setAiHealth(null));

      if (data.projects.length > 0 && typeof api.getMilestones === 'function') {
        Promise.all(
          data.projects.slice(0, 3).map((p) =>
            Promise.resolve(api.getMilestones(p.id))
              .then((res) => (Array.isArray(res) ? res : []))
              .catch(() => [])
          )
        )
          .then((lists) => setMilestones(lists.flat()))
          .catch(() => setMilestones([]));
      } else {
        setMilestones([]);
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
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

  const chartData = summary.projects.slice(0, 6).map((p) => ({
    name: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
    progress: p.progress_percentage,
  }));

  const overallWeightedAverage =
    summary.projects.length > 0
      ? Number(
          (
            summary.projects.reduce((acc, p) => acc + p.progress_percentage, 0) /
            summary.projects.length
          ).toFixed(1)
        )
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <ScrollReveal>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project Completion Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Authoritative progress metrics, completion readiness gates, and local AI audit history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCreateDemo}
              disabled={creatingDemo}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
            >
              <Sparkles className="h-4 w-4" />
              {creatingDemo ? 'Seeding Demo...' : 'Load Demo Project'}
            </button>
            <Link
              to="/projects?new=1"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-medium shadow-md shadow-indigo-500/20 transition"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </div>
        </div>
      </ScrollReveal>

      {/* Interactive 3D AI Assistant Banner */}
      <ScrollReveal delay={0.05}>
        <AIOrbAssistant
          projects={summary.projects}
          aiHealth={aiHealth}
          onAssessmentComplete={loadDashboard}
          variant="hero"
        />
      </ScrollReveal>

      {/* 5 Core Metric Cards with 3D Tilt & Lighting */}
      <ScrollReveal delay={0.1}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <TiltCard3D
            intensity={6}
            glowColor="rgba(99, 102, 241, 0.22)"
            className="p-4 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>Total Projects</span>
              <FolderKanban className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold" data-testid="metric-total-projects">
              {summary.total_projects}
            </p>
          </TiltCard3D>

          <TiltCard3D
            intensity={6}
            glowColor="rgba(56, 189, 248, 0.22)"
            className="p-4 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>In Progress</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="metric-in-progress">
              {summary.projects_in_progress}
            </p>
          </TiltCard3D>

          <TiltCard3D
            intensity={6}
            glowColor="rgba(16, 185, 129, 0.22)"
            className="p-4 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>Eligible for Completion</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="metric-eligible">
              {summary.projects_eligible_for_completion}
            </p>
          </TiltCard3D>

          <TiltCard3D
            intensity={6}
            glowColor="rgba(244, 63, 94, 0.22)"
            className="p-4 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>Projects with Blockers</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400" data-testid="metric-blockers">
              {summary.projects_with_blockers}
            </p>
          </TiltCard3D>

          <TiltCard3D
            intensity={6}
            glowColor="rgba(245, 158, 11, 0.22)"
            className="p-4 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>Overdue Tasks</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="metric-overdue">
              {summary.overdue_tasks_count}
            </p>
          </TiltCard3D>
        </div>
      </ScrollReveal>

      {/* Empty State if no projects */}
      {summary.projects.length === 0 ? (
        <ScrollReveal delay={0.15}>
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center bg-white dark:bg-slate-900">
            <FolderKanban className="h-10 w-10 text-indigo-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">No projects tracked yet</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
              Create your first project or load the pre-configured EdgeTelemetry demo project to explore
              weighted progress tracking, completion gates, and local Ollama AI assessments.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleCreateDemo}
                className="px-4 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
              >
                Load Demo Project
              </button>
              <Link
                to="/projects?new=1"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium"
              >
                Create Project
              </Link>
            </div>
          </div>
        </ScrollReveal>
      ) : (
        <>
          {/* Interactive Project Cards & 3D Progress Visualization + Recharts */}
          <ScrollReveal delay={0.15}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Active Projects & Completion Readiness</h2>
                  <Link
                    to="/projects"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="space-y-4">
                  {summary.projects.map((proj) => (
                    <TiltCard3D
                      key={proj.id}
                      intensity={4}
                      glowColor="rgba(56, 189, 248, 0.14)"
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/80 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <Link
                          to={`/projects/${proj.id}`}
                          className="font-semibold text-sm hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                        >
                          {proj.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={proj.status} />
                          <StatusBadge status={proj.readiness_status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-600 via-cyan-500 to-purple-500 transition-all"
                            style={{ width: `${Math.min(100, proj.progress_percentage)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-semibold w-14 text-right">
                          {proj.progress_percentage}%
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          Tasks: {proj.completed_tasks}/{proj.total_tasks} Done
                        </span>
                        {proj.blocked_tasks > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {proj.blocked_tasks} Blocked
                          </span>
                        )}
                        {proj.overdue_tasks > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {proj.overdue_tasks} Overdue
                          </span>
                        )}
                        {proj.deadline && (
                          <span>Deadline: {new Date(proj.deadline).toLocaleDateString()}</span>
                        )}
                      </div>
                    </TiltCard3D>
                  ))}
                </div>
              </div>

              {/* 3D Project Progress Ring + Recharts BarChart */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <h2 className="text-sm font-semibold mb-1">3D Weighted Progress Telemetry</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time 3D completion ring & project breakdown
                  </p>
                </div>

                <div className="flex justify-center py-1">
                  <ProgressRing3D
                    percentage={overallWeightedAverage}
                    label="Portfolio Avg"
                    sublabel={`${summary.total_projects} project(s)`}
                    size={165}
                    eligible={summary.projects_eligible_for_completion > 0}
                  />
                </div>

                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => [`${val}%`, 'Weighted Progress']} />
                      <Bar dataKey="progress" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* 3D Milestone Visualization if milestones exist */}
          {milestones.length > 0 && (
            <ScrollReveal delay={0.18}>
              <MilestoneVisualizer3D milestones={milestones} />
            </ScrollReveal>
          )}

          {/* Upcoming Deadlines, Latest AI Assessments, Recent Activity */}
          <ScrollReveal delay={0.22}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upcoming Deadlines */}
              <TiltCard3D
                intensity={4}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-sm font-semibold">Upcoming & Overdue Deadlines</h2>
                </div>
                {summary.upcoming_deadlines.length === 0 ? (
                  <p className="text-xs text-slate-500">No upcoming deadlines scheduled.</p>
                ) : (
                  <div className="space-y-2.5">
                    {summary.upcoming_deadlines.map((item, idx) => (
                      <div
                        key={`${item.type}-${item.id}-${idx}`}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <Link
                            to={`/projects/${item.project_id}`}
                            className="font-medium truncate block hover:text-indigo-500"
                          >
                            {item.title}
                          </Link>
                          <span className="text-[11px] text-slate-500">
                            {item.project_name} ({item.type})
                          </span>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-[11px] px-2 py-0.5 rounded ${
                            item.days_remaining < 0
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {item.days_remaining < 0
                            ? `${Math.abs(item.days_remaining)}d overdue`
                            : item.days_remaining === 0
                            ? 'Due today'
                            : `in ${item.days_remaining}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TiltCard3D>

              {/* Latest AI Assessments */}
              <TiltCard3D
                intensity={4}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-sm font-semibold">Latest Completion Assessments</h2>
                </div>
                {summary.latest_assessments.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No assessments recorded yet. Open a project and click &ldquo;Assess Project Completion&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {summary.latest_assessments.slice(0, 4).map((a) => (
                      <Link
                        key={a.id}
                        to={`/projects/${a.project_id}?tab=assessments`}
                        className="block p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-semibold">{a.progress_snapshot}%</span>
                          <div className="flex items-center gap-1.5">
                            {a.is_stale && <StatusBadge status="Stale" />}
                            <StatusBadge status={a.readiness_status} />
                          </div>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-1">
                          {a.ai_summary}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          Model: {a.model_name} • {new Date(a.created_at).toLocaleString()}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </TiltCard3D>

              {/* Recent Activity */}
              <TiltCard3D
                intensity={4}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm"
              >
                <h2 className="text-sm font-semibold mb-4">Recent Audit Activity</h2>
                {summary.recent_activity.length === 0 ? (
                  <p className="text-xs text-slate-500">No recent activity.</p>
                ) : (
                  <div className="space-y-2.5">
                    {summary.recent_activity.slice(0, 6).map((act) => (
                      <div
                        key={act.id}
                        className="text-xs border-b border-slate-100 dark:border-slate-800/80 pb-2 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">
                            {act.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(act.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {act.details?.title && (
                          <p className="text-slate-500 dark:text-slate-400 truncate">
                            {act.details.title}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TiltCard3D>
            </div>
          </ScrollReveal>
        </>
      )}
    </div>
  );
};
