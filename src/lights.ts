import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

export function setupLights(scene: THREE.Scene): void {
  // Key light — front-left, very dim, keeps front petals dark so you see through them
  const key = new THREE.RectAreaLight(0xd0dcff, 8, 4, 4);
  key.position.set(-3.2, 2.8, 2.5);
  key.lookAt(0, 0, 0);
  scene.add(key);

  // Rim light — back-right, strong silver edge
  const rim = new THREE.RectAreaLight(0xc0d4ff, 52, 2, 2);
  rim.position.set(2.6, 1.0, -2.8);
  rim.lookAt(0, 0.1, 0);
  scene.add(rim);

  // Top godray — overhead, slightly behind
  const topGodray = new THREE.RectAreaLight(0xa8c2ff, 28, 3, 3);
  topGodray.position.set(0.2, 4.5, -2.0);
  topGodray.lookAt(0, 0, 0);
  scene.add(topGodray);

  // Warm back light — amber gold accent (tighter, less area = less spill)
  const backWarm = new THREE.RectAreaLight(0xc87018, 22, 1.4, 1.4);
  backWarm.position.set(0.6, 1.0, -3.4);
  backWarm.lookAt(0, 0.1, 0);
  scene.add(backWarm);

  // Cool back fill — stronger to shift overall tone toward blue reference
  const backCool = new THREE.RectAreaLight(0x1a3870, 32, 3.5, 3.5);
  backCool.position.set(-0.8, -0.3, -3.2);
  backCool.lookAt(0, -0.2, 0);
  scene.add(backCool);

  scene.add(new THREE.AmbientLight(0x020408, 0.12));
  scene.add(new THREE.HemisphereLight(0x040818, 0x010204, 0.08));
}
