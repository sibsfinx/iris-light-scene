import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

export function setupLights(scene: THREE.Scene): void {
  // Wide RectAreaLights from the SIDES — at roughness ~0.02 the specular highlight
  // from a large area light is a tiny bright dot, not a rectangle edge.
  // Only narrow lights (< petal width) cause straight-line artefacts.

  // Key — front-right, wide + tall
  const key = new THREE.RectAreaLight(0xd0e4ff, 9, 5.0, 5.0);
  key.position.set(3.2, 1.8, 2.0);
  key.lookAt(0, 0.1, 0);
  scene.add(key);

  const fill = new THREE.RectAreaLight(0x90b0d8, 4.5, 4.5, 4.5);
  fill.position.set(-3.0, 1.2, 1.0);
  fill.lookAt(0, 0.1, 0);
  scene.add(fill);

  const rim = new THREE.RectAreaLight(0xa8c0ee, 3.5, 3.5, 3.5);
  rim.position.set(1.0, 0.2, -3.2);
  rim.lookAt(0, 0.1, 0);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x04090e, 0.4));
  scene.add(new THREE.HemisphereLight(0x080e20, 0x010103, 0.18));
}
