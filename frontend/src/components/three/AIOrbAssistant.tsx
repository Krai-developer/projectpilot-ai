import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  Sparkles,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { AIHealthStatus, Assessment, Project } from '../../types';
import { StatusBadge } from '../StatusBadge';
import {
  isWebGLAvailable,
  useReducedMotionPreference,
  WebGLErrorBoundary,
} from './webglUtils';

interface OrbSceneProps {
  mousePos: { x: number; y: number };
  hovered: boolean;
  pulsing: boolean;
  reducedMotion: boolean;
}

const NeuralOrbMesh: React.FC<OrbSceneProps> = ({
  mousePos,
  hovered,
  pulsing,
  reducedMotion,
}) => {
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current && !reducedMotion) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        mousePos.x * 0.65,
        0.08
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -mousePos.y * 0.55,
        0.08
      );
      groupRef.current.position.y = Math.sin(t * 2.2) * 0.08;
    }

    if (coreRef.current && !reducedMotion) {
      const speed = pulsing ? 2.4 : hovered ? 1.4 : 0.65;
      coreRef.current.rotation.y += delta * speed;
      coreRef.current.rotation.x += delta * (speed * 0.6);
      const scale = 1 + Math.sin(t * (pulsing ? 6 : 2.5)) * (hovered ? 0.08 : 0.04);
      coreRef.current.scale.setScalar(scale);
    }

    if (shellRef.current && !reducedMotion) {
      shellRef.current.rotation.y -= delta * 0.45;
      shellRef.current.rotation.z += delta * 0.3;
    }

    if (ring1Ref.current && !reducedMotion) {
      ring1Ref.current.rotation.z += delta * (hovered ? 1.8 : 0.9);
    }
    if (ring2Ref.current && !reducedMotion) {
      ring2Ref.current.rotation.x -= delta * (hovered ? 1.5 : 0.75);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner glowing AI core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.88, 2]} />
        <meshStandardMaterial
          color={pulsing ? '#34d399' : '#38bdf8'}
          emissive={pulsing ? '#10b981' : hovered ? '#06b6d4' : '#4f46e5'}
          emissiveIntensity={hovered || pulsing ? 1.1 : 0.75}
          roughness={0.18}
          metalness={0.85}
        />
      </mesh>

      {/* Wireframe geodesic neural lattice */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[1.12, 1]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#8b5cf6"
          emissiveIntensity={0.65}
          wireframe
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Primary orbital energy ring */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2.6, 0.3, 0]}>
        <torusGeometry args={[1.48, 0.032, 16, 84]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#06b6d4"
          emissiveIntensity={0.9}
        />
      </mesh>

      {/* Secondary tilted orbital ring */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 3, -0.5, 0.4]}>
        <torusGeometry args={[1.66, 0.024, 16, 84]} />
        <meshStandardMaterial
          color="#c084fc"
          emissive="#9333ea"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
};

const FallbackOrbVisual: React.FC<{ hovered: boolean }> = ({ hovered }) => (
  <div className="relative h-full w-full flex items-center justify-center">
    <div
      className={`h-16 w-16 rounded-full bg-gradient-to-tr from-indigo-600 via-cyan-400 to-purple-500 shadow-lg shadow-cyan-500/30 flex items-center justify-center transition-transform duration-300 ${
        hovered ? 'scale-110' : 'scale-100'
      }`}
    >
      <Bot className="h-8 w-8 text-white" />
    </div>
  </div>
);

interface AIOrbAssistantProps {
  projects?: Project[];
  aiHealth?: AIHealthStatus | null;
  onAssessmentComplete?: () => void;
  variant?: 'hero' | 'floating';
}

