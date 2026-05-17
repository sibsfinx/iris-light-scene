import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { buildSkyEnv, createRockBase, createDustParticles, animateDust, SkyPreset } from './env';
import { createIrisFlower, generateVeinMaps } from './iris';
import { setupLights } from './lights';
import { buildComposer } from './fx';

/* ─── Renderer ───────────────────────────────────────────────────────────── */

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.50;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ─── Scene ──────────────────────────────────────────────────────────────── */

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000204, 0.06);

/* ─── Camera ─────────────────────────────────────────────────────────────── */

const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.05, 40);
camera.position.set(0.1, 0.3, 4.0);
camera.lookAt(0, 0.2, 0);

/* ─── Controls ───────────────────────────────────────────────────────────── */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 1.0;
controls.maxDistance = 12.0;
controls.maxPolarAngle = Math.PI * 0.82;
controls.target.set(0, 0.08, 0);
controls.update();

/* ─── Build scene assets ─────────────────────────────────────────────────── */

const skyEnv = buildSkyEnv(renderer);
scene.environment = skyEnv.envMap;
scene.background  = skyEnv.sky;

const { roughMap, normalMap } = generateVeinMaps(1024, 1024);

setupLights(scene);

// ── Hero flower — front-centre, full detail ──────────────────────────────
const heroFlower = createIrisFlower(skyEnv.envMap, roughMap, normalMap, { detail: 1.0 });
heroFlower.position.set(0, 0, 0);
scene.add(heroFlower);

// ── Second flower — right-back, slight scale variation ───────────────────
const flower2 = createIrisFlower(skyEnv.envMap, roughMap, normalMap, { detail: 0.65 });
flower2.position.set(1.15, -0.25, -1.8);
flower2.rotation.y = 0.55;
flower2.scale.setScalar(0.88);
scene.add(flower2);

// ── Third flower — left-back, smaller, will blur in DOF ──────────────────
const flower3 = createIrisFlower(skyEnv.envMap, roughMap, normalMap, { detail: 0.45 });
flower3.position.set(-1.3, 0.1, -2.8);
flower3.rotation.y = -0.42;
flower3.scale.setScalar(0.78);
scene.add(flower3);

// ── Distant glimpse — far right, partial ─────────────────────────────────
const flower4 = createIrisFlower(skyEnv.envMap, roughMap, normalMap, { detail: 0.35 });
flower4.position.set(2.6, 0.2, -3.5);
flower4.rotation.y = 1.1;
flower4.scale.setScalar(0.7);
scene.add(flower4);

// Environment
scene.add(createRockBase());

// ── Vein bokeh flares — hexagonal sprite discs that pulse at petal positions ──
// No lights → no square bloom artifacts. The sprite shape IS the bokeh glare.

function makeBokehTex(): THREE.CanvasTexture {
  const sz = 128, r = sz / 2;
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d')!;

  // Clip to hexagon
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const x = r + Math.cos(a) * r * 0.92;
    const y = r + Math.sin(a) * r * 0.92;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();

  // Soft glow fill inside hex
  const outer = ctx.createRadialGradient(r, r, r * 0.05, r, r, r * 0.92);
  outer.addColorStop(0,    'rgba(220, 235, 255, 1.0)');
  outer.addColorStop(0.25, 'rgba(160, 200, 255, 0.7)');
  outer.addColorStop(0.65, 'rgba( 80, 140, 255, 0.2)');
  outer.addColorStop(1,    'rgba(  0,   0,   0, 0.0)');
  ctx.fillStyle = outer;
  ctx.fill();

  // Thin bright hex ring
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const x = r + Math.cos(a) * r * 0.88;
    const y = r + Math.sin(a) * r * 0.88;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(200, 220, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

const bokehTex = makeBokehTex();

interface VeinFlare {
  sprite: THREE.Sprite;
  light: THREE.PointLight;
  speed: number;
  phase: number;
}
const veinFlashSprites: VeinFlare[] = [];

(function buildBokehFlares() {
  const positions: [number, number, number][] = [
    [ 0.00,  0.28,  0.38],
    [ 0.33,  0.42, -0.22],
    [ 0.36,  0.18,  0.18],
    [-0.33,  0.42, -0.22],
    [-0.36,  0.18,  0.18],
    [ 0.00,  0.55, -0.38],
  ];
  positions.forEach(([x, y, z], i) => {
    // Bokeh sprite — gives the glare its hexagonal shape
    const mat = new THREE.SpriteMaterial({
      map: bokehTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      color: 0xb0d0ff,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(0.13);
    heroFlower.add(sprite);

    // PointLight — drives actual specular on vein ridges; kept sub-threshold
    // so bloom never sees it (no square bloom artifact)
    const light = new THREE.PointLight(0xc8dcff, 0, 0.85, 2.2);
    light.position.set(x, y, z);
    heroFlower.add(light);

    veinFlashSprites.push({
      sprite, light,
      speed: 0.55 + (i % 3) * 0.18,
      phase: (i / positions.length) * Math.PI * 2,
    });
  });
})();

const dust = createDustParticles();
scene.add(dust);

/* ─── Post-processing ────────────────────────────────────────────────────── */

const fx = buildComposer(renderer, scene, camera);

/* ─── Auto-slow rotation (stops on user touch) ───────────────────────────── */

let autoRotate = true;
controls.addEventListener('start', () => { autoRotate = false; });
(window as any).__setAutoRotate = (v: boolean) => { autoRotate = v; };

/* ─── Controls panel wiring ──────────────────────────────────────────────── */

let dofEnabled = true;

// Sky preset swatches
document.querySelectorAll<HTMLElement>('[data-sky]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('[data-sky]').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    skyEnv.set(el.dataset['sky'] as SkyPreset);
  });
});

// Exposure presets
document.querySelectorAll<HTMLElement>('[data-exp]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('[data-exp]').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    renderer.toneMappingExposure = parseFloat(el.dataset['exp']!);
  });
});

