import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  FolderKanban,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { PriorityLevel, Project, ProjectStatus } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { TiltCard3D } from '../../components/three/TiltCard3D';
import { ScrollReveal } from '../../components/three/ScrollReveal';

export const ProjectsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get('new') === '1');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [completionCriteria, setCompletionCriteria] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [status, setStatus] = useState<ProjectStatus>('Planning');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getProjects(statusFilter || undefined);
      setProjects(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [statusFilter]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Project name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        objectives: objectives.trim(),
        completion_criteria: completionCriteria.trim(),
        priority,
        status,
        start_date: startDate || null,
        deadline: deadline || null,
      });
      setShowCreateModal(false);
      navigate(`/projects/${created.id}`);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveProject = async (project: Project) => {
    try {
      await api.updateProject(project.id, { status: 'Archived' });
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Could not archive project.');
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    try {
      await api.deleteProject(projectId);
      setConfirmDeleteId(null);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Could not delete project.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage project scope, completion criteria, requirements, and readiness status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="project-status-filter" className="sr-only">
            Filter by Status
          </label>
          <select
            id="project-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">All Statuses</option>
            <option value="Planning">Planning</option>
            <option value="In Progress">In Progress</option>
            <option value="Blocked">Blocked</option>
            <option value="Ready for Review">Ready for Review</option>
            <option value="Completed">Completed</option>
            <option value="Archived">Archived</option>
          </select>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center bg-white dark:bg-slate-900">
          <FolderKanban className="h-10 w-10 text-indigo-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold mb-1">No projects match your filter</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Create a new project to start tracking requirements, weighted tasks, and AI completion readiness.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project, idx) => (
            <ScrollReveal key={project.id} delay={idx * 0.04}>
              <TiltCard3D
                intensity={5}
                glowColor="rgba(56, 189, 248, 0.16)"
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-base font-semibold hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      {project.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={project.priority} />
                      <StatusBadge status={project.status} />
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Weighted Progress</span>
                      <span className="font-mono font-semibold">{project.progress_percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 via-cyan-500 to-purple-500 transition-all"
                        style={{ width: `${Math.min(100, project.progress_percentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={project.readiness_status} />
                      <span className="text-slate-500">
                        {project.completed_tasks}/{project.total_tasks} tasks
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {project.status !== 'Archived' && (
                        <button
                          type="button"
                          onClick={() => handleArchiveProject(project)}
                          title="Archive project"
                          aria-label={`Archive ${project.name}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(project.id)}
                        title="Delete project"
                        aria-label={`Delete ${project.name}`}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </TiltCard3D>
            </ScrollReveal>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="create-project-title" className="text-lg font-bold">
                Create New Project
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setSearchParams({});
                }}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label htmlFor="proj-name" className="block text-xs font-medium mb-1">
                  Project Name *
                </label>
                <input
                  id="proj-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Customer Billing Portal v2"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label htmlFor="proj-desc" className="block text-xs font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="proj-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this project builds and its architecture..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label htmlFor="proj-objectives" className="block text-xs font-medium mb-1">
                  Objectives
                </label>
                <textarea
                  id="proj-objectives"
                  rows={2}
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="Key measurable outcomes..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label htmlFor="proj-criteria" className="block text-xs font-medium mb-1">
                  Completion Criteria
                </label>
                <textarea
                  id="proj-criteria"
                  rows={2}
                  value={completionCriteria}
                  onChange={(e) => setCompletionCriteria(e.target.value)}
                  placeholder="Conditions required before final release sign-off..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proj-status" className="block text-xs font-medium mb-1">
                    Initial Status
                  </label>
                  <select
                    id="proj-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="proj-priority" className="block text-xs font-medium mb-1">
                    Priority
                  </label>
                  <select
                    id="proj-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proj-start" className="block text-xs font-medium mb-1">
                    Start Date
                  </label>
                  <input
                    id="proj-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label htmlFor="proj-deadline" className="block text-xs font-medium mb-1">
                    Deadline
                  </label>
                  <input
                    id="proj-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSearchParams({});
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Destructive Delete Confirmation Dialog */}
      {confirmDeleteId !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-base font-bold mb-2">Delete Project Permanently?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              This will permanently remove the project along with all its requirements, tasks,
              milestones, evidence, and assessment history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProject(confirmDeleteId)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
