import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

export function setupLights(scene: THREE.Scene): void {
  // Primary god-ray — upper-right, wide soft area
  const godRay = new THREE.RectAreaLight(0xe0eeff, 28, 2.8, 6.0);
  godRay.position.set(3.4, 5.5, 0.8);
  godRay.lookAt(-0.5, 0.0, 0);
  scene.add(godRay);

  // Secondary shaft — upper-left, wide soft area
  const godRay2 = new THREE.RectAreaLight(0xc0d8ff, 18, 2.4, 4.5);
  godRay2.position.set(-3.0, 4.8, 0.4);
  godRay2.lookAt(0.4, 0.0, 0);
  scene.add(godRay2);

  // Rim — back-right, larger area = softer curved highlight, not knife-edge line
  const rim = new THREE.RectAreaLight(0xe0eeff, 32, 2.2, 2.2);
  rim.position.set(2.4, 0.5, -2.6);
  rim.lookAt(0, 0.1, 0);
  scene.add(rim);

  // Second rim — left back
  const rim2 = new THREE.RectAreaLight(0x8aaade, 18, 1.8, 1.8);
  rim2.position.set(-2.2, 0.4, -2.4);
  rim2.lookAt(0, 0.1, 0);
  scene.add(rim2);

  // Bare minimum back fill
  const backCool = new THREE.RectAreaLight(0x040a1e, 10, 3.0, 3.0);
  backCool.position.set(0, -0.3, -3.0);
  backCool.lookAt(0, 0, 0);
  scene.add(backCool);

  scene.add(new THREE.AmbientLight(0x010102, 0.03));
  scene.add(new THREE.HemisphereLight(0x010408, 0x010101, 0.02));
}
