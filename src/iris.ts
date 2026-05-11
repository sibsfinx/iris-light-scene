import * as THREE from 'three';

/* ─── Parametric petal geometry ─────────────────────────────────────────── */

interface PetalConfig {
  length: number;
  maxWidth: number;
  droop: number;       // radians – how far the tip droops below horizontal
  cup: number;         // 0–1 cross-section concavity
  waviness: number;    // edge fringe amplitude
  twist: number;       // axial twist in radians
  uSegs: number;
  vSegs: number;
}

function buildPetalGeo(cfg: PetalConfig, isStandard = false): THREE.BufferGeometry {
  const { length, maxWidth, droop, cup, waviness, twist, uSegs, vSegs } = cfg;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;

    // Width envelope: narrow at base+tip, wide just past midpoint
    const wenv = Math.sin(u * Math.PI) * Math.pow(u, 0.25) * Math.pow(1 - u, 0.1);
    const halfW = maxWidth * wenv;

    // Axial curve (the spine of the petal)
    const spineAngle = isStandard
      ? -u * u * droop                    // curves backward at top
      : u * u * droop;                    // falls droop down

    const spineY = isStandard
      ? u * length * Math.cos(u * 0.35)  // mostly upward
      : -Math.sin(spineAngle) * length * u * 0.55;

    const spineZ = isStandard
      ? Math.sin(u * Math.PI * 0.45) * length * 0.38 + u * length * 0.1
      : Math.cos(spineAngle * 0.5) * length * u;

    // Axial twist
    const twistA = twist * u;
    const cosTwist = Math.cos(twistA);
    const sinTwist = Math.sin(twistA);

    for (let j = 0; j <= vSegs; j++) {
      const v = j / vSegs;
      const cv = (v - 0.5) * 2; // −1 … +1

      // Cross-section X (width)
      const px = halfW * cv;

      // Cup shape: concave toward viewer
      const cupY = cup * (1 - cv * cv) * halfW * 0.22 * Math.sin(u * Math.PI);

      // Edge waviness (fringed petals)
      const wavePhase = v * Math.PI * 5.5 + u * Math.PI * 3;
      const waveAmp = waviness * halfW * Math.pow(Math.abs(cv), 0.4) * Math.sin(u * Math.PI);
      const waveX = Math.sin(wavePhase) * waveAmp * 0.35;
      const waveY = Math.cos(wavePhase * 1.3) * waveAmp * 0.55;

      // Apply twist
      const rx = px * cosTwist - cupY * sinTwist;
      const ry = px * sinTwist + cupY * cosTwist;

      positions.push(
        rx + waveX,
        spineY + ry + waveY,
        spineZ
      );
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

/* ─── Petal materials ────────────────────────────────────────────────────── */

export function makePetalMaterial(envMap: THREE.Texture): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.02, 0.04, 0.22),       // very dark blue body
    transmission: 0.72,                              // partial — body shows dark blue
    opacity: 1.0,
    transparent: true,
    thickness: 0.22,
    roughness: 0.03,
    metalness: 0.0,
    ior: 1.52,
    specularIntensity: 1.2,
    specularColor: new THREE.Color(0.88, 0.92, 1.0),
    attenuationColor: new THREE.Color(0.02, 0.06, 0.95),
    attenuationDistance: 0.2,
    clearcoat: 0.18,
    clearcoatRoughness: 0.02,
    sheen: 0.5,
    sheenRoughness: 0.25,
    sheenColor: new THREE.Color(0.5, 0.6, 1.0),
    side: THREE.DoubleSide,
    envMap,
    envMapIntensity: 0.4,
  });
}

