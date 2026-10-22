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
import { DashboardSummary } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setSummary(data);
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

  return (
    <div className="space-y-8">
      {/* Header */}
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Total Projects</span>
            <FolderKanban className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold" data-testid="metric-total-projects">
            {summary.total_projects}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>In Progress</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="metric-in-progress">
            {summary.projects_in_progress}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Eligible for Completion</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="metric-eligible">
            {summary.projects_eligible_for_completion}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Projects with Blockers</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400" data-testid="metric-blockers">
            {summary.projects_with_blockers}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Overdue Tasks</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="metric-overdue">
            {summary.overdue_tasks_count}
          </p>
        </div>
      </div>

      {/* Empty State if no projects */}
      {summary.projects.length === 0 ? (
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
      ) : (
        <>
          {/* Project Progress Bars & Recharts Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
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
                  <div
                    key={proj.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <Link
                        to={`/projects/${proj.id}`}
                        className="font-semibold text-sm hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {proj.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={proj.status} />
                        <StatusBadge status={proj.readiness_status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all"
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
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col">
              <h2 className="text-sm font-semibold mb-1">Weighted Progress Overview</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Calculated deterministically from task weights
              </p>
              <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [`${val}%`, 'Weighted Progress']} />
                    <Bar dataKey="progress" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Upcoming Deadlines, Latest AI Assessments, Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Deadlines */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
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
            </div>

            {/* Latest AI Assessments */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
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
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
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
            </div>
          </div>
        </>
      )}
    </div>
  );
};
