import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

export function setupLights(scene: THREE.Scene): void {
  // Primary god-ray — upper-right, tight bright shaft
  const godRay = new THREE.RectAreaLight(0xe0eeff, 55, 0.7, 6.0);
  godRay.position.set(3.4, 5.5, 0.8);
  godRay.lookAt(-0.5, 0.0, 0);
  scene.add(godRay);

  // Secondary shaft — upper-left crossing over
  const godRay2 = new THREE.RectAreaLight(0xc0d8ff, 30, 0.6, 4.5);
  godRay2.position.set(-3.0, 4.8, 0.4);
  godRay2.lookAt(0.4, 0.0, 0);
  scene.add(godRay2);

  // Hard rim — back-right, sharp silver sliver on petal edges
  const rim = new THREE.RectAreaLight(0xe0eeff, 65, 0.8, 0.8);
  rim.position.set(2.4, 0.5, -2.6);
  rim.lookAt(0, 0.1, 0);
  scene.add(rim);

  // Second rim — left back, cross-lighting for edge separation
  const rim2 = new THREE.RectAreaLight(0x8aaade, 28, 0.7, 0.7);
  rim2.position.set(-2.2, 0.4, -2.4);
  rim2.lookAt(0, 0.1, 0);
  scene.add(rim2);

  // Bare minimum back fill — just enough transmission glow, no blue spill
  const backCool = new THREE.RectAreaLight(0x040a1e, 10, 3.0, 3.0);
  backCool.position.set(0, -0.3, -3.0);
  backCool.lookAt(0, 0, 0);
  scene.add(backCool);

  // Grazing side spot — hits petal surfaces at low angle to streak veins
  const sideSpot = new THREE.SpotLight(0xd8eeff, 18, 8.0, Math.PI * 0.06, 0.8, 1.5);
  sideSpot.position.set(-2.8, 0.2, 0.8);
  sideSpot.target.position.set(0, 0.1, 0);
  scene.add(sideSpot);
  scene.add(sideSpot.target);

  scene.add(new THREE.AmbientLight(0x010102, 0.03));
  scene.add(new THREE.HemisphereLight(0x010408, 0x010101, 0.02));
}
