import * as THREE from 'three';

export function createEnvironment(scene, assets, mapper) {
  const geometry = new THREE.PlaneGeometry(mapper.aspect, 1);
  const material = new THREE.MeshBasicMaterial({ map: assets.image, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  return { mesh, dispose() { scene.remove(mesh); geometry.dispose(); material.dispose(); } };
}
