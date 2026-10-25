import * as THREE from 'three';

/**
 * Deterministic continental landmass approximation in spherical coordinates
 * Returns a value in [0, 1] indicating continental density at (lat, lon) in radians
 */
export function evaluateContinentDensity(lat: number, lon: number): number {
  const degLat = (lat * 180) / Math.PI;
  const degLon = (lon * 180) / Math.PI;

  const gaussian2D = (cLat: number, cLon: number, sLat: number, sLon: number) => {
    const dLat = (degLat - cLat) / sLat;
    let dLon = degLon - cLon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    dLon /= sLon;
    return Math.exp(-0.5 * (dLat * dLat + dLon * dLon));
  };

  // North America
  let v =
    0.95 * gaussian2D(46, -102, 16, 24) +
    0.75 * gaussian2D(60, -115, 10, 22) +
    0.65 * gaussian2D(24, -100, 9, 10);

  // South America
  v +=
    0.95 * gaussian2D(-14, -58, 16, 13) +
    0.75 * gaussian2D(-34, -64, 12, 8);

  // Europe
  v +=
    0.85 * gaussian2D(50, 15, 11, 18) +
    0.7 * gaussian2D(62, 20, 8, 14);

  // Africa
  v +=
    0.95 * gaussian2D(8, 18, 16, 18) +
    0.85 * gaussian2D(-16, 26, 14, 11);

  // Asia
  v +=
    0.95 * gaussian2D(48, 88, 18, 36) +
    0.85 * gaussian2D(28, 106, 14, 18) +
    0.75 * gaussian2D(22, 78, 10, 9) +
    0.75 * gaussian2D(62, 135, 10, 24);

  // Australia & SE Asia archipelago
  v +=
    0.85 * gaussian2D(-25, 134, 10, 14) +
    0.55 * gaussian2D(-4, 118, 7, 16);

  // Add multi-frequency coastline fractal modulation
  const coastlineNoise =
    0.22 * Math.sin(lat * 9.0 + Math.cos(lon * 7.0)) +
    0.14 * Math.cos(lon * 13.0 - lat * 11.0) +
    0.09 * Math.sin(lat * 23.0 + lon * 19.0);

  const combined = v + coastlineNoise * (v > 0.2 ? 1.0 : 0.25);
  return THREE.MathUtils.clamp((combined - 0.36) * 2.4, 0, 1);
}

/**
 * High-resolution procedural PCB circuit matrix & perspective grid floor texture
 */
