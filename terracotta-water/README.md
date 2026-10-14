# Layered water garden

Run `npm install`, then `npm run dev`. Open http://127.0.0.1:5187.
`npm run build` builds production assets; `npm test` checks registration and physics.

## Asset replacement

Edit only `src/config/scene.js`. Environment entries specify `image` and `waterMask` URLs.
Both must have identical pixel dimensions. White means water, black means protected
artwork. PNG, WebP and SVG masks work; masks load as linear data, not sRGB colors.
Remote assets must allow CORS, including mask pixel access.

Each `flowers` entry declares:

```js
{ id: 'blue-01', asset: '/assets/flowers/blue-01.webp',
  uv: [0.47, 0.55], scale: 0.12, rotation: 0.3 }
```

This is a schema example, not a bundled flower asset. UV origin is top-left; scale
is a fraction of source image height; rotation is in radians. Texture dimensions
supply aspect ratio automatically. Transparent cutouts should be tightly cropped
with the intended pivot at their center. Replace only `asset` to swap a flower.
Replace the environment and mask together, then adjust flower UVs if needed.
No shader, simulation or interaction code needs to change.

## Current assets and initial milestones

The supplied clean pavement is copied unchanged to `public/assets/environment/golden-pavement.png`.
Its matching mask is `golden-water-mask-v2.svg`. The earlier flower-bearing image is
retained as an unused reference. Seven generated transparent flower assets (white,
blue, pink, purple, frontal and side views) are instantiated as twelve independent foreground flowers through
the declarative `flowers` list. Each samples the live water field with damped motion.

The separate SVG mask uses white water around individually traced black tile silhouettes
on both sides. Its dimensions exactly match the plate,
but it is not pixel-perfect segmentation of every small wet edge. Replace it with
an art-directed full-resolution mask for final edge coverage.

The environment, mask and water-layer milestones are implemented, plus pointer
ripples and independent transparent flowers. Replace any flower by changing its
asset reference; placement, physics and the rendering pipeline stay unchanged.
Generation details are recorded in `public/assets/flowers/ASSETS.md`.

## Modules

- `CoordinateMapper`: one cover transform shared by the orthographic camera,
  all image planes, pointer mapping, masks and flower positions. Resize changes
  the camera crop, never layer registration.
- `AssetLoader`: texture caching, color space, mask dimension validation and sampling.
- `Environment`: unlit image plane; no modeled cobblestones or synthetic stone lighting.
- `RippleSimulation`: fixed-step, masked finite-difference waves with damping and
  reflecting dry boundaries. Approximately 512x288 cells for 16:9 art. Typed CPU
  arrays feed a small GPU float texture each frame, letting flowers read the exact
  same field without GPU readback. Physics resolution is independent of viewport.
- `WaterRenderer`: GPU normals, masked refraction, subtle moving gold and twinkling sun glitter.
  Source and refracted coordinates are mask-gated to protect stone artwork.
- `PointerInteraction`: shared screen-to-UV mapping, dry-pixel rejection before injection.
- `AmbientRipples`: occasional soft drops on wet cells so the pool keeps moving
  when idle (`ambientDelay`, `ambientStrength`). Disabled under reduced motion.
- `Flowers`: independent transparent planes, spring/damped tilt and bob, bounded
  drift and a slow idle sway. Shading is derived from each cutout's own alpha:
  warm low-sun grading, wet darkened edges, one side tipped under the surface
  (with the water's caustic web and a slight refractive wobble), water-bead glints,
  and a soft offset shadow on the pool bed that blocks caustic light. Any
  replacement asset gets the same treatment. No procedural petal geometry.

No debug overlay or visible UI is shipped. Device pixel ratio is capped at 1.75.