export function makeStemMaterial(envMap: THREE.Texture): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.04, 0.14, 0.06),
    roughness: 0.42,
    metalness: 0.0,
    transmission: 0.2,
    thickness: 0.5,
    ior: 1.4,
    attenuationColor: new THREE.Color(0.05, 0.4, 0.08),
    attenuationDistance: 0.6,
    sheen: 0.15,
    sheenColor: new THREE.Color(0.2, 0.7, 0.2),
    sheenRoughness: 0.5,
    side: THREE.DoubleSide,
    envMap,
    envMapIntensity: 0.15,
  });
}

/* ─── Iris flower assembly ───────────────────────────────────────────────── */

export function createIrisFlower(envMap: THREE.Texture): THREE.Group {
  const flower = new THREE.Group();

  const petalMat = makePetalMaterial(envMap);

  // ── Fall petals (3 × droop outward) ──────────────────────────────────────
  const fallGeo = buildPetalGeo({
    length: 0.9,
    maxWidth: 0.38,
    droop: 1.65,
    cup: 0.65,
    waviness: 0.08,
    twist: 0.32,
    uSegs: 48,
    vSegs: 26,
  });

  for (let k = 0; k < 3; k++) {
    const petal = new THREE.Mesh(fallGeo, petalMat);
    petal.rotation.y = (k / 3) * Math.PI * 2;
    // Tilt slightly outward so petal drapes away from center
    petal.rotation.x = 0.08;
    flower.add(petal);
  }

  // ── Standard petals (3 × upright, offset 60°) ────────────────────────────
  const stdGeo = buildPetalGeo(
    {
      length: 0.78,
      maxWidth: 0.30,
      droop: 0.65,
      cup: 0.72,    // more concave cup for depth
      waviness: 0.055,
      twist: -0.28,
      uSegs: 44,
      vSegs: 24,
    },
    true
  );

  for (let k = 0; k < 3; k++) {
    const petal = new THREE.Mesh(stdGeo, petalMat);
    petal.rotation.y = ((k + 0.5) / 3) * Math.PI * 2;
    petal.rotation.x = -0.12; // lean slightly inward
    flower.add(petal);
  }

  // ── Style arms (3 × small, horizontal, crested) ──────────────────────────
  const styleGeo = buildPetalGeo({
    length: 0.32,
    maxWidth: 0.13,
    droop: 0.2,
    cup: 0.8,
    waviness: 0.03,
    twist: 0.1,
    uSegs: 20,
    vSegs: 12,
  });

  const styleMat = petalMat.clone();
  styleMat.color = new THREE.Color(0.06, 0.1, 0.55);
  styleMat.sheenColor = new THREE.Color(0.7, 0.7, 1.0);

  for (let k = 0; k < 3; k++) {
    const arm = new THREE.Mesh(styleGeo, styleMat);
    arm.rotation.y = (k / 3) * Math.PI * 2;
    arm.rotation.x = -Math.PI * 0.25;
    arm.position.y = 0.04;
    flower.add(arm);
  }

  // ── Stem ─────────────────────────────────────────────────────────────────
  const stemMat = makeStemMaterial(envMap);

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.05, 0),
    new THREE.Vector3(0.04, -0.5, 0.02),
    new THREE.Vector3(-0.02, -1.1, -0.05),
    new THREE.Vector3(0.01, -1.8, 0.03),
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 32, 0.025, 8, false);
  const stem = new THREE.Mesh(stemGeo, stemMat);
  flower.add(stem);

  // Small leaf bract
  const bracts = buildPetalGeo({
    length: 0.28,
    maxWidth: 0.07,
    droop: 0.7,
    cup: 0.3,
    waviness: 0.01,
    twist: 0,
    uSegs: 16,
    vSegs: 8,
  });

  for (let k = 0; k < 2; k++) {
    const bract = new THREE.Mesh(bracts, stemMat);
    bract.position.set(0, -0.7 - k * 0.3, 0);
    bract.rotation.y = k * Math.PI + 0.3;
    bract.rotation.x = 0.3;
    flower.add(bract);
  }

  flower.position.set(0, 0.2, 0);
  return flower;
}
