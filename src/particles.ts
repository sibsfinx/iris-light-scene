import * as THREE from 'three';
import { buildPetalGeo, type PetalConfig } from './iris';

/* ── Shaders ─────────────────────────────────────────────────────────────── */

const VERT = /* glsl */`
attribute float aSize;
attribute vec3  aVelocity;
attribute float aPhase;

uniform float uTime;
uniform float uPresence;

void main() {
  float wave = sin(uTime * 0.7 + aPhase) * 0.6 + cos(uTime * 0.38 + aPhase * 1.3) * 0.4;
  float speed = 1.0 + uPresence * 2.5;
  vec3  pos   = position + aVelocity * (wave * speed);

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
uniform float uSharp;

void main() {
  vec2  uv   = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;

  float edge = uSharp > 0.5
    ? pow(max(0.0, 1.0 - dist * 2.0), 1.1)
    : 1.0 - smoothstep(0.05, 0.48, dist);

  vec3 col = mix(uColorA, uColorB, uPresence);

  float theta = atan(uv.y, uv.x);
  float irid  = sin(theta * 4.0 + uTime * 0.9) * 0.18 * uPresence;
  col = clamp(col + vec3(irid * 0.7, irid * 0.35, irid * 1.3), 0.0, 6.0);

  gl_FragColor = vec4(col, uOpacity * edge);
}
`;

/* ── Parametric petal samplers (mirror iris.ts exactly) ─────────────────── */

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

/* Vein particles — fan radially from petal base, following vein direction */
function seedVeins(nVeins: number, ptsPerVein: number): Seed {
  const total = nVeins * ptsPerVein * 6;
  const pos = new Float32Array(total * 3);
  const vel = new Float32Array(total * 3);
  const ph  = new Float32Array(total);
  const sz  = new Float32Array(total);

  let idx = 0;

  for (let petal = 0; petal < 6; petal++) {
    const isFall  = petal < 3;
    const k       = petal % 3;
    const ry      = isFall ? (k / 3) * Math.PI * 2 : ((k + 0.5) / 3) * Math.PI * 2;
    const sample  = isFall ? sampleFall : sampleStandard;

    for (let vi = 0; vi < nVeins; vi++) {
      const cvTip = -0.90 + (vi / (nVeins - 1)) * 1.80; // spread −0.9 → +0.9 at tip

      for (let pi = 0; pi < ptsPerVein; pi++) {
        // Slight random jitter along length so lines don't look perfectly uniform
        const u  = Math.max(0.01, Math.min(0.99,
          (pi + 0.5 + (Math.random() - 0.5) * 0.55) / ptsPerVein));
        const cv = cvTip * Math.pow(u, 0.52); // fan from 0 at base → cvTip at tip

        const p  = sample(u, cv);
        const pr = rotY(p, ry);

        // Along-vein velocity direction (numerical derivative)
        const u2   = Math.min(u + 0.04, 0.99);
        const p2   = sample(u2, cvTip * Math.pow(u2, 0.52));
        const pr2  = rotY(p2, ry);
        const dx   = pr2.x - pr.x;
        const dy   = pr2.y - pr.y;
        const dz   = pr2.z - pr.z;
        const dl   = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
        const spd  = 0.016 + Math.random() * 0.014;

        pos[idx * 3]     = pr.x;
        pos[idx * 3 + 1] = pr.y;
        pos[idx * 3 + 2] = pr.z;
        vel[idx * 3]     = (dx / dl) * spd;
        vel[idx * 3 + 1] = (dy / dl) * spd;
        vel[idx * 3 + 2] = (dz / dl) * spd;
        ph[idx] = Math.random() * Math.PI * 2;

        // Size grows toward tip and at edge veins
        const edgeBoost = 1.0 + Math.abs(cvTip) * 0.65;
        sz[idx] = (0.028 + u * 0.048) * edgeBoost;

        idx++;
      }
    }
  }

  return { pos, vel, ph, sz };
}

/* Glare particles — concentrated at petal tips and edges for bloom halos */
function seedGlare(count: number): Seed {
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
    const sample = isFall ? sampleFall : sampleStandard;
    const n      = petal < 5 ? perPetal : count - idx;

    for (let i = 0; i < n && idx < count; i++, idx++) {
      // Bias heavily toward tips (u > 0.6) and petal edges (|cv| > 0.5)
      const u  = 0.55 + Math.random() * 0.45;
      const cv = (Math.random() > 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.55);

      const p  = sample(u, cv);
      const pr = rotY(p, ry);

      pos[idx * 3]     = pr.x;
      pos[idx * 3 + 1] = pr.y;
      pos[idx * 3 + 2] = pr.z;
      vel[idx * 3]     = (Math.random() - 0.5) * 0.004;
      vel[idx * 3 + 1] = (Math.random() - 0.5) * 0.004;
      vel[idx * 3 + 2] = (Math.random() - 0.5) * 0.004;
      ph[idx] = Math.random() * Math.PI * 2;
      sz[idx] = 0.22 + Math.random() * 0.55;
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
  uSharp:    { value: number };
};

function makeUniforms(
  colorA: THREE.Color, colorB: THREE.Color,
  opacity: number, sharp: boolean,
): Uniforms {
  return {
    uTime:     { value: 0 },
    uPresence: { value: 0 },
    uColorA:   { value: colorA },
    uColorB:   { value: colorB },
    uOpacity:  { value: opacity },
    uSharp:    { value: sharp ? 1 : 0 },
  };
}

function buildPoints(seed: Seed, uniforms: Uniforms): THREE.Points {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',  new THREE.BufferAttribute(seed.pos, 3));
  geo.setAttribute('aVelocity', new THREE.BufferAttribute(seed.vel, 3));
  geo.setAttribute('aPhase',    new THREE.BufferAttribute(seed.ph,  1));
  geo.setAttribute('aSize',     new THREE.BufferAttribute(seed.sz,  1));
  return new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms,
    vertexShader:   VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  }));
}

