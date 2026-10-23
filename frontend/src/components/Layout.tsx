import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bot,
  CheckSquare,
  FolderKanban,
  FolderPlus,
  LayoutDashboard,
  LogOut,
  Menu,
  Milestone as MilestoneIcon,
  Moon,
  Radio,
  Search,
  Settings,
  Sparkles,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { AIHealthStatus, Project } from '../types';
import { AIOrbAssistant } from './three/AIOrbAssistant';

export const Layout: React.FC = () => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiHealth, setAiHealth] = useState<AIHealthStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const refreshSidebarData = () => {
    Promise.resolve(api.getAIHealth?.())
      .then((res) => {
        if (res) setAiHealth(res);
      })
      .catch(() => setAiHealth(null));

    Promise.resolve(api.getProjects?.())
      .then((list) => {
        if (Array.isArray(list)) {
          setProjects(list);
          if (list.length > 0 && !selectedProjectId) {
            setSelectedProjectId(String(list[0].id));
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshSidebarData();
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const ollamaOnline = aiHealth?.status === 'available';

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    {
      to: '/projects',
      label: 'Projects',
      icon: FolderKanban,
      end: false,
      badge: projects.length > 0 ? String(projects.length) : undefined,
    },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare, end: false },
    { to: '/milestones', label: 'Milestones', icon: MilestoneIcon, end: false },
    { to: '/assessments', label: 'AI Assessments', icon: Bot, end: false, badge: '3D' },
    { to: '/settings', label: 'Settings', icon: Settings, end: false },
  ];

  const filteredProjects = searchQuery.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans antialiased">
      {/* Dark Navy 3D Intelligent Cockpit Sidebar */}
      <aside className="hidden md:flex md:w-64 bg-[#0a1128] text-slate-200 border-r border-slate-800 flex-col justify-between min-h-screen shrink-0 sticky top-0 select-none z-30">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-500 p-0.5 shadow-lg shadow-cyan-900/30">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <Link
                  to="/"
                  className="font-bold text-base tracking-tight text-white flex items-center gap-1.5"
                >
                  ProjectPilot{' '}
                  <span className="text-cyan-400 font-extrabold text-xs px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                    AI
                  </span>
                </Link>
                <span className="text-[11px] text-slate-400 font-medium block">
                  3D Intelligent Cockpit
                </span>
              </div>
            </div>
          </div>

          {/* Active Workspace Switcher Pill */}
          <div className="px-4 pt-4 pb-2">
            <label
              htmlFor="active-workspace-select"
              className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5"
            >
              Active Workspace
            </label>
            <select
              id="active-workspace-select"
              value={selectedProjectId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedProjectId(val);
                if (val) {
                  navigate(`/projects/${val}`);
                }
              }}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer hover:border-slate-600 transition-colors truncate"
            >
              {projects.length === 0 ? (
                <option value="" className="bg-slate-900 text-slate-400">
                  Autonomous Navigation Drone
                </option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={String(p.id)} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Navigation List */}
          <nav className="px-3 py-3 space-y-1" aria-label="Sidebar Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/10 text-cyan-300 border-l-4 border-cyan-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer & User Profile */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
          {/* Local AI status */}
          <div className="rounded-lg px-3 py-2 bg-slate-900/80 border border-slate-800 text-[11px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    ollamaOnline ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
                  }`}
                />
                <span className="text-slate-300 font-medium">
                  {ollamaOnline ? 'Local Ollama AI' : 'Intelligent Core'}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  ollamaOnline
                    ? 'text-emerald-400 bg-emerald-950/60'
                    : 'text-amber-400 bg-amber-950/60'
                }`}
              >
                {ollamaOnline ? 'Active' : 'Ready'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-1">
              Model: <span className="font-mono">{aiHealth?.configured_model || 'llama3.2:3b'}</span>
            </p>
          </div>

          {/* User Card */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-800 shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.full_name || 'Senior Lead Architect'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.email || 'Project Lead & Reviewer'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                title="Switch theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Navigation Bar matching Cockpit Reference */}
        <header className="hidden md:flex h-16 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-6 items-center justify-between sticky top-0 z-20 shadow-xs">
          {/* Global Search Bar */}
          <div className="relative w-80 lg:w-96">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search projects, tasks, requirements..."
                aria-label="Global workspace search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-100/80 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-cyan-500 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="absolute right-2.5 text-[10px] text-slate-400 font-mono bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                  /
                </kbd>
              )}
            </div>

            {isSearchFocused && searchQuery.trim() && (
              <div className="absolute top-12 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-50 max-h-80 overflow-y-auto">
                {filteredProjects.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    No matching projects found.
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 block">
                      Projects ({filteredProjects.length})
                    </span>
                    {filteredProjects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          navigate(`/projects/${p.id}`);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold truncate">{p.name}</span>
                        <span className="text-[10px] text-cyan-600 bg-cyan-100/60 dark:bg-cyan-950 dark:text-cyan-300 px-1.5 py-0.5 rounded">
                          {p.progress_percentage}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              title="Click to inspect Local Ollama / AI Engine"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Radio
                className={`w-3.5 h-3.5 ${ollamaOnline ? 'text-emerald-500' : 'text-cyan-600'}`}
              />
              <span className="hidden sm:inline">
                {ollamaOnline ? 'Pilot Core: Online' : 'Pilot Core: Standby'}
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-500" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <span className="font-bold">Project Readiness Alerts</span>
                    <span className="text-[10px] text-cyan-600">Deterministic Gate</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    {projects.length > 0
                      ? `${projects.length} active project(s) monitored in real time.`
                      : 'Create or seed a project to monitor completion gates.'}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label="Open Workspace Tasks"
              onClick={() => {
                if (projects.length > 0) {
                  navigate(`/projects/${projects[0].id}?tab=tasks`);
                } else {
                  navigate('/tasks');
                }
              }}
              className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700"
            >
              <CheckSquare className="w-3.5 h-3.5 text-cyan-600" />
              <span className="hidden sm:inline">Add Task</span>
            </button>

            <Link
              to="/projects?new=1"
              className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-md shadow-cyan-900/10"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </Link>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 bg-[#0a1128] text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <span className="font-bold text-sm">ProjectPilot AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-300"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open navigation menu"
              className="p-2 rounded-lg text-slate-300"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a1128] text-white border-b border-slate-800 px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-400"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
        <AIOrbAssistant aiHealth={aiHealth} variant="floating" />
      </div>
    </div>
  );
};
