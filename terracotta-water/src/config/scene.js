/** Asset-only configuration. UV origin is TOP LEFT, scale is image-height fraction.
 * Replace the two environment URLs together; no renderer/physics edits are needed.
 * The supplied clean plate is independent of flowers. Add transparent cutout
 * references to the declarative list when those assets are available.
 */
export const sceneConfig = {
  environment: {
    image: '/assets/environment/golden-pavement.png',
    waterMask: '/assets/environment/golden-water-mask-v2.svg',
  },
  // Positions measured from the supplied 1672 x 941 composition reference.
  flowers: [
    { id: 'white-main', asset: '/assets/flowers/white-open.png', uv: [0.402, 0.526], scale: 0.225, rotation: -0.13 },
    { id: 'blue-upper', asset: '/assets/flowers/blue-open.png', uv: [0.490, 0.276], scale: 0.148, rotation: 0.25 },
    { id: 'pink-middle', asset: '/assets/flowers/pink-open.png', uv: [0.529, 0.383], scale: 0.148, rotation: -0.15 },
    { id: 'white-upper', asset: '/assets/flowers/white-angle.png', uv: [0.650, 0.242], scale: 0.135, rotation: 0.19 },
    { id: 'pink-upper', asset: '/assets/flowers/pink-cup.png', uv: [0.730, 0.171], scale: 0.102, rotation: 0.15 },
    { id: 'blue-lower', asset: '/assets/flowers/blue-open.png', uv: [0.460, 0.663], scale: 0.174, rotation: -0.29 },
    { id: 'white-lower', asset: '/assets/flowers/white-open.png', uv: [0.225, 0.729], scale: 0.181, rotation: 0.17 },
    { id: 'blue-stem', asset: '/assets/flowers/blue-side.png', uv: [0.308, 0.733], scale: 0.186, rotation: 0.30 },
    { id: 'distant-lilac', asset: '/assets/flowers/purple-open.png', uv: [0.629, 0.050], scale: 0.083, rotation: -0.2 },
  ],
};

// These settings describe water behavior, never the artwork's contents.
export const waterSettings = {
  resolution: 512,
  fixedStep: 1 / 120,
  damping: 0.85,
  propagation: 0.19,
  pointerRadius: 0.016,
  pointerStrength: 0.024,
  clickStrength: 0.085,
  // Idle drops: average seconds between them and their height.
  ambientDelay: 2.4,
  ambientStrength: 0.022,
};