// Auto-rotate toggle
const rotBtn = document.getElementById('toggle-rotate')!;
rotBtn.addEventListener('click', () => {
  autoRotate = !autoRotate;
  rotBtn.classList.toggle('on', autoRotate);
  rotBtn.textContent = autoRotate ? 'Rotate  ON' : 'Rotate OFF';
});

// DOF toggle
const dofBtn = document.getElementById('toggle-dof')!;
dofBtn.addEventListener('click', () => {
  dofEnabled = !dofEnabled;
  fx.bokeh.enabled = dofEnabled;
  dofBtn.classList.toggle('on', dofEnabled);
  dofBtn.textContent = dofEnabled ? 'DOF  ON' : 'DOF OFF';
});

// Vein toggle — collect all petal MeshPhysicalMaterials after scene build
const petalMats: THREE.MeshPhysicalMaterial[] = [];
[heroFlower, flower2, flower3, flower4].forEach(f => {
  f.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      const m = obj.material as THREE.MeshPhysicalMaterial;
      if (m && m.isMeshPhysicalMaterial && !petalMats.includes(m)) {
        m.userData['normalScaleX'] = m.normalScale.x;
        m.userData['normalScaleY'] = m.normalScale.y;
        m.userData['roughMap']     = m.roughnessMap;
        petalMats.push(m);
      }
    }
  });
});

let veinsOn = true;
const veinsBtn = document.getElementById('toggle-veins')!;
veinsBtn.addEventListener('click', () => {
  veinsOn = !veinsOn;
  petalMats.forEach(m => {
    m.normalScale.set(
      veinsOn ? m.userData['normalScaleX'] : 0,
      veinsOn ? m.userData['normalScaleY'] : 0,
    );
    m.roughnessMap = veinsOn ? m.userData['roughMap'] : null;
    m.needsUpdate  = true;
  });
  veinsBtn.classList.toggle('on', veinsOn);
  veinsBtn.textContent = veinsOn ? 'Veins  ON' : 'Veins OFF';
});

// Controls panel open/close
const panel     = document.getElementById('ctrl-panel')!;
const ctrlBtn   = document.getElementById('btn-controls')!;
ctrlBtn.addEventListener('click', () => panel.classList.toggle('open'));

/* ─── FPS counter ────────────────────────────────────────────────────────── */

let fpsFrames = 0, fpsAccum = 0;
const fpsEl = document.getElementById('fps-val')!;

/* ─── Resize ─────────────────────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  fx.setSize(w, h);
});

/* ─── Animation loop ─────────────────────────────────────────────────────── */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t  = clock.getElapsedTime();

  // Gentle slow rotation of whole scene
  if (autoRotate) {
    heroFlower.rotation.y = t * 0.07;
    flower2.rotation.y    = 0.55 + t * 0.05;
    flower3.rotation.y    = -0.42 + t * 0.06;
    flower4.rotation.y    = 1.1  + t * 0.04;
  }

  // Bokeh flares — sprite gives hex glare shape, light does vein specular
  veinFlashSprites.forEach(({ sprite, light, speed, phase }) => {
    const s = Math.sin(t * speed + phase);
    const pulse = s > 0 ? s * s * s : 0;            // cubic → sharp peak
    (sprite.material as THREE.SpriteMaterial).opacity = pulse;
    light.intensity = pulse * 5;                     // sub-threshold: specular only, no bloom squares
  });

  animateDust(dust, t, dt);
  controls.update();
  fx.tick(dt);
  fx.composer.render();

  // FPS
  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    fpsEl.textContent = String(Math.round(fpsFrames / fpsAccum));
    fpsFrames = 0; fpsAccum = 0;
  }
}

animate();

/* ─── Hide loader ────────────────────────────────────────────────────────── */

setTimeout(() => {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}, 300);

/* ─── HD Download ────────────────────────────────────────────────────────── */

const dlBtn = document.getElementById('btn-download')!;
dlBtn.addEventListener('click', () => {
  dlBtn.textContent = '⏳ Rendering…';
  dlBtn.setAttribute('disabled', 'true');
  setTimeout(() => downloadHD(3840, 2160), 100);
});

function downloadHD(width: number, height: number) {
  const hdRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  hdRenderer.setPixelRatio(1);
  hdRenderer.setSize(width, height);
  hdRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  hdRenderer.toneMappingExposure = 1.05;
  hdRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const hdCamera = camera.clone() as THREE.PerspectiveCamera;
  hdCamera.aspect = width / height;
  hdCamera.updateProjectionMatrix();

  const hdFx = buildComposer(hdRenderer, scene, hdCamera);
  hdFx.setSize(width, height);
  hdFx.composer.render();

  hdRenderer.domElement.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `iris-crystal-${width}x${height}.png`;
    a.click();
    URL.revokeObjectURL(url);
    hdRenderer.dispose();

    dlBtn.textContent = '⬇ Download HD';
    dlBtn.removeAttribute('disabled');
  }, 'image/png');
}
