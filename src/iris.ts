import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════════════
   VEIN CANVAS  —  radial vein drawing shared by roughMap and normalMap
   ═══════════════════════════════════════════════════════════════════════════ */

export function generateVeinCanvas(w = 1024, h = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Lighter base — veins will appear darker by contrast
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(0, 0, w, h);

  // Vein origin — bottom-center in UV space
  const ox = w * 0.5;
  const oy = h * 0.96;

  ctx.lineCap = 'round';

  // Draw a single vein segment with slight S-curve
  function drawVein(
    x: number, y: number,
    angle: number, len: number,
    lineW: number, alpha: number
  ): [number, number] {
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;

    // S-curve: two control points offset laterally in opposite directions
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);
    const cp1x = x + (ex - x) * 0.33 + perpX * len * 0.08;
    const cp1y = y + (ey - y) * 0.33 + perpY * len * 0.08;
    const cp2x = x + (ex - x) * 0.66 - perpX * len * 0.06;
    const cp2y = y + (ey - y) * 0.66 - perpY * len * 0.06;

    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = Math.max(0.3, lineW);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
    ctx.stroke();

    return [ex, ey];
  }

  // 36 primary veins spreading ±90° upward
  const n = 36;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const spread = (t - 0.5) * Math.PI; // ±90°
    const angle = -Math.PI / 2 + spread; // upward in canvas coords
    const edgeFactor = 1 - Math.pow(Math.abs(t - 0.5) * 2, 1.5) * 0.3;
    const primaryLen = h * 0.62 * edgeFactor;
    const lw = 1.6 - Math.abs(t - 0.5) * 1.2;

    // Draw primary vein and collect points for lateral branches
    const branchFracs = [0.25, 0.50, 0.75, 0.90];
    let px = ox;
    let py = oy;

    // Step along primary vein to plant branches
    for (let seg = 0; seg < branchFracs.length + 1; seg++) {
      const fracStart = seg === 0 ? 0 : branchFracs[seg - 1];
      const fracEnd = seg < branchFracs.length ? branchFracs[seg] : 1.0;
      const segLen = primaryLen * (fracEnd - fracStart);

      const [ex, ey] = drawVein(px, py, angle, segLen, lw * (1 - seg * 0.12), 0.85 - seg * 0.08);

      // Plant lateral branch at start of this segment
      if (seg < branchFracs.length) {
        const side = (seg % 2 === 0) ? 1 : -1;
        const branchAngle = angle + side * (0.3 + Math.random() * 0.2);
        const branchLen = primaryLen * 0.18 * (1 - branchFracs[seg] * 0.5);
        drawVein(px, py, branchAngle, branchLen, lw * 0.45, 0.6);
      }

      px = ex;
      py = ey;
    }
  }

  // Fine secondary layer: 900 tiny random scratches oriented mostly upward
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    // Bias toward upward direction (angle near -PI/2)
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.5;
    const l = 4 + Math.random() * 14;
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }

  return canvas;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VEIN MAPS  —  roughMap + Sobel-derived normalMap from the same canvas
   ═══════════════════════════════════════════════════════════════════════════ */

