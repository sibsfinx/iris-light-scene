import * as THREE from 'three';

export function setupLights(scene: THREE.Scene): void {
  // Upper-right key — large soft blob, no rectangular specular edge
  const key = new THREE.PointLight(0xc8deff, 18, 10, 1.4);
  key.position.set(3.0, 4.5, 1.2);
  scene.add(key);

  // Upper-left fill — cooler, weaker
  const fill = new THREE.PointLight(0x8aaae0, 9, 8, 1.4);
  fill.position.set(-2.8, 4.0, 0.6);
  scene.add(fill);

  // Back rim — subtle back-light
  const rim = new THREE.PointLight(0xb0ccff, 6, 6, 1.8);
  rim.position.set(1.8, 0.8, -2.8);
  scene.add(rim);

  // Low ambient fill — keeps shadowed petals from going pure black
  scene.add(new THREE.AmbientLight(0x060814, 0.4));
  scene.add(new THREE.HemisphereLight(0x080e28, 0x020104, 0.15));
}
