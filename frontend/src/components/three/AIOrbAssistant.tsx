import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  Eye,
  Maximize2,
  Minimize2,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { AIHealthStatus, Assessment, Project } from '../../types';
import { StatusBadge } from '../StatusBadge';
import {
  isSoftwareWebGL,
  isWebGLAvailable,
  useReducedMotionPreference,
} from './webglUtils';

export interface AIOrbRobotCanvasProps {
  status?: 'idle' | 'thinking' | 'celebrating' | 'focused';
  onTap?: () => void;
  interactive?: boolean;
  className?: string;
  compact?: boolean;
}

export const AIOrbRobotCanvas: React.FC<AIOrbRobotCanvasProps> = ({
  status = 'idle',
  onTap,
  interactive = true,
  className = '',
  compact = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState(() => isWebGLAvailable());
  const [reactionMsg, setReactionMsg] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const statusRef = useRef(status);
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !isWebGLAvailable()) {
      setIsSupported(false);
      return;
    }

    const isSoftwareGl = isSoftwareWebGL();
    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;

    try {
      const width = container.clientWidth || (compact ? 64 : 320);
      const height = container.clientHeight || (compact ? 64 : 256);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0f172a, 0.08);

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
      camera.position.set(0, 0.9, compact ? 3.5 : 3.8);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      container.appendChild(renderer.domElement);

      if (!isSoftwareGl) {
        try {
          const pmremGenerator = new THREE.PMREMGenerator(renderer);
          scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
          pmremGenerator.dispose();
        } catch {
          // Ignore environment reflection map failure on constrained GPUs
        }
      }

      const ambientLight = new THREE.HemisphereLight(0xe0f2fe, 0x090d16, 1.4);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
      keyLight.position.set(2.5, 4, 3);
      if (!isSoftwareGl) {
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.0005;
      }
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x818cf8, 1.8);
      rimLight.position.set(-3, 2, -2.5);
      scene.add(rimLight);

      const createVisorTexture = () => {
        const cvs = document.createElement('canvas');
        cvs.width = 512;
        cvs.height = 256;
        const ctx = cvs.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(cvs);

        ctx.fillStyle = '#050b14';
        ctx.fillRect(0, 0, 512, 256);

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
        ctx.lineWidth = 1.5;
        for (let x = 0; x < 512; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 256);
          ctx.stroke();
        }
        for (let y = 0; y < 256; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(512, y);
          ctx.stroke();
        }

        const drawEye = (cx: number, cy: number) => {
          const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 40);
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
          grad.addColorStop(0.4, 'rgba(6, 182, 212, 0.6)');
          grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, 40, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, 26, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx, cy, 9, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#a5f3fc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 34, -0.6, 0.6);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, 34, Math.PI - 0.6, Math.PI + 0.6);
          ctx.stroke();
        };

        drawEye(170, 128);
        drawEye(342, 128);

        const texture = new THREE.CanvasTexture(cvs);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      };

      const createShadowTexture = () => {
        const cvs = document.createElement('canvas');
        cvs.width = 256;
        cvs.height = 256;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 120);
          grad.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
          grad.addColorStop(0.5, 'rgba(2, 6, 23, 0.25)');
          grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 256, 256);
        }
        return new THREE.CanvasTexture(cvs);
      };

      // --- COMPOSITE 10-PART PROCEDURAL ROBOT MODEL ---
      const robotGroup = new THREE.Group();
      robotGroup.position.set(0, 0.7, 0);

      // 1. Primary Core Sphere (White / Ceramic Pearl PBR)
      const coreGeo = new THREE.SphereGeometry(0.72, 32, 28);
      const coreMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        roughness: 0.16,
        metalness: 0.25,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.castShadow = !isSoftwareGl;
      robotGroup.add(coreMesh);

      // 2. Cyber Visor Band (Front Arc)
      const visorGeo = new THREE.CylinderGeometry(
        0.73,
        0.73,
        0.42,
        32,
        1,
        true,
        -Math.PI * 0.45,
        Math.PI * 0.9
      );
      const visorMat = new THREE.MeshBasicMaterial({
        map: createVisorTexture(),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
      });
      const visorMesh = new THREE.Mesh(visorGeo, visorMat);
      visorMesh.position.set(0, 0.08, 0.02);
      robotGroup.add(visorMesh);

      // 3. Cranial Armor Shield (Top Cap)
      const armorGeo = new THREE.SphereGeometry(0.74, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.32);
      const armorMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.35,
        metalness: 0.85,
      });
      const armorMesh = new THREE.Mesh(armorGeo, armorMat);
      armorMesh.rotation.x = -0.15;
      robotGroup.add(armorMesh);

      // 4. Magnetic Orbital Ring (Floating Cyan Torus)
      const ringGeo = new THREE.TorusGeometry(1.08, 0.035, 16, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0284c7,
        emissiveIntensity: 0.4,
        roughness: 0.25,
        metalness: 0.9,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI * 0.42;
      robotGroup.add(ringMesh);

      // 5. Secondary Counter-Rotation Orbit Ring (Purple Tilted Torus)
      const ring2Geo = new THREE.TorusGeometry(1.22, 0.025, 16, 64);
      const ring2Mat = new THREE.MeshStandardMaterial({
        color: 0x8b5cf6,
        emissive: 0x7c3aed,
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.9,
      });
      const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2Mesh.rotation.x = -Math.PI * 0.35;
      ring2Mesh.rotation.z = Math.PI * 0.15;
      robotGroup.add(ring2Mesh);

      // 6 & 7. Orbiting Data Satellite Nodes
      const nodeGeo = new THREE.SphereGeometry(0.09, 16, 16);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        roughness: 0.15,
        metalness: 0.95,
      });
      const nodeMesh1 = new THREE.Mesh(nodeGeo, nodeMat);
      const nodeMesh2 = new THREE.Mesh(nodeGeo, nodeMat);
      robotGroup.add(nodeMesh1);
      robotGroup.add(nodeMesh2);

      // 8. Lower Thruster Emitter Cone
      const thrusterGeo = new THREE.CylinderGeometry(0.3, 0.14, 0.28, 20);
      const thrusterMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.7,
      });
      const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
      thrusterMesh.position.set(0, -0.65, 0);
      robotGroup.add(thrusterMesh);

      // 9. Thruster Glow Emitter Plane
      const glowGeo = new THREE.RingGeometry(0.04, 0.24, 20);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.set(0, -0.79, 0);
      glowMesh.rotation.x = Math.PI * 0.5;
      robotGroup.add(glowMesh);

      // 10. Antenna Telemetry Spire & Beacon
      const spireGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.35, 12);
      const spireMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.95,
        roughness: 0.2,
      });
      const spireMesh = new THREE.Mesh(spireGeo, spireMat);
      spireMesh.position.set(0, 0.85, -0.1);
      robotGroup.add(spireMesh);

      const beaconGeo = new THREE.SphereGeometry(0.045, 12, 12);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.8,
        roughness: 0.1,
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.set(0, 1.02, -0.1);
      robotGroup.add(beaconMesh);

      scene.add(robotGroup);

      // Contact Ground Shadow Plane
      const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: createShadowTexture(),
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.rotation.x = -Math.PI * 0.5;
      shadowMesh.position.set(0, -0.05, 0);
      scene.add(shadowMesh);

      const targetRotation = { x: 0, y: 0 };
      const currentRotation = { x: 0, y: 0 };

      const handlePointerMove = (e: MouseEvent) => {
        if (reducedMotion) return;
        const rect = container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        targetRotation.y = x * 0.45;
        targetRotation.x = -y * 0.35;
      };

      if (interactive) {
        container.addEventListener('mousemove', handlePointerMove);
      }

      const clock = new THREE.Clock();

      const renderLoop = () => {
        frameId = requestAnimationFrame(renderLoop);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        if (!reducedMotion) {
          const smoothFactor = 1 - Math.exp(-6 * delta);
          currentRotation.x += (targetRotation.x - currentRotation.x) * smoothFactor;
          currentRotation.y += (targetRotation.y - currentRotation.y) * smoothFactor;

          robotGroup.rotation.y = currentRotation.y;
          robotGroup.rotation.x = currentRotation.x;

          const curStatus = statusRef.current;

          if (curStatus === 'thinking') {
            ringMesh.rotation.z += delta * 4.5;
            ring2Mesh.rotation.y += delta * 3.8;
            glowMesh.scale.setScalar(1 + Math.sin(time * 14) * 0.25);
            beaconMat.color.setHex(0x8b5cf6);
            beaconMat.emissive.setHex(0x7c3aed);
          } else if (curStatus === 'celebrating') {
            robotGroup.position.y = 0.7 + Math.abs(Math.sin(time * 5)) * 0.25;
            robotGroup.rotation.y += delta * 3;
            ringMesh.rotation.z += delta * 6;
            beaconMat.color.setHex(0x10b981);
            beaconMat.emissive.setHex(0x059669);
          } else {
            robotGroup.position.y = 0.7 + Math.sin(time * 2.2) * 0.08;
            ringMesh.rotation.z += delta * 0.8;
            ring2Mesh.rotation.y -= delta * 0.6;
            glowMesh.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
            beaconMat.color.setHex(0x06b6d4);
            beaconMat.emissive.setHex(0x0284c7);
          }

          const orbitSpeed = curStatus === 'thinking' ? 3.5 : 1.2;
          const angle1 = time * orbitSpeed;
          const angle2 = angle1 + Math.PI;
          nodeMesh1.position.set(
            Math.cos(angle1) * 1.15,
            Math.sin(time * 2) * 0.18,
            Math.sin(angle1) * 1.15
          );
          nodeMesh2.position.set(
            Math.cos(angle2) * 1.25,
            -Math.sin(time * 2) * 0.18,
            Math.sin(angle2) * 1.25
          );

          const shadowScale = 1 - (robotGroup.position.y - 0.7) * 0.5;
          shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
        }

        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      renderLoop();

      const handleResize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth || (compact ? 64 : 320);
        const h = container.clientHeight || (compact ? 64 : 256);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        if (interactive) {
          container.removeEventListener('mousemove', handlePointerMove);
        }
        if (renderer) {
          renderer.dispose();
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
        }
        scene.clear();
      };
    } catch {
      setIsSupported(false);
      if (frameId) cancelAnimationFrame(frameId);
      if (renderer) {
        try {
          renderer.dispose();
        } catch {
          // ignore
        }
      }
      return;
    }
  }, [interactive, compact, reducedMotion]);

  const handleRobotClick = () => {
    const tips = [
      'Pilot AI: "All deterministic progress calculations are verified with zero drift!"',
      'Pilot AI: "Tip: Unblocking critical tasks yields the highest velocity spike."',
      'Pilot AI: "Local Ollama engine is ready for air-gapped planning."',
      'Pilot AI: "Ensure every Done task has recorded verification evidence!"',
    ];
    const picked = tips[Math.floor(Math.random() * tips.length)];
    setReactionMsg(picked);
    setTimeout(() => setReactionMsg(null), 4000);
    if (onTap) onTap();
  };

  if (compact) {
    return (
      <div
        onClick={handleRobotClick}
        role="button"
        tabIndex={0}
        aria-label="Open 3D AI Completion Assistant Panel"
        data-testid="ai-orb-assistant-trigger"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRobotClick();
          }
        }}
        className={`relative h-14 w-14 rounded-full bg-slate-900/95 border border-cyan-500/40 shadow-lg shadow-cyan-500/20 flex items-center justify-center cursor-pointer select-none hover:scale-105 transition-transform ${className}`}
      >
        <Bot className="w-6 h-6 text-cyan-400" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-slate-800 text-white shadow-xl transition-all ${className} ${
        isExpanded ? 'h-96' : 'h-64'
      }`}
    >
      {/* Dedicated Three.js Canvas Container */}
      <div
        ref={mountRef}
        onClick={handleRobotClick}
        role="button"
        tabIndex={0}
        aria-label="Open 3D AI Completion Assistant Panel"
        data-testid="ai-orb-assistant-trigger"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRobotClick();
          }
        }}
        className="w-full h-full cursor-pointer relative z-10"
        title="Click to interact with ProjectPilot 3D Assistant"
      />

      {/* Floating Status Pill */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-none">
        <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
        <span className="text-xs font-semibold tracking-wider uppercase text-cyan-300">
          Pilot AI Core
        </span>
        <span className="text-[10px] bg-cyan-950/80 border border-cyan-800 text-cyan-400 px-2 py-0.5 rounded-full">
          {status.toUpperCase()}
        </span>
      </div>

      {/* Interactive Speech Notification Bubble */}
      {reactionMsg && (
        <div className="absolute bottom-12 left-4 right-4 z-30 bg-slate-900/95 border border-cyan-500/50 text-cyan-200 text-xs px-3 py-2 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="leading-tight">{reactionMsg}</span>
        </div>
      )}

      {/* Ergonomic Bottom Controls Dock */}
      <div className="absolute bottom-2 right-3 z-20 flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/80 rounded-lg px-2 py-1 text-slate-400 text-xs backdrop-blur-sm">
        <button
          type="button"
          onClick={() => handleRobotClick()}
          title="Play voice ping"
          className="hover:text-cyan-400 p-1 transition-colors"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse 3D view' : 'Expand 3D view'}
          className="hover:text-cyan-400 p-1 transition-colors"
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Graceful 2D Fallback if WebGL unavailable */}
      {!isSupported && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 p-4 text-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-2">
            <Eye className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-slate-200">ProjectPilot AI Assistant</p>
          <p className="text-xs text-slate-400 mt-1">
            WebGL 3D preview running in lightweight 2D mode.
          </p>
        </div>
      )}
    </div>
  );
};

interface AIOrbAssistantProps {
  projects?: Project[];
  aiHealth?: AIHealthStatus | null;
  onAssessmentComplete?: () => void;
  variant?: 'hero' | 'floating' | 'cockpit';
  status?: 'idle' | 'thinking' | 'celebrating' | 'focused';
  onTap?: () => void;
}

export const AIOrbAssistant: React.FC<AIOrbAssistantProps> = ({
  projects: externalProjects,
  aiHealth: externalAiHealth,
  onAssessmentComplete,
  variant = 'cockpit',
  status: externalStatus,
  onTap,
}) => {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
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

  const openAssistantPanel = async () => {
    if (onTap) {
      onTap();
    }
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

  const effectiveStatus = runningAssess
    ? 'thinking'
    : latestResult
    ? 'celebrating'
    : externalStatus || 'idle';

  return (
    <>
      {variant === 'floating' ? (
        <div className="fixed bottom-5 right-5 z-40">
          <AIOrbRobotCanvas
            status={effectiveStatus}
            onTap={openAssistantPanel}
            compact={true}
          />
        </div>
      ) : (
        <AIOrbRobotCanvas
          status={effectiveStatus}
          onTap={openAssistantPanel}
        />
      )}

      {/* Interactive AI Assistant Modal Panel */}
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
                      Model:{' '}
                      <span className="font-mono">
                        {aiHealth?.configured_model || 'local-ollama'}
                      </span>
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
                    <label
                      htmlFor="ai-panel-project-select"
                      className="block font-medium text-slate-300 mb-1.5"
                    >
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
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700"
                            >
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
