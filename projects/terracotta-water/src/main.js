import './style.css';
import { sceneConfig, waterSettings } from './config/scene.js';
import { AssetLoader } from './utils/AssetLoader.js';
import { CoordinateMapper } from './utils/CoordinateMapper.js';
import { createRenderer } from './scene/Renderer.js';
import { createEnvironment } from './scene/Environment.js';
import { createFlowers } from './scene/Flowers.js';
import { RippleSimulation } from './water/RippleSimulation.js';
import { createWaterRenderer } from './water/WaterRenderer.js';
import { createAmbientRipples } from './water/AmbientRipples.js';
import { addPointerInteraction } from './interaction/PointerInteraction.js';

const canvas = document.querySelector('canvas');
const loader = new AssetLoader();
let dispose = () => loader.dispose();
async function start() {
  const assets = await loader.environment(sceneConfig.environment);
  const mapper = new CoordinateMapper(assets.width, assets.height);
  const view = createRenderer(canvas, mapper);
  const environment = createEnvironment(view.scene, assets, mapper);
  const simulation = new RippleSimulation(mapper.aspect, assets.sampleMask, waterSettings);
  const water = createWaterRenderer(view.scene, assets, mapper, simulation);
  const flowers = await createFlowers(view.scene, sceneConfig.flowers, loader, mapper, simulation);
  const removePointer = addPointerInteraction(canvas, mapper, simulation, waterSettings);
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ambient = calm ? null : createAmbientRipples(simulation, waterSettings);
  let previous = performance.now();
  view.renderer.setAnimationLoop(now => {
    const dt = Math.min((now-previous)/1000, .05);
    previous = now;
    ambient?.update(dt);
    simulation.update(dt);
    water.update(simulation.time);
    flowers.update(dt);
    view.renderer.render(view.scene, view.camera);
  });
  canvas.dataset.ready = 'true';
  dispose = () => {
    view.renderer.setAnimationLoop(null);
    removePointer(); flowers.dispose(); water.dispose(); environment.dispose();
    view.dispose(); loader.dispose();
  };
}
start().catch(error => {
  console.error('Unable to load the water garden:', error);
  canvas.dataset.ready = 'error';
  canvas.setAttribute('aria-label', `Water garden could not load: ${error.message}`);
});
if (import.meta.hot) import.meta.hot.dispose(() => dispose());
