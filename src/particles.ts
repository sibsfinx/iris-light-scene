import * as THREE from 'three';

/* ── Shaders ─────────────────────────────────────────────────────────────── */

const VERT = /* glsl */`
attribute float aSize;
attribute vec3  aVelocity;
attribute float aPhase;

uniform float uTime;
uniform float uPresence;

void main() {
  float wave = sin(uTime * 0.8 + aPhase);
  vec3  pos  = position + aVelocity * (wave * (1.0 + uPresence * 3.0));

  vec4 mv      = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position  = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */`
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uPresence;
uniform float uOpacity;
uniform float uTime;
uniform float uIsGlare;

void main() {
  vec2  uv   = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;

  float edge = uIsGlare > 0.5
    ? pow(max(0.0, 1.0 - dist * 2.0), 1.5)
    : 1.0 - smoothstep(0.1, 0.5, dist);

  vec3  col  = mix(uColorA, uColorB, uPresence);
  float irid = sin(atan(uv.y, uv.x) * 3.0 + uTime) * 0.2 * uPresence;
  col        = clamp(col + vec3(irid, irid * 0.4, -irid * 0.3), 0.0, 5.0);

  gl_FragColor = vec4(col, uOpacity * edge);
}
`;

/* ── Parametric petal samplers ───────────────────────────────────────────── */

function rotY(v: THREE.Vector3, a: number): THREE.Vector3 {
  return new THREE.Vector3(
    v.x * Math.cos(a) - v.z * Math.sin(a),
    v.y,
    v.x * Math.sin(a) + v.z * Math.cos(a),
  );
}

function sampleFall(u: number, cv: number): THREE.Vector3 {
  const halfW = 0.50 * Math.pow(Math.sin(u * Math.PI), 0.6);
  const sa    = u * u * 1.55;
  const sy    = -Math.sin(sa) * 0.78 * u * 0.52;
  const sz    =  Math.cos(sa * 0.48) * 0.78 * u;
  const px    = halfW * cv;
  const cup   = 0.55 * (1 - cv * cv) * halfW * 0.2 * Math.sin(u * Math.PI);
  const tw    = 0.26 * u;
  return new THREE.Vector3(
    px  * Math.cos(tw) - cup * Math.sin(tw),
    sy + px  * Math.sin(tw) + cup * Math.cos(tw),
    sz,
  );
}

function sampleStandard(u: number, cv: number): THREE.Vector3 {
  const halfW = 0.42 * Math.pow(Math.sin(u * Math.PI), 0.6);
  const sy    = u * 0.84 * Math.cos(u * 0.3);
  const sz    = Math.sin(u * Math.PI * 0.42) * 0.84 * 0.4 + u * 0.84 * 0.12;
  const px    = halfW * cv;
  const cup   = 0.85 * (1 - cv * cv) * halfW * 0.2 * Math.sin(u * Math.PI);
  const tw    = -0.3 * u;
  return new THREE.Vector3(
    px  * Math.cos(tw) - cup * Math.sin(tw),
    sy + px  * Math.sin(tw) + cup * Math.cos(tw),
    sz,
  );
}

/* ── Seed generators ─────────────────────────────────────────────────────── */

interface Seed {
  pos: Float32Array;
  vel: Float32Array;
  ph:  Float32Array;
  sz:  Float32Array;
}

function seedPetals(
  count: number,
  minSz: number, maxSz: number,
  spread = 0,
  glareOnly = false,
): Seed {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const ph  = new Float32Array(count);
  const sz  = new Float32Array(count);

  const perPetal = Math.floor(count / 6);
  let idx = 0;

  for (let petal = 0; petal < 6 && idx < count; petal++) {
    const isFall = petal < 3;
    const k      = petal % 3;
    const ry     = isFall ? (k / 3) * Math.PI * 2 : ((k + 0.5) / 3) * Math.PI * 2;
    const n      = petal < 5 ? perPetal : count - idx;

    for (let i = 0; i < n && idx < count; i++, idx++) {
      const u  = glareOnly ? 0.65 + Math.random() * 0.35 : Math.random();
      const cv = glareOnly
        ? (Math.random() > 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.55)
        : (Math.random() - 0.5) * 2;

      const p  = isFall ? sampleFall(u, cv) : sampleStandard(u, cv);
      const pr = rotY(p, ry);

      pos[idx * 3]     = pr.x + (Math.random() - 0.5) * spread;
      pos[idx * 3 + 1] = pr.y + (Math.random() - 0.5) * spread;
      pos[idx * 3 + 2] = pr.z + (Math.random() - 0.5) * spread;

      const len = Math.sqrt(pr.x * pr.x + pr.z * pr.z) + 0.001;
      vel[idx * 3]     = (pr.x / len) * 0.03 * Math.random();
      vel[idx * 3 + 1] = 0.015 + Math.random() * 0.025;
      vel[idx * 3 + 2] = (pr.z / len) * 0.03 * Math.random();

      ph[idx] = Math.random() * Math.PI * 2;
      sz[idx] = minSz + Math.random() * (maxSz - minSz);
    }
  }

  return { pos, vel, ph, sz };
}

/* ── Points builder ──────────────────────────────────────────────────────── */

type Uniforms = {
  uTime:     { value: number };
  uPresence: { value: number };
  uColorA:   { value: THREE.Color };
  uColorB:   { value: THREE.Color };
  uOpacity:  { value: number };
  uIsGlare:  { value: number };
};

function makeUniforms(
  colorA: THREE.Color, colorB: THREE.Color,
  opacity: number, isGlare: boolean,
): Uniforms {
  return {
    uTime:     { value: 0 },
    uPresence: { value: 0 },
    uColorA:   { value: colorA },
    uColorB:   { value: colorB },
    uOpacity:  { value: opacity },
    uIsGlare:  { value: isGlare ? 1 : 0 },
  };
}

function buildPoints(seed: Seed, uniforms: Uniforms): THREE.Points {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',  new THREE.BufferAttribute(seed.pos, 3));
  geo.setAttribute('aVelocity', new THREE.BufferAttribute(seed.vel, 3));
  geo.setAttribute('aPhase',    new THREE.BufferAttribute(seed.ph,  1));
  geo.setAttribute('aSize',     new THREE.BufferAttribute(seed.sz,  1));

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  return new THREE.Points(geo, mat);
}

/* ── Cluster config ──────────────────────────────────────────────────────── */

interface ClusterCfg {
  pos:    [number, number, number];
  scale:  number;
  rotOff: number;
  rotSpd: number;
  nCore:  number;
  nHaze:  number;
  nGlare: number;
}

const CFG: ClusterCfg[] = [
  { pos: [ 0,    0.22,  0   ], scale: 1.00, rotOff:  0,    rotSpd: 0.07, nCore: 3000, nHaze: 5000, nGlare: 300 },
  { pos: [ 1.15,-0.03, -1.8 ], scale: 0.88, rotOff:  0.55, rotSpd: 0.05, nCore: 900,  nHaze: 1500, nGlare: 100 },
  { pos: [-1.3,  0.32, -2.8 ], scale: 0.78, rotOff: -0.42, rotSpd: 0.06, nCore: 600,  nHaze: 1000, nGlare:  70 },
  { pos: [ 2.6,  0.42, -3.5 ], scale: 0.70, rotOff:  1.1,  rotSpd: 0.04, nCore: 350,  nHaze:  600, nGlare:  50 },
];

/* ── ParticleSystem ──────────────────────────────────────────────────────── */

export class ParticleSystem {
  public autoRotate = true;

  private clusters: Array<{
    group:    THREE.Group;
    cfg:      ClusterCfg;
    allUni:   Uniforms[];
    glareUni: Uniforms;
  }> = [];

  constructor(scene: THREE.Scene) {
    for (const cfg of CFG) {
      const group = new THREE.Group();
      group.position.set(...cfg.pos);
      group.scale.setScalar(cfg.scale);

      const coreUni  = makeUniforms(
        new THREE.Color(0.025, 0.04,  0.55),
        new THREE.Color(0.6,   0.15,  1.2 ),
        0.80, false,
      );
      const hazeUni  = makeUniforms(
        new THREE.Color(0.004, 0.007, 0.07),
        new THREE.Color(0.10,  0.04,  0.32),
        0.07, false,
      );
      const glareUni = makeUniforms(
        new THREE.Color(0.85,  0.92,  1.2 ),
        new THREE.Color(1.1,   0.85,  1.5 ),
        0.55, true,
      );

      group.add(buildPoints(seedPetals(cfg.nHaze,  0.12, 0.50, 0.18),        hazeUni ));
      group.add(buildPoints(seedPetals(cfg.nCore,  0.05, 0.15),               coreUni ));
      group.add(buildPoints(seedPetals(cfg.nGlare, 0.35, 1.20, 0,   true),    glareUni));

      scene.add(group);
      this.clusters.push({ group, cfg, allUni: [coreUni, hazeUni, glareUni], glareUni });
    }
  }

  update(t: number, blend: number, colorB: THREE.Color): void {
    for (const { group, cfg, allUni, glareUni } of this.clusters) {
      if (this.autoRotate) {
        group.rotation.y = cfg.rotOff + t * cfg.rotSpd;
      }
      for (const uni of allUni) {
        uni.uTime.value     = t;
        uni.uPresence.value = blend;
        uni.uColorB.value.copy(colorB);
      }
      glareUni.uOpacity.value = 0.55 + blend * 0.35;
    }
  }
}
