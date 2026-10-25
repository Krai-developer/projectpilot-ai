import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CameraPreset,
  COLOR_THEMES,
  ColorThemeId,
  ControlMode,
  ScreenAnchorPositions,
  SUBSYSTEM_SPECS,
  SubsystemId,
} from './cockpitTypes';
import {
  createCircuitFloorTexture,
  createRadialGlowTexture,
  createTelemetryDialTexture,
  evaluateContinentDensity,
} from './proceduralTextures';
import { isSoftwareWebGL } from '../webglUtils';

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _ndc = new THREE.Vector3();

export interface CockpitSceneCallbacks {
  onSubsystemSelect: (id: SubsystemId | null) => void;
  onSubsystemHover: (id: SubsystemId | null) => void;
  onAnchorsUpdate: (
    anchors: ScreenAnchorPositions,
    liveStats: {
      orbitalRpm: number;
      phaseError: number;
      gimbalPitch: number;
      gimbalRoll: number;
    }
  ) => void;
}

interface DataPacketLane {
  angle: number;
  radiusStart: number;
  radiusEnd: number;
  speed: number;
  progress: number;
  turnOffset: number;
  isSecondary: boolean;
}

export class CockpitSceneController {
  private container: HTMLElement;
  private callbacks: CockpitSceneCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private frameId = 0;
  private isDisposed = false;
  private resizeObserver?: ResizeObserver;

  private targetExplosion = 0;
  private currentExplosion = 0;
  private targetSpeedMultiplier = 1.0;
  private currentSpeedMultiplier = 1.0;
  private controlMode: ControlMode = 'nominal';
  private colorTheme: ColorThemeId = 'cyan-violet';
  private wireframeDiagnostic = false;

  private cameraTransitionActive = false;
  private desiredCameraPos = new THREE.Vector3(0, 5.2, 10.4);
  private desiredCameraTarget = new THREE.Vector3(0, 1.35, 0);

  private rootGroup = new THREE.Group();
  private coreAssemblyGroup = new THREE.Group();
  private innerMetallicCore!: THREE.Mesh;
  private globePoints!: THREE.Points;
  private latitudeCageGroup = new THREE.Group();
  private outerCrystalShell!: THREE.Mesh;
  private diagonalAcceleratorGroup = new THREE.Group();
  private photonNodeA!: THREE.Mesh;
  private photonNodeB!: THREE.Mesh;

  private violetHarmonicGroup = new THREE.Group();
  private cyanTelemetryGroup = new THREE.Group();
  private outerGimbalGroup = new THREE.Group();
  private dialDecalMesh!: THREE.Mesh;
  private tickInstancedMesh!: THREE.InstancedMesh;
  private dataPacketInstancedMesh!: THREE.InstancedMesh;
  private dataPacketLanes: DataPacketLane[] = [];

  private leftConstellationGroup = new THREE.Group();
  private rightConstellationGroup = new THREE.Group();
  private circuitPlinthGroup = new THREE.Group();

  private corePointLight!: THREE.PointLight;
  private accentVioletLight!: THREE.PointLight;
  private primaryEmissiveMaterials: (
    | THREE.MeshStandardMaterial
    | THREE.MeshPhysicalMaterial
    | THREE.MeshBasicMaterial
    | THREE.LineBasicMaterial
  )[] = [];
  private secondaryEmissiveMaterials: (
    | THREE.MeshStandardMaterial
    | THREE.MeshPhysicalMaterial
    | THREE.MeshBasicMaterial
    | THREE.LineBasicMaterial
  )[] = [];
  private flareSprites: THREE.Sprite[] = [];
  private diagnosticMaterials: THREE.MeshStandardMaterial[] = [];

