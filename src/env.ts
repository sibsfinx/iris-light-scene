import * as THREE from 'three';

/* ─── Rock base ──────────────────────────────────────────────────────────── */

export function createRockBase(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.025, 0.025, 0.032),
    roughness: 0.94,
    metalness: 0.03,
  });

  const geo = new THREE.IcosahedronGeometry(0.5, 2);
  displace(geo, 0.13);
  const rock = new THREE.Mesh(geo, mat);
  rock.scale.set(1.7, 0.5, 1.3);
  rock.position.set(0, -2.02, 0);
  rock.rotation.y = 0.8;
  group.add(rock);

  const smalls: [number, number, number, number, number][] = [
    [0.75, -2.12, 0.28, 0.34, 1.2],
    [-0.65, -2.18, -0.18, 0.24, 2.5],
    [0.18, -2.2, -0.72, 0.2, 0.4],
    [-0.38, -2.22, 0.55, 0.16, 1.9],
  ];
  for (const [x, y, z, s, ry] of smalls) {
    const g = new THREE.IcosahedronGeometry(0.5, 1);
    displace(g, 0.12);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    m.rotation.y = ry;
    group.add(m);
  }
  return group;
}

function displace(geo: THREE.BufferGeometry, amt: number) {
  const pos = geo.attributes['position'] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    const n = noise3(v.x * 3.7, v.y * 3.7, v.z * 3.7);
    const r = 1 + n * amt;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function noise3(x: number, y: number, z: number) {
  const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  const b = Math.sin(y * 269.5 + z * 183.3) * 43758.5453;
  const c = Math.sin(z * 419.2 + x * 371.9) * 43758.5453;
  return ((a - Math.floor(a)) + (b - Math.floor(b)) + (c - Math.floor(c))) / 3 - 0.5;
}

/* ─── Ground ─────────────────────────────────────────────────────────────── */

export function createGround(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(14, 14);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.015, 0.015, 0.02),
    roughness: 1.0,
    metalness: 0.0,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = -2.3;
  return m;
}

/* ─── Atmospheric fog planes ─────────────────────────────────────────────── */

export function createFogPlanes(): THREE.Group {
  const group = new THREE.Group();
  group.userData['isFog'] = true;

  function shaft(color: number, opacity: number): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true, opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
  }

  // ── Right god-ray shaft (upper-right → lower-left) ─────────────────────
  const sr = shaft(0xd0e8ff, 0.048);
  sr.position.set(1.1, 1.5, -0.4);
  sr.rotation.set(0.32, -0.50, 0.58);
  sr.scale.set(0.5, 5.5, 1);
  group.add(sr);

  const srGlow = shaft(0x8ab0d8, 0.018);
  srGlow.position.set(0.9, 1.3, -0.2);
  srGlow.rotation.set(0.28, -0.46, 0.54);
  srGlow.scale.set(1.6, 5.2, 1);
  group.add(srGlow);

  // ── Left god-ray shaft (upper-left → lower-right) ──────────────────────
  const sl = shaft(0xb0ccee, 0.030);
  sl.position.set(-0.8, 1.3, -0.5);
  sl.rotation.set(0.26, 0.46, -0.52);
  sl.scale.set(0.4, 4.5, 1);
  group.add(sl);

  // ── General haze ───────────────────────────────────────────────────────
  const haze = shaft(0x060e2e, 0.038);
  haze.position.set(0, -0.2, -2.8);
  haze.scale.set(5, 5, 1);
  group.add(haze);

  return group;
}

/* ─── Round sprite for dust particles ───────────────────────────────────── */

function makeRoundSprite(): THREE.CanvasTexture {
  const sz = 32;
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d')!;
  const r = sz / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0,   'rgba(255,255,255,1.0)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(c);
}

const roundSprite = makeRoundSprite();

/* ─── Dust / floating particles ──────────────────────────────────────────── */