export const AIOrbAssistant: React.FC<AIOrbAssistantProps> = ({
  projects: externalProjects,
  aiHealth: externalAiHealth,
  onAssessmentComplete,
  variant = 'hero',
}) => {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionPreference();
  const webglReady = isWebGLAvailable();

  const [hovered, setHovered] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [projects, setProjects] = useState<Project[]>(externalProjects || []);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    externalProjects && externalProjects.length > 0 ? externalProjects[0].id : null
  );
  const [aiHealth, setAiHealth] = useState<AIHealthStatus | null>(externalAiHealth || null);
  const [runningAssess, setRunningAssess] = useState(false);
  const [latestResult, setLatestResult] = useState<Assessment | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (externalProjects) {
      setProjects(externalProjects);
      if (externalProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(externalProjects[0].id);
      }
    }
  }, [externalProjects, selectedProjectId]);

  useEffect(() => {
    if (externalAiHealth !== undefined) {
      setAiHealth(externalAiHealth);
    }
  }, [externalAiHealth]);

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') return;
    const handleWindowMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x: nx, y: ny });
    };
    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleWindowMouseMove);
  }, [reducedMotion]);

  const openAssistantPanel = async () => {
    setPanelOpen(true);
    setErrorMsg(null);
    try {
      if (!externalProjects || externalProjects.length === 0) {
        const list = await api.getProjects();
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      }
      if (!aiHealth) {
        const health = await api.getAIHealth();
        setAiHealth(health);
      }
    } catch {
      // Ignore background fetch error; panel still renders
    }
  };

  const handleQuickAssessment = async () => {
    if (!selectedProjectId) return;
    setRunningAssess(true);
    setErrorMsg(null);
    try {
      const report = await api.runAssessment(selectedProjectId);
      setLatestResult(report);
      if (onAssessmentComplete) {
        onAssessmentComplete();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not complete assessment.');
    } finally {
      setRunningAssess(false);
    }
  };

  const renderOrbCanvas = (sizeClass: string) => (
    <div
      className={`relative ${sizeClass} cursor-pointer select-none`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={openAssistantPanel}
      role="button"
      tabIndex={0}
      aria-label="Open 3D AI Completion Assistant Panel"
      data-testid="ai-orb-assistant-trigger"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAssistantPanel();
        }
      }}
    >
      {webglReady ? (
        <WebGLErrorBoundary fallback={<FallbackOrbVisual hovered={hovered} />}>
          <Canvas
            camera={{ position: [0, 0, 4.1], fov: 45 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.85} />
            <pointLight position={[4, 4, 4]} intensity={2.2} color="#22d3ee" />
            <pointLight position={[-4, -3, 3]} intensity={1.6} color="#a855f7" />
            <NeuralOrbMesh
              mousePos={mousePos}
              hovered={hovered}
              pulsing={runningAssess}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        </WebGLErrorBoundary>
      ) : (
        <FallbackOrbVisual hovered={hovered} />
      )}
    </div>
  );

  return (
    <>
      {variant === 'hero' ? (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 dark:border-cyan-500/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-xl shadow-indigo-950/30">
          {/* Futuristic ambient lighting backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-600/20 blur-3xl"
          />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {renderOrbCanvas('h-32 w-32 sm:h-36 sm:w-36 shrink-0')}
              <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Interactive 3D AI Completion Sentinel</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Know Exactly What Remains Before Release
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Click the 3D neural core to launch the AI Completion Assistant. Audits mandatory
                  requirements, task dependencies, and verified evidence using local Ollama inference
                  and deterministic backend rules.
                </p>
                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <button
                    type="button"
                    onClick={openAssistantPanel}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition"
                  >
                    <Bot className="h-4 w-4" />
                    Open AI Assistant Panel
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {aiHealth?.status === 'available'
                      ? `Local Model Ready: ${aiHealth.configured_model}`
                      : 'Deterministic Gate Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-5 right-5 z-40">
          {renderOrbCanvas('h-16 w-16 rounded-full bg-slate-900/90 border border-cyan-500/40 shadow-lg shadow-cyan-500/20')}
        </div>
      )}

      {/* Interactive AI Assistant Modal / Slide-over Panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-assistant-panel-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-xl rounded-2xl bg-slate-900 text-slate-100 border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 id="ai-assistant-panel-title" className="text-base font-bold">
                      ProjectPilot 3D AI Completion Assistant
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                      Model: <span className="font-mono">{aiHealth?.configured_model || 'local-ollama'}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close AI Assistant Panel"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-800/60 border border-slate-700 text-center space-y-3 text-xs">
                  <p className="text-slate-300">
                    No projects exist yet. Create a project first to run AI completion assessments or
                    generate structured task plans.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelOpen(false);
                      navigate('/projects?new=1');
                    }}
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold"
                  >
                    Create First Project
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="ai-panel-project-select" className="block font-medium text-slate-300 mb-1.5">
                      Select Target Project
                    </label>
                    <select
                      id="ai-panel-project-select"
                      value={selectedProjectId || ''}
                      onChange={(e) => {
                        setSelectedProjectId(Number(e.target.value));
                        setLatestResult(null);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.progress_percentage}% • {p.readiness_status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={runningAssess || !selectedProjectId}
                      onClick={handleQuickAssessment}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 shadow"
                    >
                      <Bot className="h-4 w-4" />
                      {runningAssess ? 'Running AI Audit...' : 'Assess Project Completion'}
                    </button>

                    <button
                      type="button"
                      disabled={!selectedProjectId}
                      onClick={() => {
                        setPanelOpen(false);
                        if (selectedProjectId) {
                          navigate(`/projects/${selectedProjectId}`);
                        }
                      }}
                      className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium flex items-center justify-center gap-2"
                    >
                      <span>Open Project Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200">
                      {errorMsg}
                    </div>
                  )}

                  {latestResult && (
                    <div className="p-4 rounded-xl bg-slate-800/90 border border-cyan-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          Assessment #{latestResult.id} Recorded
                        </span>
                        <StatusBadge status={latestResult.readiness_status} />
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        {latestResult.findings.overall_summary}
                      </p>
                      {latestResult.findings.recommended_next_actions.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-700">
                          <p className="font-semibold text-slate-300">Recommended Next Actions:</p>
                          {latestResult.findings.recommended_next_actions.map((act, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700">
                              <p className="font-semibold text-cyan-300">{act.title}</p>
                              <p className="text-slate-400 mt-0.5">{act.why_it_matters}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
