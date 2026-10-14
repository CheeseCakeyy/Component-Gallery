import * as THREE from 'three';
import vertexShader from './water.vert?raw';
import fragmentShader from './water.frag?raw';

export function createWaterRenderer(scene, assets, mapper, simulation) {
  const heightTexture = new THREE.DataTexture(simulation.current, simulation.width, simulation.height, THREE.RedFormat, THREE.FloatType);
  heightTexture.minFilter = heightTexture.magFilter = THREE.NearestFilter;
  heightTexture.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false,
    uniforms: {
      uImage: { value: assets.image }, uMask: { value: assets.mask },
      uHeight: { value: heightTexture }, uTime: { value: 0 },
      uAspect: { value: mapper.aspect },
      uResolution: { value: new THREE.Vector2(simulation.width, simulation.height) },
    },
  });
  const geometry = new THREE.PlaneGeometry(mapper.aspect, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = .01;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return {
    update(time) {
      heightTexture.image.data = simulation.current;
      heightTexture.needsUpdate = true;
      material.uniforms.uTime.value = time;
    },
    dispose() { scene.remove(mesh); geometry.dispose(); material.dispose(); heightTexture.dispose(); },
  };
}
