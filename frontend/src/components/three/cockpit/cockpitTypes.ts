export type SubsystemId =
  | 'core-globe'
  | 'diagonal-accelerator'
  | 'violet-harmonic-ring'
  | 'cyan-telemetry-dial'
  | 'titanium-gimbal'
  | 'constellation-left'
  | 'constellation-right'
  | 'circuit-matrix';

export type ControlMode = 'nominal' | 'gimbal' | 'overdrive' | 'diagnostic';

export type CameraPreset = 'cockpit' | 'zenith' | 'equatorial' | 'macro' | 'constellation';

export type ColorThemeId = 'cyan-violet' | 'cobalt-titanium' | 'emerald-quantum' | 'solar-amber';

export interface SubsystemSpec {
  id: SubsystemId;
  title: string;
  category: string;
  summary: string;
  equationTitle: string;
  equationLatex: string;
  secondaryEquation: string;
  metrics: {
    label: string;
    value: string;
    unit: string;
  }[];
  cameraTarget: [number, number, number];
  cameraOffset: [number, number, number];
}

export interface ColorThemeSpec {
  id: ColorThemeId;
  name: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
}

export const COLOR_THEMES: Record<ColorThemeId, ColorThemeSpec> = {
  'cyan-violet': {
    id: 'cyan-violet',
    name: 'Cyan · Violet',
    primaryHex: '#22d3ee',
    secondaryHex: '#a855f7',
    accentHex: '#38bdf8',
    primaryColor: 0x22d3ee,
    secondaryColor: 0xa855f7,
    accentColor: 0x38bdf8,
  },
  'cobalt-titanium': {
    id: 'cobalt-titanium',
    name: 'Cobalt · Ice',
    primaryHex: '#38bdf8',
    secondaryHex: '#818cf8',
    accentHex: '#e0f2fe',
    primaryColor: 0x38bdf8,
    secondaryColor: 0x818cf8,
    accentColor: 0xe0f2fe,
  },
  'emerald-quantum': {
    id: 'emerald-quantum',
    name: 'Emerald · Cyan',
    primaryHex: '#34d399',
    secondaryHex: '#06b6d4',
    accentHex: '#a7f3d0',
    primaryColor: 0x34d399,
    secondaryColor: 0x06b6d4,
    accentColor: 0xa7f3d0,
  },
  'solar-amber': {
    id: 'solar-amber',
    name: 'Amber · Violet',
    primaryHex: '#f59e0b',
    secondaryHex: '#ec4899',
    accentHex: '#fde68a',
    primaryColor: 0xf59e0b,
    secondaryColor: 0xec4899,
    accentColor: 0xfde68a,
  },
};

