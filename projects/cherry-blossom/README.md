# Blossom Water

A standalone interactive cherry blossom scene based on the spring concept image. The visual treatment preserves the pale water, tree on the right, soft shadows, small left-hand text panel and drifting pink petals.

## Run

From this directory:

```sh
python -m http.server 5188 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:5188. No install or build step is required. Deploy the contents of `dist` to any static host.

## Interactions

- Click or tap the pool to create ripples.
- Move the pointer over the water for a gentle wake.
- Use **Drop a stone** for a larger ripple, including with the keyboard.
- **Pause breeze** freezes the ambient motion. Stone drops still work.
- Two whole cherry blossoms float among the loose petals, gently bobbing and responding to ripples.
- Reduced-motion preferences start with the breeze paused. Hidden tabs stop drawing.

## Rendering

The tree and its shadows are generated artwork, with subtle shader sway. They are not a freely orbitable 3D model. The water is a live native WebGL shader: expanding damped waves refract the artwork and add light to the wave crests. Individual transparent petal sprites tumble, land, drift and respond to the wave fronts in a separate canvas layer. This retains the detailed concept-image appearance without requiring Blender, Three.js or external runtime dependencies.

The water falls back to canvas ripple drawing if WebGL is unavailable. Rendering resolution is capped for high-density screens. Mobile and desktop layouts use the same scene, anchored at the right edge.

## Files

- `dist/index.html`: copy, controls and document metadata.
- `dist/style.css`: desktop/mobile layout, focus states and typography.
- `dist/scene.js`: water shader, particle motion, interactions and rendering lifecycle.
- `dist/assets/`: optimized generated background and transparent petal.

The page contains no tracking, remote scripts, fonts, contact forms or API keys. Generated assets are stored locally with the site.

## Verification

Verified in the browser at 1440 × 900 and 390 × 844: loaded artwork, active WebGL renderer, visible tree framing, no horizontal overflow, working stone and pause/resume controls, and keyboard activation. JavaScript syntax check passed; no browser errors were reported. The local preview remains the delivery URL; the Sites publishing helper became unavailable during this session, so no hosted deployment was created.
