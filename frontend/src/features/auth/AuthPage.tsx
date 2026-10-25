import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  FolderKanban,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { CockpitSceneController } from '../../components/three/cockpit/CockpitScene';
import { isWebGLAvailable } from '../../components/three/webglUtils';

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slowRequestHint, setSlowRequestHint] = useState(false);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container || !isWebGLAvailable()) return;

    let controller: CockpitSceneController | null = null;
    try {
      controller = new CockpitSceneController(container, {
        onSubsystemSelect: () => {},
        onSubsystemHover: () => {},
        onAnchorsUpdate: () => {},
      });
    } catch {
      controller = null;
    }

    return () => {
      controller?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!submitting) {
      setSlowRequestHint(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSlowRequestHint(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, fullName.trim());
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setError(null);
    setMode('register');
    setFullName('Alex Mercer');
    setEmail(`demo.${Math.floor(1000 + Math.random() * 9000)}@example.com`);
    setPassword('DemoWorkspace123!');
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#030914] text-slate-100 overflow-hidden">
      {/* Left Side: Interactive 3D Planetary Cockpit Viewport */}
      <div className="relative lg:col-span-7 min-h-[340px] sm:min-h-[420px] lg:min-h-screen w-full overflow-hidden bg-[#030914] select-none border-b lg:border-b-0 lg:border-r border-slate-800/70">
        <div
          ref={canvasMountRef}
          className="absolute inset-0 w-full h-full"
          aria-label="Interactive 3D Viewport"
        />
      </div>

      {/* Right Side: Clean Sign-In Card */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10 bg-[#030914]">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-7 sm:p-8">
          {/* Clean Brand Header */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center text-slate-950">
              <FolderKanban className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                ProjectPilot
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'login'
                  ? 'Sign in to open your workspace'
                  : 'Create your workspace account'}
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div
            className="grid grid-cols-2 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 mb-5"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="full-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    id="full-name"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Password (minimum 8 characters)
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide characters' : 'Reveal characters'}
                  className="absolute right-2.5 top-2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 disabled:opacity-50 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {slowRequestHint && (
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Connecting to server — first request may take a few seconds...
              </p>
            )}
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Just testing the app?</span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="font-semibold text-slate-800 dark:text-sky-400 hover:underline"
            >
              Use demo credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
