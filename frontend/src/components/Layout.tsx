import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  CheckSquare,
  Cpu,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Milestone as MilestoneIcon,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { AIHealthStatus } from '../types';
import { AIOrbAssistant } from './three/AIOrbAssistant';

export const Layout: React.FC = () => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiHealth, setAiHealth] = useState<AIHealthStatus | null>(null);

  useEffect(() => {
    api
      .getAIHealth()
      .then(setAiHealth)
      .catch(() => setAiHealth(null));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare, end: false },
    { to: '/milestones', label: 'Milestones', icon: MilestoneIcon, end: false },
    { to: '/assessments', label: 'AI Assessments', icon: Bot, end: false },
    { to: '/settings', label: 'Settings', icon: Settings, end: false },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <Link to="/" className="font-bold text-base tracking-tight block">
              ProjectPilot AI
            </Link>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Completion & Readiness Gate
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Sidebar Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Local AI Status Box */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                Local Ollama AI
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  aiHealth?.status === 'available'
                    ? 'bg-emerald-500'
                    : aiHealth?.status === 'model_missing'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <p className="text-slate-500 dark:text-slate-400 truncate">
              Model: <span className="font-mono">{aiHealth?.configured_model || 'llama3.2:3b'}</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {aiHealth?.status === 'available'
                ? 'Local inference ready'
                : aiHealth?.status === 'model_missing'
                ? 'No Ollama model pulled'
                : 'Offline — deterministic gate active'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="truncate pr-2">
              <p className="text-xs font-medium truncate">{user?.full_name || user?.email}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Switch theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
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
        {/* Mobile Header */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <span className="font-bold text-sm">ProjectPilot AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-500"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open navigation menu"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-1">
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
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-400'
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
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
        <AIOrbAssistant aiHealth={aiHealth} variant="floating" />
      </div>
    </div>
  );
};
