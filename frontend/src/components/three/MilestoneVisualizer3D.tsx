import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Milestone } from '../../types';
import { StatusBadge } from '../StatusBadge';
import {
  isWebGLAvailable,
  useReducedMotionPreference,
  WebGLErrorBoundary,
} from './webglUtils';

interface MilestoneNodeMeshProps {
  milestones: Milestone[];
  hoveredIndex: number | null;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
}

const MilestoneNodesScene: React.FC<MilestoneNodeMeshProps> = ({
  milestones,
  hoveredIndex,
  onSelect,
  reducedMotion,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const count = milestones.length;
  const spacing = count > 1 ? Math.min(2.1, 6.2 / count) : 0;
  const startX = -((count - 1) * spacing) / 2;

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      state.pointer.x * 0.2,
      0.06
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      -state.pointer.y * 0.15,
      0.06
    );
    groupRef.current.children.forEach((child, idx) => {
      if (child.type === 'Group') {
        child.rotation.y += delta * (hoveredIndex === idx ? 1.6 : 0.6);
      }
    });
  });

  const getColorForStatus = (status: string) => {
    const norm = status.toLowerCase();
    if (norm === 'completed') return '#10b981';
    if (norm === 'in progress') return '#06b6d4';
    if (norm === 'blocked') return '#f43f5e';
    return '#6366f1';
  };

  return (
    <group ref={groupRef}>
      {/* Connecting energy conduit line */}
      {count > 1 && (
        <mesh position={[0, 0, -0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, (count - 1) * spacing, 12]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#4f46e5"
            emissiveIntensity={0.6}
            transparent
            opacity={0.45}
          />
        </mesh>
      )}

      {milestones.map((ms, idx) => {
        const x = startX + idx * spacing;
        const color = getColorForStatus(ms.status);
        const isHovered = hoveredIndex === idx;
        return (
          <group
            key={ms.id}
            position={[x, 0, 0]}
            scale={isHovered ? 1.25 : 1}
            onClick={() => onSelect(idx)}
          >
            <mesh>
              <octahedronGeometry args={[0.45, 0]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isHovered ? 1.1 : 0.6}
                roughness={0.2}
                metalness={0.85}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.65, 0.025, 12, 48]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
                transparent
                opacity={0.75}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

interface MilestoneVisualizer3DProps {
  milestones: Milestone[];
}

export const MilestoneVisualizer3D: React.FC<MilestoneVisualizer3DProps> = ({ milestones }) => {
  const reducedMotion = useReducedMotionPreference();
  const webglReady = isWebGLAvailable();
  const [activeIdx, setActiveIdx] = useState<number>(0);

  if (!milestones || milestones.length === 0) {
    return null;
  }

  const selected = milestones[activeIdx] || milestones[0];

  return (
    <div
      className="rounded-2xl border border-indigo-500/25 dark:border-cyan-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/90 text-white p-5 shadow-lg space-y-4"
      data-testid="milestone-visualizer-3d"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-cyan-300">
            3D Milestone Readiness Matrix
          </h3>
          <p className="text-xs text-slate-400">
            Interactive 3D milestone nodes driven by real linked task completion.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-300">
          {milestones.filter((m) => m.status === 'Completed').length} / {milestones.length} Completed
        </span>
      </div>

      {webglReady && (
        <WebGLErrorBoundary fallback={<div className="h-12" />}>
          <div className="h-36 w-full rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
            <Canvas
              camera={{ position: [0, 0, 3.8], fov: 45 }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={0.8} />
              <pointLight position={[4, 3, 4]} intensity={2} color="#38bdf8" />
              <pointLight position={[-4, -2, 3]} intensity={1.4} color="#a855f7" />
              <MilestoneNodesScene
                milestones={milestones.slice(0, 6)}
                hoveredIndex={activeIdx}
                onSelect={setActiveIdx}
                reducedMotion={reducedMotion}
              />
            </Canvas>
          </div>
        </WebGLErrorBoundary>
      )}

      {/* Interactive milestone selector pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {milestones.map((ms, idx) => {
          const isSelected = idx === activeIdx;
          return (
            <button
              key={ms.id}
              type="button"
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => setActiveIdx(idx)}
              className={`text-left p-3 rounded-xl border transition-all text-xs ${
                isSelected
                  ? 'bg-indigo-950/80 border-cyan-400/60 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-800/50 border-slate-700/70 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className="font-semibold truncate text-white">{ms.title}</span>
                <StatusBadge status={ms.status} />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, ms.computed_progress)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-cyan-300">
                  {ms.computed_progress}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Tasks: {ms.completed_tasks}/{ms.total_tasks} Done •{' '}
                {ms.is_required ? 'Required' : 'Optional'}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-400">Selected Milestone: </span>
            <strong className="text-white">{selected.title}</strong>
            {selected.description && (
              <span className="text-slate-400"> — {selected.description}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-cyan-300">
            <span>Progress: {selected.computed_progress}%</span>
            {selected.due_date && <span>Due: {selected.due_date}</span>}
          </div>
        </div>
      )}
    </div>
  );
};
