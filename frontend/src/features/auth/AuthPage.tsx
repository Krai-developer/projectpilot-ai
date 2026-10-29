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
  const leftCalloutRef = useRef<HTMLDivElement | null>(null);
  const rightCalloutRef = useRef<HTMLDivElement | null>(null);
  const [globePressed, setGlobePressed] = useState(false);

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
        onAnchorsUpdate: (anchors, liveStats) => {
          const expanded = Boolean(liveStats.isExpanded);
          setGlobePressed((prev) => (prev !== expanded ? expanded : prev));

          if (leftCalloutRef.current) {
            leftCalloutRef.current.style.transform = `translate3d(${Math.round(
              anchors.leftTelemetry.x
            )}px, ${Math.round(anchors.leftTelemetry.y)}px, 0) translate(-50%, -50%)`;
            leftCalloutRef.current.style.visibility = anchors.leftTelemetry.visible
              ? 'visible'
              : 'hidden';
          }

          if (rightCalloutRef.current) {
            rightCalloutRef.current.style.transform = `translate3d(${Math.round(
              anchors.rightEquation.x
            )}px, ${Math.round(anchors.rightEquation.y)}px, 0) translate(-50%, -50%)`;
            rightCalloutRef.current.style.visibility = anchors.rightEquation.visible
              ? 'visible'
              : 'hidden';
          }
        },
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

  return (
    <div className="relative min-h-screen w-full bg-[#030914] text-slate-100 overflow-hidden flex flex-col lg:flex-row">
      {/* Full-Viewport Seamless 3D Cockpit Canvas */}
      <div
        ref={canvasMountRef}
        className="relative lg:fixed lg:inset-0 w-full h-[340px] sm:h-[420px] lg:h-full z-0 select-none"
        aria-label="Interactive 3D Viewport"
      />

      {/* 3D Constellation Pop-Up Callouts (Triggered When Globe Is Pressed) */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute top-0 left-0 lg:fixed lg:inset-0 w-full h-[340px] sm:h-[420px] lg:h-full z-[5] overflow-hidden"
      >
        {/* Left Constellation Callout (Yellow Circle Area): "Your Project" */}
        <div
          ref={leftCalloutRef}
          style={{ left: 0, top: 0, visibility: 'hidden' }}
          className="absolute will-change-transform"
        >
          <div
            className={`transition-all duration-500 ease-out ${
              globePressed
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-75 translate-y-3'
            }`}
          >
            <div className="relative px-4 py-2 rounded-full border border-cyan-400/50 bg-[#051329]/85 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping absolute left-4" />
              <span className="w-2 h-2 rounded-full bg-cyan-300 relative" />
              <span className="text-xs sm:text-sm font-bold tracking-wide text-cyan-100 whitespace-nowrap drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]">
                Your Project
              </span>
            </div>
          </div>
        </div>

        {/* Right Constellation Callout (Red Circle Area): "Is Our Progress" */}
        <div
          ref={rightCalloutRef}
          style={{ left: 0, top: 0, visibility: 'hidden' }}
          className="absolute will-change-transform"
        >
          <div
            className={`transition-all duration-500 delay-75 ease-out ${
              globePressed
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-75 translate-y-3'
            }`}
          >
            <div className="relative px-4 py-2 rounded-full border border-purple-400/50 bg-[#0d102b]/85 backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.4)] flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping absolute left-4" />
              <span className="w-2 h-2 rounded-full bg-purple-300 relative" />
              <span className="text-xs sm:text-sm font-bold tracking-wide text-purple-100 whitespace-nowrap drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]">
                Is Our Progress
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Soft Right-Side Atmospheric Vignette */}
      <div
        aria-hidden="true"
        className="hidden lg:block pointer-events-none fixed inset-y-0 right-0 w-[52%] z-0 bg-gradient-to-l from-[#030914]/90 via-[#030914]/55 to-transparent"
      />

      {/* Left Spacer for 3D Interaction Area on Desktop */}
      <div className="hidden lg:block lg:w-[56%] pointer-events-none" />

      {/* Right Side: Translucent Holographic Glassmorphic Sign-In Card */}
      <div className="relative z-10 w-full lg:w-[44%] flex items-center justify-center p-6 sm:p-10 lg:pr-14 pointer-events-none">
        <div className="relative w-full max-w-md pointer-events-auto">
          {/* Ambient Cyan & Violet Backlight Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-3 rounded-[28px] bg-gradient-to-tr from-cyan-500/20 via-sky-500/10 to-purple-500/20 blur-2xl opacity-80"
          />

          <div className="relative rounded-2xl border border-cyan-400/20 bg-[#071124]/80 backdrop-blur-2xl text-slate-100 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85),0_0_40px_-10px_rgba(34,211,238,0.18)] p-7 sm:p-8 overflow-hidden">
            {/* Top Specular Edge Highlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
            />

            {/* Brand Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
                <FolderKanban className="w-5 h-5 stroke-[2.2] text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                ProjectPilot
              </h1>
            </div>

            {/* Clean Segmented Tab Switcher */}
            <div
              className="grid grid-cols-2 rounded-xl bg-[#030914]/90 border border-slate-800 p-1 mb-6"
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
                className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
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
                className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 flex items-start gap-2 text-xs text-rose-200"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="full-name"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      id="full-name"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-700/80 bg-[#030914]/75 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-700/80 bg-[#030914]/75 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400 transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Password (minimum 8 characters)
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-700/80 bg-[#030914]/75 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide characters' : 'Reveal characters'}
                    className="absolute right-2.5 top-2 p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
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
                <p className="text-[11px] text-center text-cyan-300/80">
                  Connecting to server — first request may take a few seconds...
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
