import * as THREE from 'three';

/* ─── Rock base ──────────────────────────────────────────────────────────── */

export function createRockBase(): THREE.Group {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.03, 0.03, 0.038),
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.FrontSide,
  });

  // Main boulder
  const geo = new THREE.IcosahedronGeometry(0.52, 2);
  displace(geo, 0.13);
  const rock = new THREE.Mesh(geo, mat);
  rock.scale.set(1.6, 0.55, 1.2);
  rock.position.set(0, -2.0, 0);
  rock.rotation.y = 0.8;
  group.add(rock);

  // Smaller surrounding rocks
  const positions: [number, number, number, number, number][] = [
    [0.8, -2.05, 0.3, 0.38, 1.2],
    [-0.7, -2.1, -0.2, 0.28, 2.5],
    [0.2, -2.12, -0.75, 0.22, 0.4],
    [-0.4, -2.15, 0.6, 0.18, 1.8],
  ];

  for (const [x, y, z, s, ry] of positions) {
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

function displace(geo: THREE.BufferGeometry, amount: number) {
  const pos = geo.attributes['position'] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    const noise = pseudoNoise(v.x * 3.7, v.y * 3.7, v.z * 3.7);
    const r = 1 + noise * amount;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function pseudoNoise(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  const t = Math.sin(y * 269.5 + z * 183.3) * 43758.5453;
  const u = Math.sin(z * 419.2 + x * 371.9) * 43758.5453;
  return ((s - Math.floor(s)) + (t - Math.floor(t)) + (u - Math.floor(u))) / 3 - 0.5;
}

/* ─── Ground plane ───────────────────────────────────────────────────────── */

export function createGround(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(12, 12, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.02, 0.02, 0.025),
    roughness: 1.0,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -2.2;
  return mesh;
}

/* ─── Volumetric fog planes (god-ray approximation) ─────────────────────── */

export function createFogPlanes(): THREE.Group {
  const group = new THREE.Group();

  const planeConfigs: { pos: THREE.Vector3; rot: THREE.Euler; scale: THREE.Vector3; opacity: number }[] = [
    {
      pos: new THREE.Vector3(0.6, 1.2, -1.8),
      rot: new THREE.Euler(-0.3, -0.55, 0.15),
      scale: new THREE.Vector3(1.4, 3.2, 1),
      opacity: 0.04,
    },
    {
      pos: new THREE.Vector3(-0.3, 0.8, -2.2),
      rot: new THREE.Euler(-0.2, 0.4, -0.1),
      scale: new THREE.Vector3(1.1, 2.8, 1),
      opacity: 0.035,
    },
    {
      pos: new THREE.Vector3(0.1, 1.5, -1.5),
      rot: new THREE.Euler(-0.4, 0.0, 0.08),
      scale: new THREE.Vector3(1.0, 2.5, 1),
      opacity: 0.028,
    },
    // Fill plane
    {
      pos: new THREE.Vector3(0, -0.5, -2.5),
      rot: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(4, 4, 1),
      opacity: 0.06,
    },
  ];

  for (const cfg of planeConfigs) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.2, 0.35, 0.9),
      transparent: true,
      opacity: cfg.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(cfg.pos);
    mesh.rotation.copy(cfg.rot);
    mesh.scale.copy(cfg.scale);
    group.add(mesh);
  }

  // Black flag / backdrop
  const backdropGeo = new THREE.PlaneGeometry(6, 6);
  const backdropMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
  backdrop.position.set(0, 0, -3);
  group.add(backdrop);

  return group;
}

/* ─── Dark custom environment map ────────────────────────────────────────── */

export function buildEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // Very dark neutral environment – just enough for transmission reflections
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x020408);

  // Faint directional fills baked into env
  const top = new THREE.DirectionalLight(0x3050a0, 0.12);
  top.position.set(0, 1, 0);
  envScene.add(top);
  const fill = new THREE.AmbientLight(0x050810, 0.08);
  envScene.add(fill);

  const envTex = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  return envTex;
}