/* ── Dark petal mesh builder ─────────────────────────────────────────────── */

const FALL_CFG: PetalConfig = {
  length: 0.78, maxWidth: 0.50, droop: 1.55, cup: 0.55,
  waviness: 0.06, edgeRuffle: 0.9, twist: 0.26,
  uSegs: 32, vSegs: 20,
};
const STD_CFG: PetalConfig = {
  length: 0.84, maxWidth: 0.42, droop: 0.65, cup: 0.85,
  waviness: 0.04, edgeRuffle: 0.85, twist: -0.3,
  uSegs: 28, vSegs: 16,
};

function buildDarkPetals(scene?: never): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color:      new THREE.Color(0.010, 0.015, 0.11),
    blending:   THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side:       THREE.DoubleSide,
  });

  const fallGeo = buildPetalGeo(FALL_CFG, false);
  const stdGeo  = buildPetalGeo(STD_CFG,  true);

  for (let k = 0; k < 3; k++) {
    const f = new THREE.Mesh(fallGeo, mat);
    f.rotation.y = (k / 3) * Math.PI * 2;
    f.rotation.x = 0.06;
    group.add(f);

    const s = new THREE.Mesh(stdGeo, mat);
    s.rotation.y = ((k + 0.5) / 3) * Math.PI * 2;
    s.rotation.x = -0.1;
    group.add(s);
  }

  return group;
}

/* ── Cluster config ──────────────────────────────────────────────────────── */

interface ClusterCfg {
  pos:    [number, number, number];
  scale:  number;
  rotOff: number;
  rotSpd: number;
  nVeins: number;
  nPts:   number;
  nGlare: number;
}

const CFG: ClusterCfg[] = [
  { pos: [ 0,    0.22,  0   ], scale: 1.00, rotOff:  0,    rotSpd: 0.07, nVeins: 28, nPts: 22, nGlare: 280 },
  { pos: [ 1.15,-0.03, -1.8 ], scale: 0.88, rotOff:  0.55, rotSpd: 0.05, nVeins: 18, nPts: 16, nGlare: 110 },
  { pos: [-1.3,  0.32, -2.8 ], scale: 0.78, rotOff: -0.42, rotSpd: 0.06, nVeins: 14, nPts: 13, nGlare:  80 },
  { pos: [ 2.6,  0.42, -3.5 ], scale: 0.70, rotOff:  1.1,  rotSpd: 0.04, nVeins: 10, nPts: 10, nGlare:  55 },
];

/* ── ParticleSystem ──────────────────────────────────────────────────────── */

export class ParticleSystem {
  public autoRotate = true;

  private clusters: Array<{
    group:     THREE.Group;
    cfg:       ClusterCfg;
    veinUni:   Uniforms;
    glareUni:  Uniforms;
  }> = [];

  constructor(scene: THREE.Scene) {
    for (const cfg of CFG) {
      const group = new THREE.Group();
      group.position.set(...cfg.pos);
      group.scale.setScalar(cfg.scale);

      // Dark petal body (mesh, not points)
      group.add(buildDarkPetals());

      // Vein particles — silver-blue, tiny, flow along vein direction
      const veinUni = makeUniforms(
        new THREE.Color(0.28, 0.42, 0.90),  // silver-blue at rest
        new THREE.Color(0.70, 0.55, 1.20),  // violet on presence
        0.82, false,
      );
      group.add(buildPoints(seedVeins(cfg.nVeins, cfg.nPts), veinUni));

      // Glare particles — bright white, large, triggers bloom
      const glareUni = makeUniforms(
        new THREE.Color(1.00, 1.05, 1.30),  // bright white-blue
        new THREE.Color(1.20, 0.95, 1.60),  // violet-white on presence
        0.60, true,
      );
      group.add(buildPoints(seedGlare(cfg.nGlare), glareUni));

      scene.add(group);
      this.clusters.push({ group, cfg, veinUni, glareUni });
    }
  }

  update(t: number, blend: number, colorB: THREE.Color): void {
    for (const { group, cfg, veinUni, glareUni } of this.clusters) {
      if (this.autoRotate) {
        group.rotation.y = cfg.rotOff + t * cfg.rotSpd;
      }
      for (const uni of [veinUni, glareUni]) {
        uni.uTime.value     = t;
        uni.uPresence.value = blend;
        uni.uColorB.value.copy(colorB);
      }
      glareUni.uOpacity.value = 0.60 + blend * 0.32;
    }
  }
}
