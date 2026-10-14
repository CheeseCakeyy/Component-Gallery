import * as THREE from 'three';

export function createRenderer(canvas, mapper) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The artwork already contains photographic lighting. Preserve its colors.
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  camera.position.z = 2;
  function resize() {
    mapper.resize(window.innerWidth, window.innerHeight);
    mapper.applyCamera(camera);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(mapper.width, mapper.height);
  }
  resize();
  window.addEventListener('resize', resize);
  return { renderer, scene, camera, dispose() {
    window.removeEventListener('resize', resize);
    renderer.dispose();
  } };
}
