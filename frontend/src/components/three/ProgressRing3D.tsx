import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layers } from 'lucide-react';
import { Milestone, Task } from '../../types';
import {
  isSoftwareWebGL,
  isWebGLAvailable,
  useReducedMotionPreference,
} from './webglUtils';

export interface ProgressRing3DProps {
  percentage: number;
  label?: string;
  sublabel?: string;
  size?: number;
  eligible?: boolean;
  tasks?: Task[];
  milestones?: Milestone[];
  completedWeight?: number;
  totalWeight?: number;
  completedTasks?: number;
  totalTasks?: number;
  blockedTasks?: number;
  className?: string;
}

export const ProgressRing3D: React.FC<ProgressRing3DProps> = ({
  percentage,
  label = 'Deterministic',
  sublabel,
  size,
  eligible,
  tasks,
  milestones = [],
  completedWeight,
  totalWeight,
  completedTasks,
  totalTasks,
  blockedTasks = 0,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPreference();
  const webglReady = isWebGLAvailable();
  const clamped = Math.max(0, Math.min(100, Number(percentage.toFixed(1))));

  const derivedTotalTasks = tasks ? tasks.length : totalTasks ?? 0;
  const derivedDoneTasks = tasks
    ? tasks.filter((t) => t.status === 'Done').length
    : completedTasks ?? 0;
  const derivedTotalWeight = tasks
    ? Number(tasks.reduce((acc, t) => acc + (t.weight || 1), 0).toFixed(1))
    : totalWeight ?? derivedTotalTasks;
  const derivedDoneWeight = tasks
    ? Number(
        tasks
          .filter((t) => t.status === 'Done')
          .reduce((acc, t) => acc + (t.weight || 1), 0)
          .toFixed(1)
      )
    : completedWeight ?? Number(((clamped / 100) * (derivedTotalWeight || 1)).toFixed(1));

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !webglReady) return;

    const isSoftwareGl = isSoftwareWebGL();
    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;

    try {
      const width = container.clientWidth || size || 300;
      const height = container.clientHeight || (size ? size : 185);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
      camera.position.set(0, 2.2, 3.4);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

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

      const ambientLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 1.4);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
      dirLight.position.set(3, 4, 3);
      scene.add(dirLight);

      const visualGroup = new THREE.Group();
      scene.add(visualGroup);

      let slices: Array<{ name: string; weight: number; color: number; emissive: number }> = [];

      if (tasks && tasks.length > 0) {
        const doneW = tasks
          .filter((t) => t.status === 'Done')
          .reduce((acc, t) => acc + (t.weight || 1), 0);
        const inProgressW = tasks
          .filter((t) => t.status === 'In Progress')
          .reduce((acc, t) => acc + (t.weight || 1), 0);
        const inReviewW = tasks
          .filter((t) => t.status === 'In Review')
          .reduce((acc, t) => acc + (t.weight || 1), 0);
        const blockedW = tasks
          .filter((t) => t.status === 'Blocked')
          .reduce((acc, t) => acc + (t.weight || 1), 0);
        const todoW = tasks
          .filter((t) => t.status === 'To Do')
          .reduce((acc, t) => acc + (t.weight || 1), 0);

        slices = [
          { name: 'Done', weight: doneW, color: 0x10b981, emissive: 0x059669 },
          { name: 'In Progress', weight: inProgressW, color: 0x06b6d4, emissive: 0x0284c7 },
          { name: 'In Review', weight: inReviewW, color: 0x8b5cf6, emissive: 0x7c3aed },
          { name: 'Blocked', weight: blockedW, color: 0xef4444, emissive: 0xb91c1c },
          { name: 'To Do', weight: todoW, color: 0x475569, emissive: 0x1e293b },
        ];
      } else {
        const donePortion = Math.max(0, clamped);
        const blockedPortion = blockedTasks > 0 ? Math.min(100 - donePortion, 20) : 0;
        const inProgPortion =
          donePortion < 100 ? Math.max(0, (100 - donePortion - blockedPortion) * 0.55) : 0;
        const reviewPortion =
          donePortion < 100 ? Math.max(0, (100 - donePortion - blockedPortion) * 0.25) : 0;
        const todoPortion = Math.max(
          0,
          100 - donePortion - blockedPortion - inProgPortion - reviewPortion
        );

        slices = [
          { name: 'Done', weight: donePortion, color: 0x10b981, emissive: 0x059669 },
          { name: 'In Progress', weight: inProgPortion, color: 0x06b6d4, emissive: 0x0284c7 },
          { name: 'In Review', weight: reviewPortion, color: 0x8b5cf6, emissive: 0x7c3aed },
          { name: 'Blocked', weight: blockedPortion, color: 0xef4444, emissive: 0xb91c1c },
          {
            name: 'To Do',
            weight: todoPortion > 0 ? todoPortion : donePortion === 0 ? 100 : 0,
            color: 0x475569,
            emissive: 0x1e293b,
          },
        ];
      }

      const totalSliceWeight = slices.reduce((acc, s) => acc + s.weight, 0) || 1;
      let currentAngle = 0;
      const radius = 1.05;
      const tubeRadius = 0.11;

      slices.forEach((slice) => {
        if (slice.weight <= 0) return;
        const arcLength = (slice.weight / totalSliceWeight) * Math.PI * 2;
        const arcGeo = new THREE.TorusGeometry(radius, tubeRadius, 16, 32, arcLength);
        const arcMat = new THREE.MeshStandardMaterial({
          color: slice.color,
          emissive: slice.emissive,
          emissiveIntensity: 0.45,
          roughness: 0.2,
          metalness: 0.85,
        });
        const arcMesh = new THREE.Mesh(arcGeo, arcMat);
        arcMesh.rotation.x = Math.PI * 0.5;
        arcMesh.rotation.z = currentAngle;
        visualGroup.add(arcMesh);
        currentAngle += arcLength;
      });

      const coreCylinderGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 32);
      const coreCylinderMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.9,
      });
      const coreCylinder = new THREE.Mesh(coreCylinderGeo, coreCylinderMat);
      visualGroup.add(coreCylinder);

      const innerRingGeo = new THREE.TorusGeometry(0.62, 0.02, 16, 48);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: eligible ? 0x10b981 : 0x38bdf8,
        transparent: true,
        opacity: 0.8,
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.rotation.x = Math.PI * 0.5;
      visualGroup.add(innerRing);

      const milestoneGroup = new THREE.Group();
      visualGroup.add(milestoneGroup);

      const beaconItems =
        milestones.length > 0
          ? milestones.slice(0, 6).map((m) => ({ completed: m.status === 'Completed' }))
          : [{ completed: clamped >= 25 }, { completed: clamped >= 60 }, { completed: clamped >= 100 }];

      beaconItems.forEach((m, idx) => {
        const angle = (idx / Math.max(1, beaconItems.length)) * Math.PI * 2;
        const beaconDist = 1.38;
        const beaconGeo = new THREE.ConeGeometry(0.06, 0.2, 8);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: m.completed ? 0x10b981 : 0x64748b,
          emissive: m.completed ? 0x059669 : 0x1e293b,
          emissiveIntensity: m.completed ? 0.7 : 0.2,
          roughness: 0.2,
          metalness: 0.9,
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        beaconMesh.position.set(Math.cos(angle) * beaconDist, 0.1, Math.sin(angle) * beaconDist);
        beaconMesh.rotation.x = Math.PI;
        milestoneGroup.add(beaconMesh);
      });

      const clock = new THREE.Clock();

      const tick = () => {
        frameId = requestAnimationFrame(tick);
        const delta = clock.getDelta();
        if (!reducedMotion) {
          visualGroup.rotation.y += delta * 0.35;
          innerRing.rotation.z -= delta * 0.8;
        }
        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      tick();

      const handleResize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth || size || 300;
        const h = container.clientHeight || (size ? size : 185);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        if (renderer) {
          renderer.dispose();
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
        }
        visualGroup.clear();
        scene.clear();
      };
    } catch {
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
  }, [clamped, eligible, tasks, milestones, blockedTasks, size, webglReady, reducedMotion]);

  if (size && size <= 150) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-slate-900/90 border border-slate-800 inline-flex items-center justify-center select-none ${className}`}
        style={{ width: size, height: size }}
        data-testid="progress-ring-3d"
      >
        <div ref={mountRef} className="w-full h-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
          <span className="text-lg font-black text-white tracking-tight drop-shadow-md">
            {clamped}%
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400">
            {label}
          </span>
          {sublabel && <span className="text-[9px] text-slate-400">{sublabel}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-800/90 dark:bg-slate-900/90 border border-slate-700/80 dark:border-slate-800 shadow-inner ${className}`}
      data-testid="progress-ring-3d"
    >
      <div ref={mountRef} className="w-full h-48 cursor-grab" />

      <div className="absolute inset-0 bottom-8 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-white tracking-tight drop-shadow-md">
          {clamped}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
          {label}
        </span>
      </div>

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 bg-slate-950/85 rounded-xl border border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{derivedDoneWeight} Done pts</span>
        </div>
        <div className="text-slate-600">|</div>
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          <Layers className="w-3 h-3 text-cyan-400" />
          <span>{derivedTotalWeight} Total Wgt</span>
        </div>
        <div className="text-slate-600">|</div>
        <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
          <span>{sublabel || `${derivedDoneTasks}/${derivedTotalTasks} Tasks`}</span>
        </div>
      </div>
    </div>
  );
};