export function createCircuitFloorTexture(
  maxAnisotropy: number,
  primaryHex = '#22d3ee',
  secondaryHex = '#a855f7'
): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#030914';
  ctx.fillRect(0, 0, size, size);

  const baseGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.48);
  baseGrad.addColorStop(0, 'rgba(14, 116, 144, 0.28)');
  baseGrad.addColorStop(0.35, 'rgba(88, 28, 135, 0.14)');
  baseGrad.addColorStop(0.7, 'rgba(6, 24, 48, 0.08)');
  baseGrad.addColorStop(1, 'rgba(3, 9, 20, 0)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.lineWidth = 1;
  const gridStep = 32;
  for (let i = 0; i <= size; i += gridStep) {
    const isMajor = i % (gridStep * 4) === 0;
    ctx.strokeStyle = isMajor ? 'rgba(34, 211, 238, 0.13)' : 'rgba(34, 211, 238, 0.045)';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const radii = [260, 340, 430, 520, 640, 780, 920];
  radii.forEach((r, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(34, 211, 238, 0.22)' : 'rgba(168, 85, 247, 0.16)';
    ctx.lineWidth = idx === 2 || idx === 4 ? 2 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  for (let deg = 0; deg < 360; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 15 === 0;
    const isMed = deg % 5 === 0;
    const rInner = 522;
    const rOuter = isMajor ? 544 : isMed ? 534 : 528;

    ctx.strokeStyle = isMajor
      ? primaryHex
      : isMed
        ? 'rgba(34, 211, 238, 0.45)'
        : 'rgba(34, 211, 238, 0.18)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
    ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
    ctx.stroke();
  }

  const drawCircuitBus = (
    startAngle: number,
    lanes: number,
    laneSpacing: number,
    segments: { dr: number; da: number }[],
    color: string,
    lineWidth = 2.2
  ) => {
    for (let l = 0; l < lanes; l++) {
      const offset = (l - (lanes - 1) / 2) * laneSpacing;
      let r = 460 + Math.abs(offset) * 0.4;
      let a = startAngle + offset * 0.0018;

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let x = cx + Math.cos(a) * r;
      let y = cy + Math.sin(a) * r;
      ctx.moveTo(x, y);

      const startX = x;
      const startY = y;

      for (const seg of segments) {
        r += seg.dr;
        a += seg.da;
        x = cx + Math.cos(a) * r;
        y = cy + Math.sin(a) * r;
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#030914';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startX, startY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  for (let b = 0; b < 24; b++) {
    const baseAngle = (b / 24) * Math.PI * 2;
    const isSecondary = b % 3 === 1;
    const traceColor = isSecondary
      ? 'rgba(168, 85, 247, 0.55)'
      : b % 2 === 0
        ? 'rgba(34, 211, 238, 0.65)'
        : 'rgba(56, 189, 248, 0.38)';

    const turnDir = b % 2 === 0 ? 1 : -1;
    drawCircuitBus(
      baseAngle,
      b % 4 === 0 ? 5 : 3,
      9,
      [
        { dr: 95, da: 0 },
        { dr: 65, da: 0.14 * turnDir },
        { dr: 140, da: 0 },
        { dr: 70, da: -0.1 * turnDir },
        { dr: 160, da: 0 },
      ],
      traceColor,
      b % 4 === 0 ? 2.4 : 1.7
    );
  }

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 36; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const yStart = 240 + ((k * 47) % (size - 480));
    const xStart = cx + side * (480 + (k % 5) * 42);
    const xMid1 = xStart + side * 90;
    const yMid1 = yStart + (k % 3 === 0 ? 60 : -60);
    const xMid2 = xMid1 + side * 140;
    const yEnd = yMid1 + (k % 2 === 0 ? 45 : -45);
    const xEnd = xMid2 + side * 120;

    ctx.strokeStyle = k % 4 === 0 ? secondaryHex : primaryHex;
    ctx.globalAlpha = k % 3 === 0 ? 0.55 : 0.32;
    ctx.beginPath();
    ctx.moveTo(xStart, yStart);
    ctx.lineTo(xMid1, yMid1);
    ctx.lineTo(xMid2, yMid1);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();

    ctx.fillStyle = k % 4 === 0 ? secondaryHex : primaryHex;
    ctx.beginPath();
    ctx.arc(xEnd, yEnd, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * High-resolution radial Vernier & tachometer dial decal texture
 */
export function createTelemetryDialTexture(
  maxAnisotropy: number,
  primaryHex = '#22d3ee',
  secondaryHex = '#a855f7'
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  const arcSegments = [
    { start: 0.1, end: 1.3, r: 460, width: 10, color: primaryHex, alpha: 0.85 },
    { start: 1.5, end: 2.8, r: 460, width: 6, color: secondaryHex, alpha: 0.7 },
    { start: 3.1, end: 4.5, r: 460, width: 12, color: primaryHex, alpha: 0.9 },
    { start: 4.7, end: 6.0, r: 460, width: 6, color: primaryHex, alpha: 0.55 },
    { start: 0.4, end: 2.1, r: 390, width: 8, color: secondaryHex, alpha: 0.8 },
    { start: 2.5, end: 3.8, r: 390, width: 4, color: primaryHex, alpha: 0.6 },
    { start: 4.1, end: 5.9, r: 390, width: 9, color: secondaryHex, alpha: 0.85 },
  ];

  arcSegments.forEach((seg) => {
    ctx.save();
    ctx.strokeStyle = seg.color;
    ctx.globalAlpha = seg.alpha;
    ctx.lineWidth = seg.width;
    ctx.beginPath();
    ctx.arc(cx, cy, seg.r, seg.start, seg.end);
    ctx.stroke();
    ctx.restore();
  });

  for (let i = 0; i < 240; i++) {
    const angle = (i / 240) * Math.PI * 2;
    const isMajor = i % 10 === 0;
    const r0 = 415;
    const r1 = isMajor ? 442 : 428;
    ctx.strokeStyle = isMajor ? primaryHex : 'rgba(224, 242, 254, 0.45)';
    ctx.lineWidth = isMajor ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.stroke();
  }

  for (let i = 0; i < 120; i++) {
    const angle = (i / 120) * Math.PI * 2;
    const r0 = 285;
    const r1 = i % 5 === 0 ? 308 : 296;
    ctx.strokeStyle = i % 5 === 0 ? secondaryHex : 'rgba(192, 132, 252, 0.4)';
    ctx.lineWidth = i % 5 === 0 ? 2.2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Soft radial optical flare / contact shadow texture
 */
export function createRadialGlowTexture(
  innerColor = 'rgba(255, 255, 255, 1)',
  midColor = 'rgba(34, 211, 238, 0.55)',
  outerColor = 'rgba(34, 211, 238, 0)'
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.28, midColor);
  grad.addColorStop(1, outerColor);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
