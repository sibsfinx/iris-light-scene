import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createGround, createFogPlanes, createDustParticles, animateDust } from './env';
import { ParticleSystem } from './particles';
import { buildComposer } from './fx';
import { PresenceDetector, type PresenceSignal } from './presence';

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
renderer.toneMappingExposure = 0.54;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ─── Scene ──────────────────────────────────────────────────────────────── */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000204);
scene.fog = new THREE.FogExp2(0x00020a, 0.14);

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

const particleSystem = new ParticleSystem(scene);

// Environment
scene.add(createGround());
scene.add(createFogPlanes());

const dust = createDustParticles();
scene.add(dust);

/* ─── Post-processing ────────────────────────────────────────────────────── */

const fx = buildComposer(renderer, scene, camera);

/* ─── Presence detection ─────────────────────────────────────────────────── */

const detector = new PresenceDetector();

// Smoothed signal values
const smooth = { motion: 0, distance: 0, blendA: 0 };

// ── Colour palette — cool baseline + one target per mode ─────────────────
const _cool1 = new THREE.Color(0xe0eeff);
const _warm1 = new THREE.Color(0xffa858);
const _viol1 = new THREE.Color(0x9040ff);
const _mage1 = new THREE.Color(0xff0ea0);
const _tgt1  = new THREE.Color();

// ── Camera preview plumbing ───────────────────────────────────────────────
const previewWrap   = document.getElementById('cam-preview-wrap')!;
const previewVideo  = document.getElementById('cam-preview') as HTMLVideoElement;
const previewToggle = document.getElementById('cam-preview-toggle')!;
let previewVisible  = true;

previewToggle.addEventListener('click', () => {
  previewVisible = !previewVisible;
  previewVideo.style.opacity      = previewVisible ? '0.85' : '0';
  previewToggle.textContent       = previewVisible ? '✕' : '◻';
  previewToggle.title             = previewVisible ? 'Hide preview' : 'Show preview';
});

detector.onStatusChange = (type, msg) => {
  const dot   = document.getElementById('cam-dot')!;
  const label = document.getElementById('cam-label')!;
  dot.className     = type;
  label.textContent = msg;

  // Show/hide preview based on camera state
  const isActive = type === 'active' || type === 'loading';
  previewWrap.style.display = isActive ? 'block' : 'none';
  if (isActive && detector.stream) {
    previewVideo.srcObject = detector.stream;
  }
};

// ── Camera mode buttons ───────────────────────────────────────────────────
document.querySelectorAll('.cam-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const mode = (btn as HTMLElement).dataset['mode'] as any;
    document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await detector.setMode(mode);
    document.getElementById('cam-bars')!.style.display = mode === 'off' ? 'none' : 'flex';
    smooth.motion = 0; smooth.distance = 0; smooth.blendA = 0;
  });
});
document.getElementById('cam-bars')!.style.display = 'none';

/* ─── reactToPresence — call once per frame ─────────────────────────────── */

function reactToPresence(sig: PresenceSignal, dt: number, _t: number) {
  const lf = 1 - Math.pow(0.04, dt);  // ~0.33 at 60 fps

  // ── Smooth raw signals ────────────────────────────────────────────────────
  smooth.motion   += (sig.motion   - smooth.motion)   * lf;
  smooth.distance += (sig.distance - smooth.distance) * lf;

  // ── Mode-specific blend target (0..1) ────────────────────────────────────
  const isMotion = detector.mode === 'motion';
  let targetBlend = 0;
  if      (isMotion)                   targetBlend = Math.min(1, smooth.motion * 15.0); // amplify sensitivity
  else if (detector.mode === 'face')   targetBlend = smooth.distance;
  else if (detector.mode === 'pose')   targetBlend = sig.armsRaised ? smooth.distance : smooth.distance * 0.15;

  // Motion: snap up fast, ease down slower (feels punchy)
  const riseEase = isMotion ? 0.80 : 0.35;
  const fallEase = isMotion ? 0.25 : 0.35;
  const blendEase = targetBlend > smooth.blendA ? riseEase : fallEase;
  smooth.blendA += (targetBlend - smooth.blendA) * lf * blendEase;

  // ── Compute target colours per mode ──────────────────────────────────────
  if (isMotion)                   _tgt1.lerpColors(_cool1, _viol1, smooth.blendA);
  else if (detector.mode === 'face') _tgt1.lerpColors(_cool1, _warm1, smooth.blendA);
  else if (detector.mode === 'pose') _tgt1.lerpColors(_cool1, _mage1, smooth.blendA);
  else                               _tgt1.copy(_cool1);

  // ── Exposure + bloom ──────────────────────────────────────────────────────
  const expBoost   = isMotion ? 0.36 : 0.28;
  const bloomBoost = isMotion ? 0.72 : 0.55;
  const targetExp   = 0.50 + smooth.blendA * expBoost;
  const targetBloom = 0.48 + smooth.blendA * bloomBoost;
  renderer.toneMappingExposure +=
    (targetExp   - renderer.toneMappingExposure) * lf * (isMotion ? 0.45 : 0.25);
  fx.bloom.strength +=
    (targetBloom - fx.bloom.strength)            * lf * (isMotion ? 0.40 : 0.20);

  // ── HUD bars ──────────────────────────────────────────────────────────────
  if (detector.mode !== 'off') {
    const ms = document.getElementById('cam-ms');
    if (ms) ms.textContent = `${detector.detectionMs.toFixed(1)} ms`;
  }
  const bm = document.getElementById('bar-motion');
  const bd = document.getElementById('bar-dist');
  const ba = document.getElementById('bar-approaching');
  const bf = document.getElementById('cam-faces');
  if (bm) bm.style.width = `${(smooth.motion   * 100).toFixed(1)}%`;
  if (bd) bd.style.width  = `${(smooth.distance * 100).toFixed(1)}%`;
  if (ba) ba.classList.toggle('on', sig.armsRaised || sig.approaching);
  if (bf) bf.textContent = sig.faceCount > 0
    ? `${sig.faceCount} face${sig.faceCount > 1 ? 's' : ''} detected` : '';
}

/* ─── Auto-slow rotation (stops on user touch) ───────────────────────────── */

controls.addEventListener('start', () => { particleSystem.autoRotate = false; });

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

  // Subtle breathing on fog planes
  scene.children.forEach(child => {
    if (child.userData['isFog']) {
      child.children.forEach((p, i) => {
        p.position.y += Math.sin(t * 0.25 + i) * 0.0003;
      });
    }
  });

  animateDust(dust, t, dt);
  controls.update();
  reactToPresence(detector.signal, dt, t);
  particleSystem.update(t, smooth.blendA, _tgt1);
  fx.tick(dt);
  fx.composer.render();
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