export function generateVeinMaps(
  w = 1024,
  h = 1024
): { roughMap: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const sourceCanvas = generateVeinCanvas(w, h);

  // roughMap: direct canvas texture
  const roughMap = new THREE.CanvasTexture(sourceCanvas);
  roughMap.wrapS = THREE.RepeatWrapping;
  roughMap.wrapT = THREE.RepeatWrapping;

  // Read source pixels for Sobel
  const srcCtx = sourceCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const src = srcData.data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const normalCtx = normalCanvas.getContext('2d')!;
  const normalImg = normalCtx.createImageData(w, h);
  const dst = normalImg.data;

  const strength = 8.0;

  function getHeight(x: number, y: number): number {
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    const idx = (cy * w + cx) * 4;
    // invert: dark vein = groove = low height
    return (255 - src[idx]) / 255;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = getHeight(x - 1, y - 1);
      const tc = getHeight(x,     y - 1);
      const tr = getHeight(x + 1, y - 1);
      const ml = getHeight(x - 1, y);
      // const mc = getHeight(x, y); // center not needed
      const mr = getHeight(x + 1, y);
      const bl = getHeight(x - 1, y + 1);
      const bc = getHeight(x,     y + 1);
      const br = getHeight(x + 1, y + 1);

      // Sobel
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

      let nx = -gx * strength;
      let ny = -gy * strength;
      let nz = 1.0;

      // Normalize
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * w + x) * 4;
      dst[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  normalCtx.putImageData(normalImg, 0, 0);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  return { roughMap, normalMap };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PETAL GEOMETRY — parametric surface with rounder/wider falls
   ═══════════════════════════════════════════════════════════════════════════ */

interface PetalConfig {
  length: number;
  maxWidth: number;
  droop: number;
  cup: number;
  waviness: number;
  edgeRuffle: number;
  twist: number;
  uSegs: number;
  vSegs: number;
}

function buildPetalGeo(cfg: PetalConfig, isStandard = false): THREE.BufferGeometry {
  const { length, maxWidth, droop, cup, waviness, edgeRuffle, twist, uSegs, vSegs } = cfg;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;

    // Rounder, wider width envelope
    const wenv = Math.pow(Math.sin(u * Math.PI), 0.6);
    const halfW = maxWidth * wenv;

    // Spine trajectory
    const spineAngle = isStandard ? -u * u * droop : u * u * droop;
    const spineY = isStandard
      ? u * length * Math.cos(u * 0.3)
      : -Math.sin(spineAngle) * length * u * 0.52;
    const spineZ = isStandard
      ? Math.sin(u * Math.PI * 0.42) * length * 0.4 + u * length * 0.12
      : Math.cos(spineAngle * 0.48) * length * u;

    const twistA = twist * u;
    const cosT = Math.cos(twistA);
    const sinT = Math.sin(twistA);

    for (let j = 0; j <= vSegs; j++) {
      const v = j / vSegs;
      const cv = (v - 0.5) * 2; // −1…+1

      const px = halfW * cv;

      // Cup (cross-section concavity)
      const cupY = cup * (1 - cv * cv) * halfW * 0.2 * Math.sin(u * Math.PI);

      // Internal waviness (organic surface)
      const wPhase = v * Math.PI * 6 + u * Math.PI * 4.5;
      const wAmp = waviness * halfW * Math.sin(u * Math.PI);
      const waveX = Math.sin(wPhase) * wAmp * 0.3;
      const waveY = Math.cos(wPhase * 1.3) * wAmp * 0.5;

      // Edge ruffle — only at edges (|cv| > 0.4), quadratic fade to center
      const edgeProx = Math.pow(Math.max(0, Math.abs(cv) - 0.4) / 0.6, 2.0);
      const rPhase = v * Math.PI * 11 + u * Math.PI * 5.5;
      const rAmp = edgeRuffle * halfW * 0.16 * edgeProx * Math.sin(u * Math.PI);
      const rufX = Math.sin(rPhase) * rAmp;
      const rufY = Math.cos(rPhase * 0.85) * rAmp;

      // Apply twist
      const rx = (px + waveX + rufX) * cosT - cupY * sinT;
      const ry = (px + waveX + rufX) * sinT + cupY * cosT;

      positions.push(rx, spineY + ry + waveY + rufY, spineZ);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = i * (vSegs + 1) + j;
      const b = (i + 1) * (vSegs + 1) + j;
      const c = (i + 1) * (vSegs + 1) + j + 1;
      const d = i * (vSegs + 1) + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATERIALS
   ═══════════════════════════════════════════════════════════════════════════ */

export function makePetalMaterial(
  envMap: THREE.Texture,
  roughMap: THREE.CanvasTexture,
  normalMap: THREE.CanvasTexture
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.02, 0.04, 0.10),      // near-black dark navy glass
    transmission: 0.85,
    opacity: 1.0,
    transparent: true,
    thickness: 0.14,
    roughness: 0.020,
    roughnessMap: roughMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(5.5, 5.5),
    metalness: 0.0,
    ior: 1.52,
    specularIntensity: 1.4,
    specularColor: new THREE.Color(0.90, 0.95, 1.0),
    attenuationColor: new THREE.Color(0.12, 0.20, 0.55),
    attenuationDistance: 0.35,
    iridescence: 0.45,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [150, 500] as [number, number],
    clearcoat: 0.0,                                // off — mid-roughness PMREM = cube face squares
    clearcoatRoughness: 0.20,
    sheen: 0.0,
    side: THREE.DoubleSide,
    envMap,
    envMapIntensity: 0.5,
  });
}

export function makeStemMaterial(envMap: THREE.Texture): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.008, 0.022, 0.012),   // near-black dark green
    roughness: 0.7,
    metalness: 0.0,
    transmission: 0.05,
    thickness: 0.3,
    ior: 1.35,
    side: THREE.DoubleSide,
    envMap,
    envMapIntensity: 0.05,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOWER ASSEMBLY
   ═══════════════════════════════════════════════════════════════════════════ */

