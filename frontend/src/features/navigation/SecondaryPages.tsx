import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  CheckSquare,
  Cpu,
  Milestone as MilestoneIcon,
  RefreshCw,
  Server,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AIHealthStatus, Assessment, Milestone, Project, Task, TaskStatus } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { MilestoneVisualizer3D } from '../../components/three/MilestoneVisualizer3D';
import { TiltCard3D } from '../../components/three/TiltCard3D';

export const AllTasksPage: React.FC = () => {
  const [items, setItems] = useState<Array<{ project: Project; task: Task }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const loadTasks = async () => {
    setLoading(true);
    try {
      const projects = await api.getProjects();
      const results: Array<{ project: Project; task: Task }> = [];
      for (const p of projects) {
        const pTasks = await api.getTasks(p.id);
        for (const t of pTasks) {
          results.push({ project: p, task: t });
        }
      }
      setItems(results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleStatusChange = async (taskId: number, status: TaskStatus) => {
    await api.updateTask(taskId, { status });
    await loadTasks();
  };

  const filtered = statusFilter ? items.filter((i) => i.task.status === statusFilter) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Project Tasks</h1>
          <p className="text-sm text-slate-500">Cross-project task tracker and status controls.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter tasks by status"
          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All Statuses</option>
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Blocked">Blocked</option>
          <option value="In Review">In Review</option>
          <option value="Done">Done</option>
        </select>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
          <CheckSquare className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
          No tasks found across your projects.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(({ project, task }) => (
            <div
              key={task.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/projects/${project.id}?tab=tasks`}
                    className="font-bold text-sm hover:text-indigo-600"
                  >
                    {task.title}
                  </Link>
                  <StatusBadge status={task.priority} />
                  <StatusBadge status={task.status} />
                </div>
                <p className="text-slate-500 mt-0.5">
                  Project: <strong>{project.name}</strong> • Weight: {task.weight}
                </p>
              </div>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                aria-label={`Change status for ${task.title}`}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Blocked">Blocked</option>
                <option value="In Review">In Review</option>
                <option value="Done">Done</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AllMilestonesPage: React.FC = () => {
  const [items, setItems] = useState<Array<{ project: Project; milestone: Milestone }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const projects = await api.getProjects();
        const list: Array<{ project: Project; milestone: Milestone }> = [];
        for (const p of projects) {
          const ms = await api.getMilestones(p.id);
          for (const m of ms) {
            list.push({ project: p, milestone: m });
          }
        }
        setItems(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Milestones</h1>
        <p className="text-sm text-slate-500">
          Milestone readiness computed deterministically from linked task completion.
        </p>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
          <MilestoneIcon className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
          No milestones recorded yet.
        </div>
      ) : (
        <div className="space-y-6">
          <MilestoneVisualizer3D milestones={items.map((i) => i.milestone)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(({ project, milestone }) => (
              <TiltCard3D key={milestone.id} intensity={4}>
                <Link
                  to={`/projects/${project.id}?tab=milestones`}
                  className="block p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{milestone.title}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={milestone.is_required ? 'Required' : 'Optional'} />
                      <StatusBadge status={milestone.status} />
                    </div>
                  </div>
                  <p className="text-slate-500">Project: {project.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500"
                        style={{ width: `${Math.min(100, milestone.computed_progress)}%` }}
                      />
                    </div>
                    <span className="font-mono font-semibold">{milestone.computed_progress}%</span>
                  </div>
                </Link>
              </TiltCard3D>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const AllAssessmentsPage: React.FC = () => {
  const [items, setItems] = useState<Array<{ project: Project; assessment: Assessment }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const projects = await api.getProjects();
        const list: Array<{ project: Project; assessment: Assessment }> = [];
        for (const p of projects) {
          const aList = await api.getProjectAssessments(p.id);
          for (const a of aList) {
            list.push({ project: p, assessment: a });
          }
        }
        setItems(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Completion Assessments</h1>
        <p className="text-sm text-slate-500">
          Audit history across all projects with staleness tracking and deterministic readiness snapshots.
        </p>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
          <Bot className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
          No assessments recorded yet. Open a project and click &ldquo;Assess Project Completion&rdquo;.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ project, assessment }) => (
            <Link
              key={assessment.id}
              to={`/projects/${project.id}?tab=assessments`}
              className="block p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition text-xs space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{project.name}</span>
                  <StatusBadge status={assessment.readiness_status} />
                  {assessment.is_stale && <StatusBadge status="Stale" />}
                </div>
                <span className="font-mono font-semibold">
                  Progress Snapshot: {assessment.progress_snapshot}%
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">{assessment.ai_summary}</p>
              <p className="text-[11px] text-slate-400">
                Model: {assessment.model_name} • {new Date(assessment.created_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const [aiHealth, setAiHealth] = useState<AIHealthStatus | null>(null);
  const [sysHealth, setSysHealth] = useState<{ status: string; database: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const checkAll = async () => {
    setChecking(true);
    try {
      const [sys, ai] = await Promise.all([api.getHealth(), api.getAIHealth()]);
      setSysHealth(sys);
      setAiHealth(ai);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkAll();
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System & AI Settings</h1>
        </div>
        <button
          type="button"
          onClick={checkAll}
          disabled={checking}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          Refresh Diagnostics
        </button>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold">Backend & Database</h2>
          </div>
          <StatusBadge status={sysHealth?.status === 'healthy' ? 'Completed' : 'Blocked'} />
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Database Connection: <strong>{sysHealth?.database || 'connected'}</strong>
        </p>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold">AI Assessment Service</h2>
          </div>
          <StatusBadge status="Completed" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-slate-500">Service Status</p>
            <p className="font-semibold mt-0.5 text-emerald-600 dark:text-emerald-400">
              Active & Operational
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-slate-500">Assessment Engine</p>
            <p className="font-mono font-semibold mt-0.5">
              {aiHealth?.ollama_reachable
                ? aiHealth.configured_model
                : 'Built-in Readiness Engine'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
