import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

export function setupLights(scene: THREE.Scene): void {
  RectAreaLightUniformsLib.init();

  // ── Key Light — dim front-left fill, not the hero light ──────────────────
  const key = new THREE.RectAreaLight(0xd0dcff, 28, 3, 3);
  key.position.set(-2.8, 2.2, 2.0);
  key.lookAt(0, 0, 0);
  scene.add(key);

  // ── Rim Light — strong back-right, silver edges ───────────────────────────
  const rim = new THREE.RectAreaLight(0xb8ccff, 95, 2, 2);
  rim.position.set(2.2, 0.8, -2.4);
  rim.lookAt(0, 0.1, 0);
  scene.add(rim);

  // ── Top Godray — overhead backlight, pulled further back to avoid blowout ─
  const topGodray = new THREE.RectAreaLight(0xaabfff, 55, 3, 3);
  topGodray.position.set(0.2, 3.8, -1.6);
  topGodray.lookAt(0, 0, 0);
  scene.add(topGodray);

  // ── Back Light — directly behind, pure blue transmission driver ───────────
  const back = new THREE.RectAreaLight(0x4060a0, 50, 2.5, 2.5);
  back.position.set(-0.2, 0.3, -3.2);
  back.lookAt(0, 0, 0);
  scene.add(back);

  const ambient = new THREE.AmbientLight(0x02040c, 0.18);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x060c20, 0x000204, 0.1);
  scene.add(hemi);
}
