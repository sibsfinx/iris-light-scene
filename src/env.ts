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

  // Black backdrop
  const bd = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: false })
  );
  bd.position.set(0, 0, -3.6);
  group.add(bd);

  return group;
}

/* ─── GPU dust — position computed entirely in vertex shader ─────────────── */
// Initial positions are uploaded once. Only a time uniform changes per frame,
// eliminating the per-frame CPU→GPU buffer upload of the old CPU dust.

const dustVS = /* glsl */`
  uniform float time;
  uniform float speed;
  uniform float pointSize;

  void main() {
    // Y: linear rise with wrap in [-1.5, 3.0]
    float y = mod(position.y + 1.5 + time * speed, 4.5) - 1.5;

    // X: bounded sinusoidal drift — integral of sin(t*0.15 + phase)*0.008 dt
    float phase  = float(gl_VertexID) * 0.7;
    float xDrift = 0.0533 * (cos(phase) - cos(time * 0.15 + phase));

    vec4 mvPos    = modelViewMatrix * vec4(position.x + xDrift, y, position.z, 1.0);
    gl_PointSize  = pointSize * (300.0 / -mvPos.z);
    gl_Position   = projectionMatrix * mvPos;
  }
`;

const dustFS = /* glsl */`
  uniform vec3  color;
  uniform float opacity;

  void main() {
    float d     = length(gl_PointCoord - 0.5);
    float alpha = 1.0 - smoothstep(0.3, 0.5, d);
    gl_FragColor = vec4(color, opacity * alpha);
  }
`;

export interface GPUDust {
  group: THREE.Group;
  tick(elapsed: number): void;
}

function makeGPUPoints(
  count: number,
  xRange: number, yRange: [number, number], zRange: number,
  color: number,
  size: number,
  opacity: number,
  speed: number,
): { points: THREE.Points; timeUni: { value: number } } {
  const pos = new Float32Array(count * 3);
  const [yMin, yMax] = yRange;
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * xRange;
    pos[i * 3 + 1] = Math.random() * (yMax - yMin) + yMin;
    pos[i * 3 + 2] = (Math.random() - 0.5) * zRange;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Skip frustum culling — particles move outside their original bounding sphere
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

  const timeUni: { value: number } = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time:      timeUni,
      speed:     { value: speed },
      pointSize: { value: size },
      color:     { value: new THREE.Color(color) },
      opacity:   { value: opacity },
    },
    vertexShader:   dustVS,
    fragmentShader: dustFS,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    transparent: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, timeUni };
}

export function createGPUDust(dustCount: number, silverCount: number): GPUDust {
  const group = new THREE.Group();

  const d1 = makeGPUPoints(dustCount,   6, [-1.5, 3.5], 5, 0xc0d4ff, 0.004, 0.45, 0.025);
  const d2 = makeGPUPoints(silverCount, 4, [-1.0, 3.0], 3, 0xc8deff, 0.007, 0.45, 0.018);

  group.add(d1.points, d2.points);

  return {
    group,
    tick(elapsed: number) {
      d1.timeUni.value = elapsed;
      d2.timeUni.value = elapsed;
    },
  };
}

/* ─── Dark environment map ───────────────────────────────────────────────── */

export function buildEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x010306);
  const t = new THREE.DirectionalLight(0x2040a0, 0.1);
  t.position.set(0, 1, 0);
  envScene.add(t);
  envScene.add(new THREE.AmbientLight(0x030508, 0.06));
  const tex = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  return tex;
}