  private anchorLeft3D = new THREE.Vector3(-4.5, 2.55, 0.4);
  private anchorRight3D = new THREE.Vector3(4.3, 2.75, -0.3);
  private anchorBottom3D = new THREE.Vector3(2.9, 0.35, 3.2);
  private anchorCore3D = new THREE.Vector3(0, 1.85, 0);

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-999, -999);
  private proxyMeshes: THREE.Mesh[] = [];
  private hoveredSubsystem: SubsystemId | null = null;
  private selectedSubsystem: SubsystemId | null = 'core-globe';
  private lastRaycastTime = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private frameCounter = 0;

  constructor(container: HTMLElement, callbacks: CockpitSceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = isSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030914);
    this.scene.fog = new THREE.FogExp2(0x030914, 0.026);

    if (!this.isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(
        new RoomEnvironment(),
        0.04
      ).texture;
      pmremGenerator.dispose();
    }

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    this.camera.position.set(0, 5.2, 10.4);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minPolarAngle = 0.12;
    this.controls.minDistance = 3.6;
    this.controls.maxDistance = 22.0;
    this.controls.target.set(0, 1.35, 0);
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.cameraTransitionActive = false;
    });

    this.raycaster.layers.set(1);

    this.setupLighting();
    this.buildCompositeCockpit();
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
  }

  private setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x050b18, 0.85);
    hemiLight.position.set(0, 18, 0);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2);
    keyLight.position.set(7, 14, 8);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 32;
    const d = 9;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.6);
    rimLight.position.set(-8, 6, -9);
    this.scene.add(rimLight);

    this.corePointLight = new THREE.PointLight(0x22d3ee, 5.5, 16, 1.5);
    this.corePointLight.position.set(0, 1.85, 0);
    this.scene.add(this.corePointLight);

    this.accentVioletLight = new THREE.PointLight(0xa855f7, 4.2, 14, 1.5);
    this.accentVioletLight.position.set(-1.5, 1.4, 1.5);
    this.scene.add(this.accentVioletLight);
  }

  private buildCompositeCockpit() {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const glowTex = createRadialGlowTexture(
      'rgba(255, 255, 255, 1)',
      'rgba(34, 211, 238, 0.65)',
      'rgba(34, 211, 238, 0)'
    );
    const violetGlowTex = createRadialGlowTexture(
      'rgba(255, 255, 255, 0.95)',
      'rgba(168, 85, 247, 0.65)',
      'rgba(168, 85, 247, 0)'
    );

    this.scene.add(this.rootGroup);

    this.circuitPlinthGroup.position.set(0, 0, 0);
    this.rootGroup.add(this.circuitPlinthGroup);

    const floorTexture = createCircuitFloorTexture(maxAnisotropy);
    const floorGeo = new THREE.PlaneGeometry(34, 34);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.45,
      metalness: 0.65,
      emissive: new THREE.Color(0x0c4a6e),
      emissiveMap: floorTexture,
      emissiveIntensity: 0.75,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0.0;
    floorMesh.receiveShadow = true;
    this.circuitPlinthGroup.add(floorMesh);

    const shadowTex = createRadialGlowTexture(
      'rgba(2, 6, 14, 0.82)',
      'rgba(2, 6, 14, 0.45)',
      'rgba(2, 6, 14, 0)'
    );
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 11.5),
      contactShadowMat
    );
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.02;
    this.circuitPlinthGroup.add(contactShadowMesh);

    const pedestalPoints = [
      new THREE.Vector2(1.4, 0.0),
      new THREE.Vector2(2.35, 0.0),
      new THREE.Vector2(2.25, 0.14),
      new THREE.Vector2(1.95, 0.18),
      new THREE.Vector2(1.55, 0.18),
      new THREE.Vector2(1.4, 0.06),
    ];
    const pedestalGeo = new THREE.LatheGeometry(pedestalPoints, 64);
    const darkTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.92,
      roughness: 0.24,
    });
    this.diagnosticMaterials.push(darkTitaniumMat);
    const pedestalMesh = new THREE.Mesh(pedestalGeo, darkTitaniumMat);
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    this.circuitPlinthGroup.add(pedestalMesh);

    const packetCount = 48;
    const packetGeo = new THREE.BoxGeometry(0.18, 0.025, 0.055);
    const packetMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    this.dataPacketInstancedMesh = new THREE.InstancedMesh(
      packetGeo,
      packetMat,
      packetCount
    );
    this.dataPacketInstancedMesh.frustumCulled = false;

    for (let i = 0; i < packetCount; i++) {
      const isSecondary = i % 3 === 0;
      this.dataPacketLanes.push({
        angle: (i / packetCount) * Math.PI * 2,
        radiusStart: 4.5,
        radiusEnd: 13.5,
        speed: 1.4 + (i % 5) * 0.45,
        progress: (i * 0.19) % 1.0,
        turnOffset: (i % 2 === 0 ? 1 : -1) * 0.12,
        isSecondary,
      });
      _color.setHex(isSecondary ? 0xc084fc : 0x22d3ee);
      this.dataPacketInstancedMesh.setColorAt(i, _color);
    }
    this.dataPacketInstancedMesh.instanceColor!.needsUpdate = true;
    this.circuitPlinthGroup.add(this.dataPacketInstancedMesh);

    this.createSubsystemProxy(
      'circuit-matrix',
      new THREE.CylinderGeometry(6.8, 6.8, 0.12, 32),
      new THREE.Vector3(0, 0.06, 0),
      this.circuitPlinthGroup
    );

    this.violetHarmonicGroup.position.set(0, 0.42, 0);
    this.rootGroup.add(this.violetHarmonicGroup);

    const violetCarrierPts = [
      new THREE.Vector2(1.92, -0.06),
      new THREE.Vector2(2.34, -0.06),
      new THREE.Vector2(2.38, 0.02),
      new THREE.Vector2(2.3, 0.08),
      new THREE.Vector2(1.96, 0.08),
      new THREE.Vector2(1.9, 0.02),
    ];
    const violetCarrierGeo = new THREE.LatheGeometry(violetCarrierPts, 96);
    const violetCarrierMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      metalness: 0.85,
      roughness: 0.2,
    });
    this.diagnosticMaterials.push(violetCarrierMat);
    const violetCarrierMesh = new THREE.Mesh(violetCarrierGeo, violetCarrierMat);
    this.violetHarmonicGroup.add(violetCarrierMesh);

    const violetTorusGeo = new THREE.TorusGeometry(2.14, 0.045, 24, 128);
    violetTorusGeo.rotateX(Math.PI / 2);
    const violetEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: new THREE.Color(0xa855f7),
      emissiveIntensity: 2.6,
      roughness: 0.15,
      metalness: 0.1,
    });
    this.secondaryEmissiveMaterials.push(violetEmissiveMat);
    const violetTorusMesh = new THREE.Mesh(violetTorusGeo, violetEmissiveMat);
    violetTorusMesh.position.y = 0.08;
    this.violetHarmonicGroup.add(violetTorusMesh);

    const violetInnerRingGeo = new THREE.RingGeometry(1.72, 1.78, 96);
    violetInnerRingGeo.rotateX(-Math.PI / 2);
    const violetInnerMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    this.secondaryEmissiveMaterials.push(violetInnerMat);
    const violetInnerMesh = new THREE.Mesh(violetInnerRingGeo, violetInnerMat);
    violetInnerMesh.position.y = 0.09;
    this.violetHarmonicGroup.add(violetInnerMesh);

    this.createSubsystemProxy(
      'violet-harmonic-ring',
      new THREE.TorusGeometry(2.14, 0.26, 12, 48).rotateX(Math.PI / 2),
      new THREE.Vector3(0, 0.05, 0),
      this.violetHarmonicGroup
    );

    this.cyanTelemetryGroup.position.set(0, 0.36, 0);
    this.rootGroup.add(this.cyanTelemetryGroup);

    const cyanBasePts = [
      new THREE.Vector2(2.65, -0.08),
      new THREE.Vector2(3.55, -0.08),
      new THREE.Vector2(3.62, 0.0),
      new THREE.Vector2(3.5, 0.07),
      new THREE.Vector2(2.72, 0.07),
      new THREE.Vector2(2.62, 0.0),
    ];
    const cyanBaseGeo = new THREE.LatheGeometry(cyanBasePts, 128);
    const brushedSlateMat = new THREE.MeshStandardMaterial({
      color: 0x0f2942,
      metalness: 0.78,
      roughness: 0.52,
    });
    this.diagnosticMaterials.push(brushedSlateMat);
    const cyanBaseMesh = new THREE.Mesh(cyanBaseGeo, brushedSlateMat);
    cyanBaseMesh.castShadow = true;
    cyanBaseMesh.receiveShadow = true;
    this.cyanTelemetryGroup.add(cyanBaseMesh);

    const cyanTorusGeo = new THREE.TorusGeometry(3.08, 0.055, 24, 160);
    cyanTorusGeo.rotateX(Math.PI / 2);
    const cyanEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: new THREE.Color(0x22d3ee),
      emissiveIntensity: 2.8,
      roughness: 0.12,
      metalness: 0.1,
    });
    this.primaryEmissiveMaterials.push(cyanEmissiveMat);
    const cyanTorusMesh = new THREE.Mesh(cyanTorusGeo, cyanEmissiveMat);
    cyanTorusMesh.position.y = 0.08;
    this.cyanTelemetryGroup.add(cyanTorusMesh);

    const arcConfigs = [
      { start: -0.4, len: 1.45, rIn: 3.16, rOut: 3.44, isViolet: false },
      { start: 1.4, len: 1.1, rIn: 3.18, rOut: 3.38, isViolet: true },
      { start: 2.85, len: 1.55, rIn: 3.16, rOut: 3.44, isViolet: false },
      { start: 4.7, len: 0.85, rIn: 3.18, rOut: 3.36, isViolet: true },
    ];
    arcConfigs.forEach((cfg) => {
      const arcGeo = new THREE.RingGeometry(
        cfg.rIn,
        cfg.rOut,
        64,
        1,
        cfg.start,
        cfg.len
      );
      arcGeo.rotateX(-Math.PI / 2);
      const mat = cfg.isViolet ? violetEmissiveMat : cyanEmissiveMat;
      const arcMesh = new THREE.Mesh(arcGeo, mat);
      arcMesh.position.y = 0.085;
      this.cyanTelemetryGroup.add(arcMesh);
    });

    const tickCount = 180;
    const tickGeo = new THREE.BoxGeometry(0.14, 0.028, 0.024);
    const tickMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.5,
    });
    this.tickInstancedMesh = new THREE.InstancedMesh(
      tickGeo,
      tickMat,
      tickCount
    );

    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const isMajor = i % 15 === 0;
      const isMedium = i % 5 === 0;
      const lengthScale = isMajor ? 2.1 : isMedium ? 1.45 : 0.85;
      const radius = 2.84 + (lengthScale - 1) * 0.05;

      _vec3.set(Math.cos(angle) * radius, 0.09, Math.sin(angle) * radius);
      _euler.set(0, -angle, 0);
      _quat.setFromEuler(_euler);
      _scale.set(lengthScale, isMajor ? 1.5 : 1.0, isMajor ? 1.4 : 1.0);
      _mat4.compose(_vec3, _quat, _scale);
      this.tickInstancedMesh.setMatrixAt(i, _mat4);

      if (isMajor) {
        _color.setHex(0xffffff);
      } else if (i > 45 && i < 90) {
        _color.setHex(0xc084fc);
      } else {
        _color.setHex(0x22d3ee);
      }
      this.tickInstancedMesh.setColorAt(i, _color);
    }
    this.tickInstancedMesh.instanceMatrix.needsUpdate = true;
    this.tickInstancedMesh.instanceColor!.needsUpdate = true;
    this.tickInstancedMesh.computeBoundingSphere();
    this.cyanTelemetryGroup.add(this.tickInstancedMesh);

    const dialTex = createTelemetryDialTexture(maxAnisotropy);
    const dialMat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.dialDecalMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(8.2, 8.2),
      dialMat
    );
    this.dialDecalMesh.rotation.x = -Math.PI / 2;
    this.dialDecalMesh.position.y = 0.075;
    this.cyanTelemetryGroup.add(this.dialDecalMesh);

    this.createSubsystemProxy(
      'cyan-telemetry-dial',
      new THREE.TorusGeometry(3.15, 0.38, 12, 64).rotateX(Math.PI / 2),
      new THREE.Vector3(0, 0.05, 0),
      this.cyanTelemetryGroup
    );

    this.outerGimbalGroup.position.set(0, 0.3, 0);
    this.rootGroup.add(this.outerGimbalGroup);

    const outerTitaniumMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.94,
      roughness: 0.18,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    this.diagnosticMaterials.push(outerTitaniumMat);

    const outerGimbalGeo = new THREE.TorusGeometry(4.25, 0.09, 20, 144);
    outerGimbalGeo.rotateX(Math.PI / 2);
    const outerGimbalMesh = new THREE.Mesh(outerGimbalGeo, outerTitaniumMat);
    outerGimbalMesh.castShadow = true;
    outerGimbalMesh.receiveShadow = true;
    this.outerGimbalGroup.add(outerGimbalMesh);

    const outerTrimGeo = new THREE.TorusGeometry(4.02, 0.032, 16, 144);
    outerTrimGeo.rotateX(Math.PI / 2);
    const outerTrimMesh = new THREE.Mesh(outerTrimGeo, violetEmissiveMat);
    outerTrimMesh.position.y = 0.03;
    this.outerGimbalGroup.add(outerTrimMesh);

    const beaconAngles = [
      Math.PI * 0.18,
      Math.PI * 0.72,
      Math.PI * 1.18,
      Math.PI * 1.72,
    ];
    beaconAngles.forEach((ang, idx) => {
      const podGroup = new THREE.Group();
      podGroup.position.set(Math.cos(ang) * 4.18, 0.06, Math.sin(ang) * 4.18);
      podGroup.rotation.y = -ang;

      const housingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.18, 0.56),
        outerTitaniumMat
      );
      podGroup.add(housingMesh);

      const emitterMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 0.12, 24),
        idx % 2 === 0 ? cyanEmissiveMat : violetEmissiveMat
      );
      emitterMesh.position.y = 0.11;
      podGroup.add(emitterMesh);

      const spriteMat = new THREE.SpriteMaterial({
        map: idx % 2 === 0 ? glowTex : violetGlowTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const flare = new THREE.Sprite(spriteMat);
      flare.scale.set(1.65, 1.65, 1);
      flare.position.set(0, 0.18, 0);
      podGroup.add(flare);
      this.flareSprites.push(flare);

      this.outerGimbalGroup.add(podGroup);
    });

    this.createSubsystemProxy(
      'titanium-gimbal',
      new THREE.TorusGeometry(4.2, 0.32, 12, 64).rotateX(Math.PI / 2),
      new THREE.Vector3(0, 0.05, 0),
      this.outerGimbalGroup
    );

    this.coreAssemblyGroup.position.set(0, 1.85, 0);
    this.rootGroup.add(this.coreAssemblyGroup);

    const innerCoreGeo = new THREE.SphereGeometry(1.42, 64, 64);
    const innerCoreMat = new THREE.MeshPhysicalMaterial({
      color: 0x071328,
      metalness: 0.85,
      roughness: 0.25,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color(0x1e1b4b),
      emissiveIntensity: 0.55,
    });
    this.diagnosticMaterials.push(innerCoreMat);
    this.innerMetallicCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    this.coreAssemblyGroup.add(this.innerMetallicCore);

    const latMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
    });
    this.primaryEmissiveMaterials.push(latMat);

    for (let latIdx = -3; latIdx <= 3; latIdx++) {
      const latAngle = (latIdx / 4) * (Math.PI / 2);
      const r = Math.cos(latAngle) * 1.48;
      const y = Math.sin(latAngle) * 1.48;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 72; s++) {
        const theta = (s / 72) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      this.latitudeCageGroup.add(new THREE.Line(lineGeo, latMat));
    }
    this.coreAssemblyGroup.add(this.latitudeCageGroup);

    const numGlobePoints = 6400;
    const positions = new Float32Array(numGlobePoints * 3);
    const colors = new Float32Array(numGlobePoints * 3);
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    let validCount = 0;
    for (let i = 0; i < numGlobePoints * 2 && validCount < numGlobePoints; i++) {
      const t = i / (numGlobePoints * 2);
      const inclination = Math.acos(1 - 2 * t);
      const azimuth = (2 * Math.PI * i) / goldenRatio;

      const lat = Math.PI / 2 - inclination;
      const lon = (azimuth % (Math.PI * 2)) - Math.PI;
      const landDensity = evaluateContinentDensity(lat, lon);

      const isGridPoint = i % 7 === 0;
      if (landDensity > 0.15 || isGridPoint) {
        const radius = landDensity > 0.15 ? 1.52 + landDensity * 0.025 : 1.49;
        const x = radius * Math.sin(inclination) * Math.cos(azimuth);
        const y = radius * Math.cos(inclination);
        const z = radius * Math.sin(inclination) * Math.sin(azimuth);

        positions[validCount * 3] = x;
        positions[validCount * 3 + 1] = y;
        positions[validCount * 3 + 2] = z;

        const blend = THREE.MathUtils.clamp((x + y * 0.6 + 1.5) / 3.0, 0, 1);
        if (landDensity > 0.15) {
          _color.setRGB(
            THREE.MathUtils.lerp(0.68, 0.15, blend),
            THREE.MathUtils.lerp(0.32, 0.88, blend),
            THREE.MathUtils.lerp(0.98, 0.99, blend)
          );
        } else {
          _color.setRGB(0.08, 0.32, 0.55);
        }
        colors[validCount * 3] = _color.r;
        colors[validCount * 3 + 1] = _color.g;
        colors[validCount * 3 + 2] = _color.b;
        validCount++;
      }
    }

    const globePointGeo = new THREE.BufferGeometry();
    globePointGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(positions.slice(0, validCount * 3), 3)
    );
    globePointGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(colors.slice(0, validCount * 3), 3)
    );

    const globePointMat = new THREE.PointsMaterial({
      size: 0.036,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.globePoints = new THREE.Points(globePointGeo, globePointMat);
    this.coreAssemblyGroup.add(this.globePoints);

    const outerShellGeo = new THREE.SphereGeometry(1.72, 64, 64);
    const outerShellMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.05,
      roughness: 0.08,
      transmission: this.isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: this.isSoftwareGl ? 0.18 : 0.45,
      ior: 1.52,
      thickness: 0.6,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      depthWrite: false,
    });
    this.outerCrystalShell = new THREE.Mesh(outerShellGeo, outerShellMat);
    this.outerCrystalShell.renderOrder = 5;
    this.coreAssemblyGroup.add(this.outerCrystalShell);

    const haloCount = 900;
    const haloPos = new Float32Array(haloCount * 3);
    for (let i = 0; i < haloCount; i++) {
      const u = (i + 0.5) / haloCount;
      const inc = Math.acos(1 - 2 * u);
      const az = (2 * Math.PI * i) / goldenRatio;
      const r = 1.88 + (i % 3) * 0.06;
      haloPos[i * 3] = r * Math.sin(inc) * Math.cos(az);
      haloPos[i * 3 + 1] = r * Math.cos(inc);
      haloPos[i * 3 + 2] = r * Math.sin(inc) * Math.sin(az);
    }
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
    const haloMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.025,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloPoints = new THREE.Points(haloGeo, haloMat);
    this.coreAssemblyGroup.add(haloPoints);

    this.createSubsystemProxy(
      'core-globe',
      new THREE.SphereGeometry(1.62, 24, 24),
      new THREE.Vector3(0, 0, 0),
      this.coreAssemblyGroup
    );

    this.diagonalAcceleratorGroup.rotation.set(0.32, 0.18, -0.58);
    this.coreAssemblyGroup.add(this.diagonalAcceleratorGroup);

    const accelRingGeo = new THREE.TorusGeometry(1.78, 0.024, 20, 128);
    accelRingGeo.rotateX(Math.PI / 2);
    const accelRingMesh = new THREE.Mesh(accelRingGeo, cyanEmissiveMat);
    this.diagonalAcceleratorGroup.add(accelRingMesh);

    const accelOuterGeo = new THREE.TorusGeometry(1.94, 0.012, 16, 128);
    accelOuterGeo.rotateX(Math.PI / 2);
    const accelOuterMesh = new THREE.Mesh(accelOuterGeo, violetEmissiveMat);
    this.diagonalAcceleratorGroup.add(accelOuterMesh);

    const photonGeo = new THREE.SphereGeometry(0.065, 16, 16);
    const photonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.photonNodeA = new THREE.Mesh(photonGeo, photonMat);
    this.photonNodeB = new THREE.Mesh(photonGeo, photonMat);

    const createPhotonFlare = (scale: number) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        })
      );
      s.scale.set(scale, scale, 1);
      this.flareSprites.push(s);
      return s;
    };
    this.photonNodeA.add(createPhotonFlare(1.45));
    this.photonNodeB.add(createPhotonFlare(1.15));

    this.diagonalAcceleratorGroup.add(this.photonNodeA);
    this.diagonalAcceleratorGroup.add(this.photonNodeB);

    this.createSubsystemProxy(
      'diagonal-accelerator',
      new THREE.TorusGeometry(1.85, 0.18, 12, 48).rotateX(Math.PI / 2),
      new THREE.Vector3(0, 0, 0),
      this.diagonalAcceleratorGroup
    );

    this.buildConstellationCluster(
      this.leftConstellationGroup,
      new THREE.Vector3(-4.1, 1.9, 0.5),
      'constellation-left',
      glowTex,
      101
    );
    this.rootGroup.add(this.leftConstellationGroup);

    this.buildConstellationCluster(
      this.rightConstellationGroup,
      new THREE.Vector3(4.1, 2.0, -0.4),
      'constellation-right',
      violetGlowTex,
      202
    );
    this.rootGroup.add(this.rightConstellationGroup);
  }

  private buildConstellationCluster(
    targetGroup: THREE.Group,
    centerOffset: THREE.Vector3,
    subsystemId: SubsystemId,
    flareTexture: THREE.Texture,
    seed: number
  ) {
    targetGroup.position.copy(centerOffset);

    const nodeCount = 14;
    const nodePositions: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const s1 = Math.sin(seed + i * 1.73);
      const s2 = Math.cos(seed * 0.7 + i * 2.31);
      const s3 = Math.sin(seed * 1.3 + i * 3.17);
      nodePositions.push(
        new THREE.Vector3(s1 * 1.55, s2 * 1.05, s3 * 1.25)
      );
    }

    const octGeo = new THREE.OctahedronGeometry(0.055, 0);
    const octMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const instancedNodes = new THREE.InstancedMesh(octGeo, octMat, nodeCount);
    nodePositions.forEach((pos, idx) => {
      _quat.identity();
      const s = 0.85 + (idx % 3) * 0.22;
      _scale.set(s, s, s);
      _mat4.compose(pos, _quat, _scale);
      instancedNodes.setMatrixAt(idx, _mat4);
    });
    instancedNodes.instanceMatrix.needsUpdate = true;
    instancedNodes.computeBoundingSphere();
    targetGroup.add(instancedNodes);

    for (let i = 0; i < 4; i++) {
      const hubSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flareTexture,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        })
      );
      hubSprite.position.copy(nodePositions[i]);
      hubSprite.scale.set(0.45, 0.45, 1);
      targetGroup.add(hubSprite);
    }

    const linePts: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (nodePositions[i].distanceTo(nodePositions[j]) < 1.65) {
          linePts.push(nodePositions[i], nodePositions[j]);
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.42,
    });
    this.primaryEmissiveMaterials.push(lineMat);
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    targetGroup.add(lineSegments);

    this.createSubsystemProxy(
      subsystemId,
      new THREE.BoxGeometry(2.8, 2.0, 2.2),
      new THREE.Vector3(0, 0, 0),
      targetGroup
    );
  }

  private createSubsystemProxy(
    id: SubsystemId,
    geometry: THREE.BufferGeometry,
    position: THREE.Vector3,
    parent: THREE.Object3D
  ) {
    const proxyMat = new THREE.MeshBasicMaterial({
      visible: false,
    });
    const proxyMesh = new THREE.Mesh(geometry, proxyMat);
    proxyMesh.position.copy(position);
    proxyMesh.layers.set(1);
    proxyMesh.userData.subsystemId = id;
    parent.add(proxyMesh);
    this.proxyMeshes.push(proxyMesh);
  }

  public setExplosionFactor(value: number) {
    this.targetExplosion = THREE.MathUtils.clamp(value, 0, 1);
  }

  public setSpeedMultiplier(value: number) {
    this.targetSpeedMultiplier = THREE.MathUtils.clamp(value, 0, 3);
  }

  public setControlMode(mode: ControlMode) {
    this.controlMode = mode;
    if (mode === 'overdrive') {
      this.targetSpeedMultiplier = 2.2;
    } else if (mode === 'nominal') {
      this.targetSpeedMultiplier = 1.0;
    } else if (mode === 'diagnostic') {
      this.targetExplosion = Math.max(this.targetExplosion, 0.55);
    }

    const isDiag = mode === 'diagnostic';
    if (this.wireframeDiagnostic !== isDiag) {
      this.wireframeDiagnostic = isDiag;
      this.diagnosticMaterials.forEach((m) => {
        m.wireframe = isDiag;
      });
    }
  }

  public setColorTheme(themeId: ColorThemeId) {
    this.colorTheme = themeId;
    const spec = COLOR_THEMES[themeId];
    this.corePointLight.color.setHex(spec.primaryColor);
    this.accentVioletLight.color.setHex(spec.secondaryColor);

    this.primaryEmissiveMaterials.forEach((mat) => {
      mat.color.setHex(spec.accentColor);
      if ('emissive' in mat) {
        mat.emissive.setHex(spec.primaryColor);
      }
    });
    this.secondaryEmissiveMaterials.forEach((mat) => {
      mat.color.setHex(spec.secondaryColor);
      if ('emissive' in mat) {
        mat.emissive.setHex(spec.secondaryColor);
      }
    });
  }

  public setCameraPreset(preset: CameraPreset) {
    this.cameraTransitionActive = true;
    switch (preset) {
      case 'cockpit':
        this.desiredCameraPos.set(0, 5.2, 10.4);
        this.desiredCameraTarget.set(0, 1.35, 0);
        break;
      case 'zenith':
        this.desiredCameraPos.set(0, 13.8, 0.8);
        this.desiredCameraTarget.set(0, 0.6, 0);
        break;
      case 'equatorial':
        this.desiredCameraPos.set(-7.6, 2.1, 6.8);
        this.desiredCameraTarget.set(0, 1.65, 0);
        break;
      case 'macro':
        this.desiredCameraPos.set(0.4, 2.45, 4.35);
        this.desiredCameraTarget.set(0, 1.85, 0);
        break;
      case 'constellation':
        this.desiredCameraPos.set(-4.2, 3.8, 8.8);
        this.desiredCameraTarget.set(-1.2, 1.8, 0);
        break;
    }
  }

  public focusSubsystem(id: SubsystemId | null) {
    this.selectedSubsystem = id;
    if (!id) return;
    const spec = SUBSYSTEM_SPECS[id];
    this.desiredCameraTarget.set(...spec.cameraTarget);
    this.desiredCameraPos.set(...spec.cameraOffset);
    this.cameraTransitionActive = true;
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
  }

  private onResize = () => {
    if (this.isDisposed) return;
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onPointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - this.lastRaycastTime < 45) return;
    this.lastRaycastTime = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.proxyMeshes, false);
    const nextHovered: SubsystemId | null =
      hits.length > 0 ? (hits[0].object.userData.subsystemId as SubsystemId) : null;

    if (nextHovered !== this.hoveredSubsystem) {
      this.hoveredSubsystem = nextHovered;
      this.renderer.domElement.style.cursor = nextHovered ? 'pointer' : 'grab';
      this.callbacks.onSubsystemHover(nextHovered);
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (Math.hypot(dx, dy) > 6) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.proxyMeshes, false);
    if (hits.length > 0) {
      const id = hits[0].object.userData.subsystemId as SubsystemId;
      this.selectedSubsystem = id;
      if (id === 'core-globe' || id === 'diagonal-accelerator') {
        const nextExplode = this.targetExplosion > 0.2 ? 0 : 0.65;
        this.setExplosionFactor(nextExplode);
        this.setControlMode(nextExplode > 0 ? 'gimbal' : 'nominal');
      } else if (id === 'cyan-telemetry-dial' || id === 'violet-harmonic-ring') {
        const isOverdrive = this.controlMode === 'overdrive';
        this.setControlMode(isOverdrive ? 'nominal' : 'overdrive');
      } else {
        this.focusSubsystem(id);
      }
      this.callbacks.onSubsystemSelect(id);
    } else {
      this.setExplosionFactor(0);
      this.setControlMode('nominal');
      this.setCameraPreset('cockpit');
    }
  };

  private afterDraw = (cb: () => void) => {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  };

  private tick = () => {
    if (this.isDisposed) return;

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.1);
    const elapsed = this.clock.getElapsedTime();

    this.currentExplosion = THREE.MathUtils.damp(
      this.currentExplosion,
      this.targetExplosion,
      5.5,
      delta
    );
    this.currentSpeedMultiplier = THREE.MathUtils.damp(
      this.currentSpeedMultiplier,
      this.targetSpeedMultiplier,
      4.5,
      delta
    );

    const dtScaled = delta * this.currentSpeedMultiplier;

    const exp = this.currentExplosion;
    this.coreAssemblyGroup.position.y = 1.85 + exp * 1.45;
    this.outerCrystalShell.scale.setScalar(1.0 + exp * 0.22);
    this.violetHarmonicGroup.position.y = 0.42 + exp * 0.78;
    this.cyanTelemetryGroup.position.y = 0.36 + exp * 0.36;
    this.outerGimbalGroup.position.y = 0.3 + exp * 0.12;
    this.leftConstellationGroup.position.set(
      -4.1 - exp * 0.9,
      1.9 + exp * 0.65,
      0.5
    );
    this.rightConstellationGroup.position.set(
      4.1 + exp * 0.9,
      2.0 + exp * 0.65,
      -0.4
    );

    this.globePoints.rotation.y += dtScaled * 0.22;
    this.innerMetallicCore.rotation.y += dtScaled * 0.22;
    this.latitudeCageGroup.rotation.y -= dtScaled * 0.08;

    this.violetHarmonicGroup.rotation.y -= dtScaled * 0.42;
    this.cyanTelemetryGroup.rotation.y += dtScaled * 0.26;
    this.dialDecalMesh.rotation.z -= dtScaled * 0.15;
    this.outerGimbalGroup.rotation.y -= dtScaled * 0.12;

    const photonAngle = elapsed * 1.35 * this.currentSpeedMultiplier;
    this.photonNodeA.position.set(
      Math.cos(photonAngle) * 1.78,
      0,
      Math.sin(photonAngle) * 1.78
    );
    this.photonNodeB.position.set(
      Math.cos(photonAngle + Math.PI) * 1.78,
      0,
      Math.sin(photonAngle + Math.PI) * 1.78
    );

    const isGimbalActive =
      this.controlMode === 'gimbal' || this.controlMode === 'overdrive';
    const targetPitch = isGimbalActive ? Math.sin(elapsed * 0.85) * 0.28 : 0;
    const targetRoll = isGimbalActive ? Math.cos(elapsed * 0.65) * 0.24 : 0;

    this.violetHarmonicGroup.rotation.x = THREE.MathUtils.damp(
      this.violetHarmonicGroup.rotation.x,
      targetPitch * 1.25,
      4.0,
      delta
    );
    this.violetHarmonicGroup.rotation.z = THREE.MathUtils.damp(
      this.violetHarmonicGroup.rotation.z,
      targetRoll * 1.25,
      4.0,
      delta
    );
    this.cyanTelemetryGroup.rotation.x = THREE.MathUtils.damp(
      this.cyanTelemetryGroup.rotation.x,
      -targetPitch * 0.65,
      4.0,
      delta
    );
    this.cyanTelemetryGroup.rotation.z = THREE.MathUtils.damp(
      this.cyanTelemetryGroup.rotation.z,
      targetRoll * 0.65,
      4.0,
      delta
    );

    for (let i = 0; i < this.dataPacketLanes.length; i++) {
      const lane = this.dataPacketLanes[i];
      lane.progress = (lane.progress + dtScaled * lane.speed * 0.12) % 1.0;
      const r = THREE.MathUtils.lerp(
        lane.radiusEnd,
        lane.radiusStart,
        lane.progress
      );
      const bend =
        lane.progress > 0.35 && lane.progress < 0.65
          ? lane.turnOffset * ((lane.progress - 0.35) / 0.3)
          : lane.progress >= 0.65
            ? lane.turnOffset
            : 0;
      const ang = lane.angle + bend;

      _vec3.set(Math.cos(ang) * r, 0.025, Math.sin(ang) * r);
      _euler.set(0, -ang, 0);
      _quat.setFromEuler(_euler);
      const pulseScale = Math.sin(lane.progress * Math.PI) * 1.35 + 0.25;
      _scale.set(pulseScale, 1, 1);
      _mat4.compose(_vec3, _quat, _scale);
      this.dataPacketInstancedMesh.setMatrixAt(i, _mat4);
    }
    this.dataPacketInstancedMesh.instanceMatrix.needsUpdate = true;

    if (this.cameraTransitionActive) {
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        this.desiredCameraPos.x,
        4.5,
        delta
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        this.desiredCameraPos.y,
        4.5,
        delta
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        this.desiredCameraPos.z,
        4.5,
        delta
      );

      this.controls.target.x = THREE.MathUtils.damp(
        this.controls.target.x,
        this.desiredCameraTarget.x,
        5.0,
        delta
      );
      this.controls.target.y = THREE.MathUtils.damp(
        this.controls.target.y,
        this.desiredCameraTarget.y,
        5.0,
        delta
      );
      this.controls.target.z = THREE.MathUtils.damp(
        this.controls.target.z,
        this.desiredCameraTarget.z,
        5.0,
        delta
      );

      if (
        this.camera.position.distanceToSquared(this.desiredCameraPos) < 0.002 &&
        this.controls.target.distanceToSquared(this.desiredCameraTarget) < 0.002
      ) {
        this.cameraTransitionActive = false;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.frameCounter++;
    if (this.frameCounter % 2 === 0) {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      const projectAnchor = (worldPos: THREE.Vector3, yOffset = 0) => {
        _ndc.copy(worldPos);
        _ndc.y += yOffset;
        _ndc.project(this.camera);
        return {
          x: (_ndc.x * 0.5 + 0.5) * w,
          y: (-(_ndc.y * 0.5) + 0.5) * h,
          visible: _ndc.z < 1.0 && _ndc.x > -0.95 && _ndc.x < 0.95,
        };
      };

      this.callbacks.onAnchorsUpdate(
        {
          leftTelemetry: projectAnchor(this.anchorLeft3D, exp * 0.65),
          rightEquation: projectAnchor(this.anchorRight3D, exp * 0.65),
          bottomEquation: projectAnchor(this.anchorBottom3D, exp * 0.2),
          coreCenter: projectAnchor(this.anchorCore3D, exp * 1.45),
        },
        {
          orbitalRpm: Number((12.4 * this.currentSpeedMultiplier).toFixed(1)),
          phaseError: Number(
            (0.023 + Math.sin(elapsed * 1.7) * 0.002).toFixed(4)
          ),
          gimbalPitch: Number(
            THREE.MathUtils.radToDeg(this.cyanTelemetryGroup.rotation.x).toFixed(1)
          ),
          gimbalRoll: Number(
            THREE.MathUtils.radToDeg(this.cyanTelemetryGroup.rotation.z).toFixed(1)
          ),
        }
      );
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);

    this.controls.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