export function createIrisFlower(
  envMap: THREE.Texture,
  roughMap: THREE.CanvasTexture,
  normalMap: THREE.CanvasTexture,
  opts: { detail?: number } = {}
): THREE.Group {
  const detail = opts.detail ?? 1.0;
  const s = (n: number) => Math.max(4, Math.round(n * detail));
  const flower = new THREE.Group();

  const petalMat = makePetalMaterial(envMap, roughMap, normalMap);

  // ── Falls (3 × broad drooping outer petals) ─────────────────────────────
  const fallGeo = buildPetalGeo({
    length: 0.78,
    maxWidth: 0.50,
    droop: 1.55,
    cup: 0.55,
    waviness: 0.06,
    edgeRuffle: 0.9,
    twist: 0.26,
    uSegs: s(68),
    vSegs: s(36),
  });

  for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(fallGeo, petalMat);
    p.rotation.y = (k / 3) * Math.PI * 2;
    p.rotation.x = 0.06;
    flower.add(p);
  }

  // ── Standards (3 × tall upright inner petals) ────────────────────────────
  const stdGeo = buildPetalGeo(
    {
      length: 0.84,
      maxWidth: 0.42,
      droop: 0.65,
      cup: 0.85,
      waviness: 0.04,
      edgeRuffle: 0.85,
      twist: -0.3,
      uSegs: s(58),
      vSegs: s(32),
    },
    true
  );

  for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(stdGeo, petalMat);
    p.rotation.y = ((k + 0.5) / 3) * Math.PI * 2;
    p.rotation.x = -0.1;
    flower.add(p);
  }

  // ── Style arms hidden — blade shape catches sharp reflections at roughness 0.02

  // ── Stem + 2 bracts (hidden — breaks dark atmosphere) ────────────────────
  if (false && detail > 0.9) {
    const stemMat = makeStemMaterial(envMap);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3(0.03, -0.6, 0.02),
      new THREE.Vector3(-0.02, -1.2, -0.04),
      new THREE.Vector3(0.01, -1.9, 0.03),
    ]);
    const stemGeo = new THREE.TubeGeometry(curve, 28, 0.022, 7, false);
    flower.add(new THREE.Mesh(stemGeo, stemMat));

    const bractGeo = buildPetalGeo({
      length: 0.26, maxWidth: 0.065, droop: 0.72,
      cup: 0.25, waviness: 0.01, edgeRuffle: 0.2,
      twist: 0, uSegs: s(14), vSegs: s(8),
    });
    for (let k = 0; k < 2; k++) {
      const b = new THREE.Mesh(bractGeo, stemMat);
      b.position.set(0, -0.72 - k * 0.32, 0);
      b.rotation.y = k * Math.PI + 0.4;
      b.rotation.x = 0.32;
      flower.add(b);
    }
  }

  flower.position.set(0, 0.22, 0);
  return flower;
}