export function createDustParticles(): THREE.Group {
  const group = new THREE.Group();

  // Fine dust motes — tiny bright specks
  const dustCount = 600;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3 + 0] = (Math.random() - 0.5) * 6;
    dustPos[i * 3 + 1] = Math.random() * 5 - 1.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xc0d4ff,
    size: 0.004,
    sizeAttenuation: true,
    map: roundSprite,
    alphaMap: roundSprite,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(dustGeo, dustMat));

  // Cool silver micro-specks (lit by the god-rays)
  const silverCount = 120;
  const silverPos = new Float32Array(silverCount * 3);
  for (let i = 0; i < silverCount; i++) {
    silverPos[i * 3 + 0] = (Math.random() - 0.5) * 4;
    silverPos[i * 3 + 1] = Math.random() * 4 - 1;
    silverPos[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  const silverGeo = new THREE.BufferGeometry();
  silverGeo.setAttribute('position', new THREE.Float32BufferAttribute(silverPos, 3));
  const silverMat = new THREE.PointsMaterial({
    color: 0xc8deff,
    size: 0.007,
    sizeAttenuation: true,
    map: roundSprite,
    alphaMap: roundSprite,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(silverGeo, silverMat));

  return group;
}

/* ─── Animate dust (call each frame) ────────────────────────────────────── */

export function animateDust(dust: THREE.Group, elapsed: number, delta: number): void {
  dust.children.forEach((child, idx) => {
    if (!(child instanceof THREE.Points)) return;
    const pos = child.geometry.attributes['position'] as THREE.BufferAttribute;
    const speed = idx === 0 ? 0.025 : 0.018;
    for (let i = 0; i < pos.count; i++) {
      // Float upward, drift sideways
      const y = pos.getY(i) + delta * speed;
      const x = pos.getX(i) + Math.sin(elapsed * 0.15 + i * 0.7) * delta * 0.008;
      pos.setY(i, y > 3.0 ? -1.5 : y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  });
}

/* ─── Background plane ───────────────────────────────────────────────────── */

export type BgColor   = 'deep-blue' | 'stone' | 'forest' | 'burgundy' | 'off';
export type BgTexture = 'solid' | 'gradient' | 'grid' | 'bokeh';

const BG_HEX: Record<BgColor, string> = {
  'deep-blue': '#0e2255',
  'stone':     '#3a2510',
  'forest':    '#102808',
  'burgundy':  '#380c14',
  'off':       '#050305',
};

export function createBackgroundPlane(): {
  mesh: THREE.Mesh;
  set(color: BgColor, tex: BgTexture): void;
} {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  const geo = new THREE.PlaneGeometry(18, 22);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.5, -1.8);   // closer — less fog, clearly behind hero flower
  mesh.renderOrder = -1;

  function set(color: BgColor, type: BgTexture) {
    const ctx = canvas.getContext('2d')!;
    const s = SIZE;
    const hex = BG_HEX[color];
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, s, s);

    if (type === 'gradient') {
      const g = ctx.createRadialGradient(s/2, s*0.42, 0, s/2, s*0.42, s*0.65);
      g.addColorStop(0,   hexAlpha(hex, 0.0));   // lighter center (transparent overlay)
      g.addColorStop(0.5, hexAlpha('#ffffff', 0.04));
      g.addColorStop(1,   hexAlpha('#000000', 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }

    if (type === 'grid') {
      ctx.strokeStyle = hexAlpha('#ffffff', 0.08);
      ctx.lineWidth = 0.6;
      const step = s / 24;
      for (let x = 0; x <= s; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
      }
      for (let y = 0; y <= s; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      }
    }

    if (type === 'bokeh') {
      // Scattered soft light circles — looks like out-of-focus highlights
      const rng = mulberry32(0xdeadbeef);
      for (let i = 0; i < 55; i++) {
        const x = rng() * s, y = rng() * s;
        const r = 8 + rng() * 38;
        const a = 0.03 + rng() * 0.09;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   hexAlpha('#c8deff', a));
        g.addColorStop(0.6, hexAlpha('#8aaeff', a * 0.4));
        g.addColorStop(1,   'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }

    tex.needsUpdate = true;
  }

  set('deep-blue', 'gradient');
  return { mesh, set };
}

function hexAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ─── Sky environment ────────────────────────────────────────────────────── */

export type SkyPreset = 'deep-blue' | 'violet' | 'teal' | 'warm' | 'void';

interface SkyPalette {
  base: string;
  upperTint: string;
  keyGlow: string;
  fillGlow: string;
  accent: string;
}

const SKY_PALETTES: Record<SkyPreset, SkyPalette> = {
  'deep-blue': {
    base: '#000204',
    upperTint: 'rgba(2,6,20,0.90)',
    keyGlow:   'rgba(80,120,210,0.14)',
    fillGlow:  'rgba(50,90,180,0.09)',
    accent:    'rgba(20,5,40,0.12)',
  },
  'violet': {
    base: '#010005',
    upperTint: 'rgba(8,2,22,0.90)',
    keyGlow:   'rgba(120,70,220,0.16)',
    fillGlow:  'rgba(80,40,180,0.10)',
    accent:    'rgba(50,5,80,0.14)',
  },
  'teal': {
    base: '#000504',
    upperTint: 'rgba(2,14,14,0.90)',
    keyGlow:   'rgba(40,160,150,0.14)',
    fillGlow:  'rgba(20,120,130,0.09)',
    accent:    'rgba(5,30,35,0.12)',
  },
  'warm': {
    base: '#050200',
    upperTint: 'rgba(14,6,0,0.90)',
    keyGlow:   'rgba(200,120,40,0.14)',
    fillGlow:  'rgba(150,80,20,0.09)',
    accent:    'rgba(40,10,5,0.12)',
  },
  'void': {
    base: '#000000',
    upperTint: 'rgba(2,2,6,0.90)',
    keyGlow:   'rgba(30,40,80,0.10)',
    fillGlow:  'rgba(20,30,60,0.07)',
    accent:    'rgba(5,2,10,0.08)',
  },
};

function drawSky(ctx: CanvasRenderingContext2D, W: number, H: number, p: SkyPalette) {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, W, H);

  const ug = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  ug.addColorStop(0, p.upperTint);
  ug.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ug;
  ctx.fillRect(0, 0, W, H);

  const gr = ctx.createRadialGradient(W * 0.73, H * 0.12, 0, W * 0.73, H * 0.12, W * 0.30);
  gr.addColorStop(0, p.keyGlow);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);

  const gl = ctx.createRadialGradient(W * 0.22, H * 0.18, 0, W * 0.22, H * 0.18, W * 0.24);
  gl.addColorStop(0, p.fillGlow);
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, W, H);

  const va = ctx.createRadialGradient(W * 0.5, H * 0.88, 0, W * 0.5, H * 0.88, W * 0.45);
  va.addColorStop(0, p.accent);
  va.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = va;
  ctx.fillRect(0, 0, W, H);
}

/* ─── Uniform IBL canvas (no bright zones = no PMREM cube-face seam artefacts) */

function buildIBLCanvas(): HTMLCanvasElement {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  // Simple vertical gradient — absolutely uniform, zero high-contrast zones
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0,   '#0c1830');
  g.addColorStop(0.5, '#060e1e');
  g.addColorStop(1,   '#020408');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return c;
}

export function buildSkyEnv(renderer: THREE.WebGLRenderer): {
  envMap: THREE.Texture;
  sky: THREE.CanvasTexture;
  set(preset: SkyPreset): void;
} {
  // IBL — uniform gradient, used only for reflections (never shown directly)
  const iblCanvas = buildIBLCanvas();
  const iblTex = new THREE.CanvasTexture(iblCanvas);
  iblTex.mapping = THREE.EquirectangularReflectionMapping;
  iblTex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(iblTex).texture;
  pmrem.dispose();
  iblTex.dispose();

  // Background sky — pretty gradient, shown as scene.background
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  drawSky(ctx, W, H, SKY_PALETTES['deep-blue']);

  const sky = new THREE.CanvasTexture(canvas);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.colorSpace = THREE.SRGBColorSpace;

  function set(preset: SkyPreset) {
    drawSky(ctx, W, H, SKY_PALETTES[preset]);
    sky.needsUpdate = true;
  }

  return { envMap, sky, set };
}
