import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { buildEnvMap, createRockBase, createGround, createFogPlanes } from './env';
import { createIrisFlower } from './iris';
import { setupLights } from './lights';
import { buildComposer } from './fx';

/* ─── Renderer ───────────────────────────────────────────────────────────── */

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // needed for HD download
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ─── Scene ──────────────────────────────────────────────────────────────── */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010306);
scene.fog = new THREE.FogExp2(0x010408, 0.18);

/* ─── Camera (100 mm equivalent ≈ FOV 24°) ──────────────────────────────── */

const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.05, 40);
camera.position.set(0.2, 0.7, 5.2);
camera.lookAt(0, 0.08, 0);

/* ─── Controls ───────────────────────────────────────────────────────────── */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.2;
controls.maxDistance = 9.0;
controls.maxPolarAngle = Math.PI * 0.82;
controls.target.set(0, 0.05, 0);
controls.update();

/* ─── Environment map (needed for transmission reflections) ─────────────── */

const envMap = buildEnvMap(renderer);
scene.environment = envMap;

/* ─── Scene objects ──────────────────────────────────────────────────────── */

setupLights(scene);

const iris = createIrisFlower(envMap);
scene.add(iris);

const rock = createRockBase();
scene.add(rock);

const ground = createGround();
scene.add(ground);

const fogPlanes = createFogPlanes();
scene.add(fogPlanes);

/* ─── Post-processing ────────────────────────────────────────────────────── */

const fx = buildComposer(renderer, scene, camera);

/* ─── Subtle iris rotation ───────────────────────────────────────────────── */

let autoRotate = true;
controls.addEventListener('start', () => { autoRotate = false; });

/* ─── Resize handler ─────────────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
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
  const elapsed = clock.getElapsedTime();

  if (autoRotate) {
    iris.rotation.y = elapsed * 0.08;
  }

  // Subtle fog plane drift
  fogPlanes.children.forEach((child, i) => {
    child.position.y += Math.sin(elapsed * 0.3 + i) * 0.0004;
  });

  controls.update();
  fx.tick(dt);
  fx.composer.render();
}

animate();

/* ─── Hide loading overlay ───────────────────────────────────────────────── */

setTimeout(() => {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');
}, 200);

/* ─── HD Download ────────────────────────────────────────────────────────── */

document.getElementById('btn-download')!.addEventListener('click', () => {
  downloadHD(3840, 2160);
});

function downloadHD(width: number, height: number) {
  // Create a separate off-screen renderer at target resolution
  const hdRenderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  hdRenderer.setPixelRatio(1);
  hdRenderer.setSize(width, height);
  hdRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  hdRenderer.toneMappingExposure = 0.85;
  hdRenderer.outputColorSpace = THREE.SRGBColorSpace;
  hdRenderer.shadowMap.enabled = true;
  hdRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Rebuild composer at HD resolution
  const hdComposer = buildComposer(hdRenderer, scene, camera);
  hdComposer.setSize(width, height);

  const hdCamera = camera.clone() as THREE.PerspectiveCamera;
  hdCamera.aspect = width / height;
  hdCamera.updateProjectionMatrix();

  // Render one frame
  hdComposer.composer.render();

  // Export
  const canvas = hdRenderer.domElement;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iris-3d-${width}x${height}.png`;
    a.click();
    URL.revokeObjectURL(url);
    hdRenderer.dispose();
  }, 'image/png');
}
