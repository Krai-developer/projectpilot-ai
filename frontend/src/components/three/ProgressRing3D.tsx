import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  isWebGLAvailable,
  useReducedMotionPreference,
  WebGLErrorBoundary,
} from './webglUtils';

interface ProgressRing3DProps {
  percentage: number;
  label?: string;
  sublabel?: string;
  size?: number;
  eligible?: boolean;
}

interface RingMeshProps {
  percentage: number;
  eligible?: boolean;
  reducedMotion: boolean;
}

const DimensionalProgressRingMesh: React.FC<RingMeshProps> = ({
  percentage,
  eligible,
  reducedMotion,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const innerCoreRef = useRef<THREE.Mesh>(null);
  const clamped = Math.max(0, Math.min(100, percentage));
  const arcAngle = useMemo(() => (clamped / 100) * Math.PI * 2, [clamped]);

  const primaryColor = eligible ? '#10b981' : clamped >= 75 ? '#06b6d4' : '#6366f1';
  const accentColor = eligible ? '#34d399' : '#a855f7';

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (!reducedMotion) {
      const targetX = state.pointer.y * 0.28;
      const targetY = state.pointer.x * 0.28;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.08);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.08);
    }
    if (innerCoreRef.current && !reducedMotion) {
      innerCoreRef.current.rotation.z += delta * 0.45;
      innerCoreRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Background track torus */}
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[1.45, 0.14, 24, 96]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.35}
          metalness={0.7}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Active completion progress torus arc */}
      {arcAngle > 0.01 && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[1.45, 0.17, 28, 96, arcAngle]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={0.65}
            roughness={0.2}
            metalness={0.85}
          />
        </mesh>
      )}

      {/* Outer orbital halo ring */}
      <mesh rotation={[Math.PI / 5, Math.PI / 6, 0]}>
        <torusGeometry args={[1.82, 0.025, 16, 80]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Inner crystalline polyhedron */}
      <mesh ref={innerCoreRef}>
        <octahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={accentColor}
          emissiveIntensity={0.35}
          wireframe
        />
      </mesh>
    </group>
  );
};

const FallbackProgressRing: React.FC<ProgressRing3DProps> = ({
  percentage,
  label,
  sublabel,
  size = 160,
  eligible,
}) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const stroke = 10;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: size, height: size }}
      data-testid="progress-ring-3d"
    >
      <svg width={size} height={size} className="-rotate-90 drop-shadow-md">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={eligible ? '#10b981' : '#06b6d4'}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className="font-mono text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
          {clamped}%
        </span>
        {label && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            {label}
          </span>
        )}
        {sublabel && <span className="text-[10px] text-slate-500">{sublabel}</span>}
      </div>
    </div>
  );
};

export const ProgressRing3D: React.FC<ProgressRing3DProps> = (props) => {
  const { percentage, label, sublabel, size = 168, eligible } = props;
  const reducedMotion = useReducedMotionPreference();
  const webglReady = isWebGLAvailable();
  const clamped = Math.max(0, Math.min(100, percentage));

  if (!webglReady) {
    return <FallbackProgressRing {...props} />;
  }

  return (
    <WebGLErrorBoundary fallback={<FallbackProgressRing {...props} />}>
      <div
        className="relative inline-flex items-center justify-center select-none"
        style={{ width: size, height: size }}
        data-testid="progress-ring-3d"
      >
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.75} />
          <pointLight position={[4, 4, 4]} intensity={1.8} color="#38bdf8" />
          <pointLight position={[-4, -3, 3]} intensity={1.2} color="#a855f7" />
          <DimensionalProgressRingMesh
            percentage={clamped}
            eligible={eligible}
            reducedMotion={reducedMotion}
          />
        </Canvas>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span className="font-mono text-base font-extrabold tracking-tight text-slate-900 dark:text-white drop-shadow">
            {clamped}%
          </span>
          {label && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{sublabel}</span>
          )}
        </div>
      </div>
    </WebGLErrorBoundary>
  );
};
