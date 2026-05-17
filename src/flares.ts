import * as THREE from 'three';

/* ─── Soft circular glow sprite texture ─────────────────────────────────── */

function makeGlowTexture(size = 64): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0,   'rgba(255,255,255,1.0)');
  g.addColorStop(0.25,'rgba(200,220,255,0.8)');
  g.addColorStop(0.55,'rgba(120,165,255,0.3)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const glowTex = makeGlowTexture(64);

/* ─── Sample mesh vertices into a Float32Array of world positions ────────── */

function sampleMeshVerts(
  mesh: THREE.Mesh,
  stride: number,                // take every Nth vertex
  rng: () => number
): number[] {
  const pos = mesh.geometry.attributes['position'] as THREE.BufferAttribute;
  const pts: number[] = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += stride) {
    tmp.fromBufferAttribute(pos, i);
    // tiny random offset so particles lift slightly off the surface
    tmp.addScaledVector(
      new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
      0.02 + rng() * 0.04    // push further off surface so depth test passes
    );
    mesh.localToWorld(tmp);
    pts.push(tmp.x, tmp.y, tmp.z);
  }
  return pts;
}

/* ─── Build a swarm for one flower group ────────────────────────────────── */

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFlowerFlares(
  flower: THREE.Group,
  opts: {
    stride?: number;      // vertex decimation — 1 = every vertex, 4 = every 4th
    color?: number;
    size?: number;
    opacity?: number;
    seed?: number;
  } = {}
): THREE.Points {
  const { stride = 3, color = 0xb8d0ff, size = 0.006, opacity = 0.55, seed = 0xabcd } = opts;
  const rng = mulberry32(seed);

  const allPts: number[] = [];

  flower.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;
    // only petal/glass meshes (skip rock/ground if ever called on those)
    const m = obj.material as THREE.MeshPhysicalMaterial;
    if (!m || !m.isMeshPhysicalMaterial) return;
    allPts.push(...sampleMeshVerts(obj, stride, rng));
  });

  const buf = new Float32Array(allPts);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));

  // Per-particle random sizes stored as an attribute — used in onBeforeCompile or
  // just left as uniform for simplicity here
  const mat = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    map: glowTex,
    alphaMap: glowTex,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    vertexColors: false,
  });

  return new THREE.Points(geo, mat);
}

/* ─── Animate flare swarms each frame ───────────────────────────────────── */

export function animateFlares(
  swarms: THREE.Points[],
  elapsed: number,
  delta: number
): void {
  swarms.forEach((pts, si) => {
    const pos = pts.geometry.attributes['position'] as THREE.BufferAttribute;
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      // gentle breathing — each particle drifts on a small Lissajous orbit
      const phase = i * 2.399 + si * 1.618;   // golden-ratio spread
      const amp   = 0.0018;
      const spd   = 0.18 + (i % 7) * 0.012;
      pos.setX(i, pos.getX(i) + Math.sin(elapsed * spd + phase)       * amp * delta * 60);
      pos.setY(i, pos.getY(i) + Math.cos(elapsed * spd * 0.7 + phase) * amp * delta * 60);
      pos.setZ(i, pos.getZ(i) + Math.sin(elapsed * spd * 1.3 + phase) * amp * delta * 60);
    }
    pos.needsUpdate = true;
  });
}
