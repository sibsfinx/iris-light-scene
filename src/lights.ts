import * as THREE from 'three';

export function setupLights(scene: THREE.Scene): void {
  // Front-right diagonal — main key, side-on so specular hits at an angle not straight down
  const key = new THREE.PointLight(0xc8deff, 35, 10, 1.3);
  key.position.set(2.8, 1.8, 2.2);
  scene.add(key);

  // Left fill — opposite side, cooler
  const fill = new THREE.PointLight(0x8aaae0, 18, 9, 1.3);
  fill.position.set(-2.6, 1.4, 1.6);
  scene.add(fill);

  // Back rim — behind/below, creates edge separation from background
  const rim = new THREE.PointLight(0xa8c8ff, 12, 7, 1.5);
  rim.position.set(0.8, 0.4, -2.8);
  scene.add(rim);

  // Very weak top — just enough to read petal tips, not a pillar source
  const top = new THREE.PointLight(0x6080c0, 6, 6, 1.8);
  top.position.set(0, 3.5, 0.5);
  scene.add(top);

  scene.add(new THREE.AmbientLight(0x080e28, 0.8));
  scene.add(new THREE.HemisphereLight(0x0c1438, 0x030106, 0.35));
}
