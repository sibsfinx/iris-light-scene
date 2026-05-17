import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

export function setupLights(scene: THREE.Scene): void {
  // Wide RectAreaLights spread specular across the full area → no concentrated
  // point-source squares or pillar streaks on glass surfaces.

  // Key — front-right diagonal, large area = soft diffuse specular
  const key = new THREE.RectAreaLight(0xc0d4ff, 3.5, 6.0, 6.0);
  key.position.set(3.2, 1.8, 2.0);
  key.lookAt(0, 0.1, 0);
  scene.add(key);

  // Fill — opposite side, cooler tint
  const fill = new THREE.RectAreaLight(0x8090c0, 1.8, 5.5, 5.5);
  fill.position.set(-3.0, 1.2, 1.0);
  fill.lookAt(0, 0.1, 0);
  scene.add(fill);

  // Rim — behind, creates edge separation without overhead pillar
  const rim = new THREE.RectAreaLight(0x9aaad8, 1.2, 4.5, 4.5);
  rim.position.set(1.0, 0.2, -3.2);
  rim.lookAt(0, 0.1, 0);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x040810, 0.5));
}
