import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

export function setupLights(scene: THREE.Scene): void {
  // Diagonal god-ray from upper-right — the dominant white shaft in ref
  const godRay = new THREE.RectAreaLight(0xd0e4ff, 70, 1.6, 6);
  godRay.position.set(3.0, 5.5, 1.5);
  godRay.lookAt(0, 0.1, 0);
  scene.add(godRay);

  // Secondary diagonal shaft — left-high, slightly cooler blue
  const godRay2 = new THREE.RectAreaLight(0xb0c8ff, 44, 1.2, 4.5);
  godRay2.position.set(-2.5, 4.8, 0.8);
  godRay2.lookAt(0, 0.1, 0);
  scene.add(godRay2);

  // Rim — back-right hard silver edge catching petal outlines
  const rim = new THREE.RectAreaLight(0xbbd4ff, 60, 1.8, 1.8);
  rim.position.set(2.8, 0.8, -2.6);
  rim.lookAt(0, 0.1, 0);
  scene.add(rim);

  // Cool back fill — deep blue transmission glow through petals
  const backCool = new THREE.RectAreaLight(0x0e2258, 48, 4, 4);
  backCool.position.set(-0.6, -0.5, -3.4);
  backCool.lookAt(0, -0.1, 0);
  scene.add(backCool);

  // Very faint front ambient — keeps shadows from going pure black
  const front = new THREE.RectAreaLight(0x8aaeff, 4, 5, 5);
  front.position.set(0, 1.0, 3.5);
  front.lookAt(0, 0, 0);
  scene.add(front);

  scene.add(new THREE.AmbientLight(0x010306, 0.08));
  scene.add(new THREE.HemisphereLight(0x050c1e, 0x010208, 0.06));
}
