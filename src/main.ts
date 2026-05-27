import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { buildEnvMap, createRockBase, createGround, createFogPlanes, createGPUDust } from './env';
import { createIrisFlower, generateVeinMaps } from './iris';
import { setupLights } from './lights';
import { buildComposer } from './fx';
import { AudioReactor } from './audio';
import { detectTier, buildQualityConfig } from './perf';

/* ─── Quality tier ───────────────────────────────────────────────────────── */

const cfg = buildQualityConfig(detectTier());

/* ─── Renderer ───────────────────────────────────────────────────────────── */

// preserveDrawingBuffer forces a full tile-resolve every frame on mobile GPUs.
// HD download uses its own renderer with preserveDrawingBuffer: true — so the
// main renderer doesn't need it.
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(cfg.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = cfg.shadowMap;
if (cfg.shadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

const envMap  = buildEnvMap(renderer);
scene.environment = envMap;

const { roughMap, normalMap } = generateVeinMaps(1024, 1024);

const lights = setupLights(scene);

const dm = cfg.petalDetailMult;
const fg = cfg.useFastGlass;

// ── Hero flower — front-centre, full detail ──────────────────────────────
const heroFlower = createIrisFlower(envMap, roughMap, normalMap, { detail: 1.0 * dm, fastGlass: fg });
heroFlower.position.set(0, 0, 0);
scene.add(heroFlower);

// ── Second flower — right-back, slight scale variation ───────────────────
const flower2 = createIrisFlower(envMap, roughMap, normalMap, { detail: 0.65 * dm, fastGlass: fg });
flower2.position.set(1.15, -0.25, -1.8);
flower2.rotation.y = 0.55;
flower2.scale.setScalar(0.88);
scene.add(flower2);

// ── Third flower — left-back, smaller, will blur in DOF ──────────────────
const flower3 = createIrisFlower(envMap, roughMap, normalMap, { detail: 0.45 * dm, fastGlass: fg });
flower3.position.set(-1.3, 0.1, -2.8);
flower3.rotation.y = -0.42;
flower3.scale.setScalar(0.78);
scene.add(flower3);

// ── Distant glimpse — far right, partial ─────────────────────────────────
const flower4 = createIrisFlower(envMap, roughMap, normalMap, { detail: 0.35 * dm, fastGlass: fg });
flower4.position.set(2.6, 0.2, -3.5);
flower4.rotation.y = 1.1;
flower4.scale.setScalar(0.7);
scene.add(flower4);

// Environment
scene.add(createRockBase());
scene.add(createGround());
scene.add(createFogPlanes());

const gpuDust = createGPUDust(cfg.dustCount, cfg.silverCount);
scene.add(gpuDust.group);

/* ─── Post-processing ────────────────────────────────────────────────────── */

const fx = buildComposer(renderer, scene, camera, cfg);

/* ─── Audio ──────────────────────────────────────────────────────────────── */

const audio = new AudioReactor();

// Smoothed tilt applied to flower groups — maintained in main loop
let smoothTiltX = 0;
let smoothTiltZ = 0;

// Per-domain sensitivity multipliers — set by UI sliders
let sensMovement = 1.0;
let sensColor    = 1.0;

/* ─── Auto-slow rotation (stops on user touch) ───────────────────────────── */

let autoRotate = true;
controls.addEventListener('start', () => { autoRotate = false; });

/* ─── Resize ─────────────────────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  fx.setSize(w, h);
});

/* ─── Apply audio-driven tilt to one flower group ────────────────────────── */

function applyFlowerAudio(
  flower: THREE.Group,
  tiltX: number,
  tiltZ: number,
  tiltScale: number,
  animatePetals: boolean,
  mid: number,
): void {
  flower.rotation.x = tiltX * tiltScale;
  flower.rotation.z = tiltZ * tiltScale;

  if (!animatePetals) return;

  const tiltMag   = Math.sqrt(tiltX * tiltX + tiltZ * tiltZ);
  const tiltAngle = Math.atan2(tiltZ, tiltX);

  flower.children.forEach(child => {
    const type = child.userData['type'];
    if (type !== 'fall' && type !== 'standard') return;
    const petal    = child as THREE.Mesh;
    const baseRotX = child.userData['baseRotX'] as number;
    const petalY   = child.userData['baseRotY'] as number;

    // Petals facing the tilt direction droop more; leeward side opens
    const facing = Math.cos(petalY - tiltAngle);

    if (type === 'fall') {
      // mid → overall bloom opening; tilt → asymmetric droop
      petal.rotation.x = baseRotX + facing * tiltMag * 0.45 + mid * 0.20;
    } else {
      // standards lean slightly into the push
      petal.rotation.x = baseRotX - facing * tiltMag * 0.18 - mid * 0.08;
    }
  });
}

/* ─── Animation loop ─────────────────────────────────────────────────────── */

const clock = new THREE.Clock();

// Back fill color targets per frequency band
const backCoolBaseColor = new THREE.Color(0x040a1e);
const bassBandColor     = new THREE.Color(0.02,  0.14,  0.58);  // blue w/ cyan
const midBandColor      = new THREE.Color(0.008, 0.025, 0.45);  // iris violet
const highBandColor     = new THREE.Color(0.22,  0.07,  0.34);  // light purple
const _blendColor       = new THREE.Color();                     // scratch, reused per frame

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t  = clock.getElapsedTime();

  /* ── Audio analysis ──────────────────────────────────────────────────── */

  audio.update();
  const { sub, bass, lowMid, mid, high, amplitude } = audio.bands;
  const tilt = audio.tilt;

  // Smooth the tilt vector in main loop for extra sluggishness (more organic)
  const tiltTarget = audio.active
    ? { x: tilt.x * 0.30 * sensMovement, z: tilt.z * 0.30 * sensMovement }
    : { x: 0, z: 0 };
  smoothTiltX += (tiltTarget.x - smoothTiltX) * Math.min(1, 0.055 * audio.speed);
  smoothTiltZ += (tiltTarget.z - smoothTiltZ) * Math.min(1, 0.055 * audio.speed);

  /* ── Flower rotation + tilt ──────────────────────────────────────────── */

  if (autoRotate) {
    heroFlower.rotation.y = t * 0.07;
    flower2.rotation.y    = 0.55 + t * 0.05;
    flower3.rotation.y    = -0.42 + t * 0.06;
    flower4.rotation.y    = 1.1  + t * 0.04;
  }

  // Hero gets full tilt + petal bending; background flowers get reduced tilt only
  applyFlowerAudio(heroFlower, smoothTiltX, smoothTiltZ, 1.0,  true,  mid * sensMovement);
  applyFlowerAudio(flower2,    smoothTiltX, smoothTiltZ, 0.65, false, 0);
  applyFlowerAudio(flower3,    smoothTiltX, smoothTiltZ, 0.45, false, 0);
  applyFlowerAudio(flower4,    smoothTiltX, smoothTiltZ, 0.30, false, 0);

  /* ── Sound-reactive lights ───────────────────────────────────────────── */

  if (audio.active) {
    const cl = sensColor;
    // God rays pulse with sub bass — deep hits swell the light shafts
    lights.godRay.intensity  = lights.base.godRay  * (1.0 + sub  * 2.8 * cl);
    lights.godRay2.intensity = lights.base.godRay2 * (1.0 + bass * 1.6 * cl);

    // Rim lights flash with overall amplitude — louder = brighter edges
    lights.rim.intensity  = lights.base.rim  * (1.0 + amplitude * 3.2 * cl);
    lights.rim2.intensity = lights.base.rim2 * (1.0 + mid       * 2.4 * cl);

    // Back fill: weighted blend across band colors, amplitude drives brightness + drive
    const bandTotal = bass + mid + high + 0.001;
    _blendColor.r = (bass * bassBandColor.r + mid * midBandColor.r + high * highBandColor.r) / bandTotal;
    _blendColor.g = (bass * bassBandColor.g + mid * midBandColor.g + high * highBandColor.g) / bandTotal;
    _blendColor.b = (bass * bassBandColor.b + mid * midBandColor.b + high * highBandColor.b) / bandTotal;
    _blendColor.multiplyScalar(1.0 + amplitude * 1.8 * cl);
    lights.backCool.color.copy(backCoolBaseColor).lerp(_blendColor, Math.min(1, amplitude * 2.8 * cl));
    lights.backCool.intensity = lights.base.backCool * (1.0 + amplitude * 4.5 * cl);

    // Side spot flickers with high-freq transients
    lights.sideSpot.intensity = lights.base.sideSpot * (1.0 + high * 3.0 * cl);
  } else {
    // Restore base values when mic is off
    lights.godRay.intensity   = lights.base.godRay;
    lights.godRay2.intensity  = lights.base.godRay2;
    lights.rim.intensity      = lights.base.rim;
    lights.rim2.intensity     = lights.base.rim2;
    lights.backCool.color.copy(backCoolBaseColor);
    lights.backCool.intensity = lights.base.backCool;
    lights.sideSpot.intensity = lights.base.sideSpot;
  }

  /* ── Sound-reactive post-processing ─────────────────────────────────── */

  if (audio.active) {
    const cl = sensColor;
    // Bloom swells on loud moments — threshold drops so more veins glow
    fx.bloom.threshold = Math.max(0.52, 0.94 - amplitude * 0.42 * cl);
    fx.bloom.strength  = 0.48 + (amplitude * 0.55 + high * 0.25) * cl;

    // Chromatic aberration intensifies on high-frequency energy
    fx.filmPass.uniforms['chromAberr'].value = 0.0018 + (high * 0.007 + amplitude * 0.004) * cl;
  } else {
    fx.bloom.threshold = 0.94;
    fx.bloom.strength  = 0.48;
    fx.filmPass.uniforms['chromAberr'].value = 0.0018;
  }

  /* ── Environment ─────────────────────────────────────────────────────── */

  // Subtle breathing on fog planes
  scene.children.forEach(child => {
    if (child.userData['isFog']) {
      child.children.forEach((p, i) => {
        p.position.y += Math.sin(t * 0.25 + i) * 0.0003;
      });
    }
  });

  gpuDust.tick(t);
  controls.update();
  fx.tick(dt);
  fx.composer.render();
}

animate();

/* ─── Hide loader ────────────────────────────────────────────────────────── */

setTimeout(() => {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}, 300);

/* ─── Mic button ─────────────────────────────────────────────────────────── */

const micBtn = document.getElementById('btn-mic')!;

async function startMic() {
  try {
    micBtn.textContent = '⏳ Connecting…';
    micBtn.setAttribute('disabled', 'true');
    await audio.start();
    micBtn.textContent = '⏹ Stop';
    micBtn.classList.add('active');
  } catch {
    micBtn.textContent = '🎤 Listen';
  } finally {
    micBtn.removeAttribute('disabled');
  }
}

micBtn.addEventListener('click', async () => {
  if (audio.active) {
    audio.stop();
    micBtn.textContent = '🎤 Listen';
    micBtn.classList.remove('active');
    return;
  }
  await startMic();
});

// Auto-start microphone on load
startMic();

/* ─── Fullscreen button ──────────────────────────────────────────────────── */

const fsBtn = document.getElementById('btn-fullscreen')!;

fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  fsBtn.textContent = document.fullscreenElement ? '⊠ Exit' : '⛶ Full';
});

/* ─── Audio controls ─────────────────────────────────────────────────────── */

function wireSlider(id: string, valId: string, onChange: (v: number) => void) {
  const slider = document.getElementById(id) as HTMLInputElement;
  const label  = document.getElementById(valId)!;

  const saved = localStorage.getItem(id);
  if (saved !== null) slider.value = saved;

  const apply = (v: number) => {
    label.textContent = v.toFixed(2).replace(/\.?0+$/, '') + '×';
    onChange(v);
  };
  apply(parseFloat(slider.value));

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    localStorage.setItem(id, String(v));
    apply(v);
  });
}

wireSlider('slider-movement', 'val-movement', v => { sensMovement = v; });
wireSlider('slider-color',    'val-color',    v => { sensColor    = v; });
wireSlider('slider-speed',    'val-speed',    v => { audio.speed  = v; });

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