export const SUBSYSTEM_SPECS: Record<SubsystemId, SubsystemSpec> = {
  'core-globe': {
    id: 'core-globe',
    title: 'Planetary Quantum Core',
    category: 'Central State Manifold',
    summary:
      'High-density geodesic point-cloud globe and brushed titanium inner core synchronizing global telemetry nodes across 6,400 surface coordinates.',
    equationTitle: 'State-Space Transfer Function',
    equationLatex: 'X(s) = ℓ(k² + (1 / Ms) ρ(σ² - nᵢ²))',
    secondaryEquation: '= (αᵢ(a² - s)) + ln ℓᵢ(a² - s)',
    metrics: [
      { label: 'Surface Nodes', value: '6,400', unit: 'pts' },
      { label: 'Phase Coherence', value: '99.94', unit: '%' },
      { label: 'Core Radius', value: '1.65', unit: 'm' },
    ],
    cameraTarget: [0, 1.85, 0],
    cameraOffset: [0, 2.8, 5.2],
  },
  'diagonal-accelerator': {
    id: 'diagonal-accelerator',
    title: 'Inclined Orbital Accelerator',
    category: 'Relativistic Phase Conduit',
    summary:
      '32-degree inclined plasma wave-guide and dual photon relay satellites sweeping across the planetary equator for deterministic clock synchronization.',
    equationTitle: 'Orbital Flux Invariant',
    equationLatex: '∮ B · dl = μ₀ I_enc + μ₀ ε₀ (dΦ_E / dt)',
    secondaryEquation: 'ω_orb = √(GM / r³) · cos(32.4°)',
    metrics: [
      { label: 'Inclination', value: '32.40', unit: 'deg' },
      { label: 'Beam Luminance', value: '1,420', unit: 'cd/m²' },
      { label: 'Relay Harmonics', value: '2.40', unit: 'THz' },
    ],
    cameraTarget: [0, 1.85, 0],
    cameraOffset: [3.2, 3.1, 4.4],
  },
  'violet-harmonic-ring': {
    id: 'violet-harmonic-ring',
    title: 'Inner Harmonic Containment Ring',
    category: 'Phase Damping Torus',
    summary:
      'Counter-rotating violet field stabilizer ring engineered to suppress non-linear state perturbations and maintain Lyapunov stability.',
    equationTitle: 'Lyapunov Stability Criterion',
    equationLatex: 'V(x) > 0,  dV(x)/dt = ∇V · f(x) ≤ -γ ‖x‖²',
    secondaryEquation: 'πᵢ (0ᵢ² - p₁⁰¹) + sin√(1 - α · Δt²)',
    metrics: [
      { label: 'Inner Diameter', value: '4.40', unit: 'm' },
      { label: 'Damping Ratio ζ', value: '0.842', unit: 'crit' },
      { label: 'Field Spectral', value: '405', unit: 'nm' },
    ],
    cameraTarget: [0, 1.0, 0],
    cameraOffset: [-2.8, 3.4, 5.6],
  },
  'cyan-telemetry-dial': {
    id: 'cyan-telemetry-dial',
    title: 'Primary Cyan Telemetry Ring',
    category: 'Deterministic Azimuth Vernier',
    summary:
      'Precision-machined segmented azimuth ring with 180 instanced optical tick markers and real-time angular velocity encoding.',
    equationTitle: 'Euler-Lagrange Telemetry Action',
    equationLatex: '∫ (∂L/∂q - d/dt (∂L/∂q̇)) dt = 0.023',
    secondaryEquation: '∂f(a)/∂t = (∂a/∂t - k₀) / cos(a)',
    metrics: [
      { label: 'Optical Ticks', value: '180', unit: 'seg' },
      { label: 'Angular Resolution', value: '0.005', unit: 'rad' },
      { label: 'Outer Diameter', value: '6.80', unit: 'm' },
    ],
    cameraTarget: [0, 0.8, 0],
    cameraOffset: [0, 4.8, 7.5],
  },
  'titanium-gimbal': {
    id: 'titanium-gimbal',
    title: 'Outer Titanium Gimbal & Beacons',
    category: 'Structural Frame & Optical Pods',
    summary:
      'Anisotropic brushed titanium outer containment ring housing 4 cardinal optical collimator beacons and multi-axis gyroscopic trunnions.',
    equationTitle: 'Rigid-Body Gyroscopic Torque',
    equationLatex: 'τ = I · α + ω × (I · ω)',
    secondaryEquation: 'J_gimbal = diag(I_xx, I_yy, I_zz)',
    metrics: [
      { label: 'Beacon Pods', value: '4', unit: 'units' },
      { label: 'Alloy Roughness', value: '0.20', unit: 'Ra' },
      { label: 'Ring Span', value: '8.60', unit: 'm' },
    ],
    cameraTarget: [0, 0.7, 0],
    cameraOffset: [4.8, 3.6, 7.2],
  },
  'constellation-left': {
    id: 'constellation-left',
    title: 'Western Telemetry Mesh Array',
    category: 'Triangulated Sensor Graph',
    summary:
      'Spatial constellation of 14 octahedral relay nodes executing continuous variational state estimation on incoming boundary streams.',
    equationTitle: 'Variational Telemetry Integral',
    equationLatex: '∫ f(x, 0) / ∂(x, t) = ΔU·t / k·cos(a)',
    secondaryEquation: '= ∂f(a)/∂t · 1.654 ρ',
    metrics: [
      { label: 'Mesh Vertices', value: '14', unit: 'nodes' },
      { label: 'Graph Edges', value: '26', unit: 'links' },
      { label: 'Sync Drift', value: '0.023', unit: 'ms' },
    ],
    cameraTarget: [-3.8, 2.1, 0.4],
    cameraOffset: [-5.8, 3.2, 5.4],
  },
  'constellation-right': {
    id: 'constellation-right',
    title: 'Eastern Deterministic Solver Cluster',
    category: 'Eigenstate Projection Graph',
    summary:
      'High-altitude geometric relay cluster resolving non-linear differential boundary conditions and projecting state trajectories.',
    equationTitle: 'Boundary Value Projection',
    equationLatex: 'T⁻¹ · lim [exp(-s·t) · L(q)] = 0',
    secondaryEquation: 'Δk_p · ((e - s·t)/(t²·A_p)) = 1.000',
    metrics: [
      { label: 'Solver Nodes', value: '14', unit: 'nodes' },
      { label: 'Eigen Convergence', value: '99.98', unit: '%' },
      { label: 'Step Horizon', value: '128', unit: 'ticks' },
    ],
    cameraTarget: [3.8, 2.2, -0.3],
    cameraOffset: [5.8, 3.2, 5.4],
  },
  'circuit-matrix': {
    id: 'circuit-matrix',
    title: 'Planar PCB Bus & Data Conduits',
    category: 'Deterministic Substrate Plane',
    summary:
      'Multi-layer radial and 45-degree Manhattan circuit trace matrix routing high-frequency deterministic control packets to the core plinth.',
    equationTitle: 'Transmission Line Telegrapher Eq',
    equationLatex: '∂²V/∂x² = L·C (∂²V/∂t²) + (R·C + G·L)(∂V/∂t)',
    secondaryEquation: 'Z₀ = √((R + jωL) / (G + jωC)) = 50.0 Ω',
    metrics: [
      { label: 'Active Packets', value: '48', unit: 'lanes' },
      { label: 'Bus Impedance', value: '50.0', unit: 'Ω' },
      { label: 'Propagation', value: '0.88', unit: 'c' },
    ],
    cameraTarget: [0, 0.1, 1.5],
    cameraOffset: [0, 6.5, 9.2],
  },
};

export interface ScreenAnchorPositions {
  leftTelemetry: { x: number; y: number; visible: boolean };
  rightEquation: { x: number; y: number; visible: boolean };
  bottomEquation: { x: number; y: number; visible: boolean };
  coreCenter: { x: number; y: number; visible: boolean };
}
