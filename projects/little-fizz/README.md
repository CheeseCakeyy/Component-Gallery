# Little Fizz

A frosted ice puppy that follows your pointer through a glass of sparkling cola.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5188. `npm run build` produces a self-contained static website in `dist`; `npm run preview` serves that build on port 4188.

## Play

- Move the mouse, or drag on a touch screen, to lead the puppy around.
- Lead the puppy into an ice cube to push it away. Off-center bumps make cubes spin; cubes also bump one another and drift to a gentle stop in the liquid.
- Click / tap the scene to boop it: it bounces, wiggles, and releases bubbles.
- **More fizz** adds a burst of rising bubbles and resumes a paused scene.
- **Pause** freezes the entire simulation. Space also pauses when the page itself has focus.
- **Reset** sends the puppy home; while paused it moves home immediately.
- Sound starts muted. The speaker button enables a quiet synthesized fizz and soft bubble pops.
- Reduced-motion preferences start the scene paused. The user can explicitly press play.

## Rendering

This is a custom **WebGL2 / GLSL, texture-based 2.5D scene**, not a fully modeled or rigged 3D dog. The supplied reference informed two original generated textures. Keeping the detailed ice and puppy as artwork gives a closer match to the reference than simple 3D primitives.

The GPU renders a gently refracting, liquid-only cola backdrop into an offscreen buffer. All visible ice cubes are separate raymarched rounded 3D boxes, with refraction, bevel highlights and trapped-bubble details. They rotate independently in foreground and background layers; foreground cubes sample a second composition buffer, so they also refract the puppy. A separately animated transparent puppy samples the liquid buffer for glass-edge refraction. Local shader deformations animate the ears, eyes, blinking, and small surface highlights. Bubbles use shaded point sprites in two depth layers. A damped spring controls the puppy's position and tilt.

The ice physics run in pixel coordinates with substeps, liquid drag, rotation, rounded-box contacts against the puppy's body, box-to-box collision response, and scene boundaries. The cursor-driven puppy acts as the heavier body and pushes the ice. The photo's original fixed ice was removed from the new liquid-only background; the older image is retained as source artwork only.

No Three.js, Blender export, or runtime rendering library is required. Vite is the only development dependency. Fonts and image assets are local; no API keys, remote services, or network connection are required after the app has loaded.

### Files

- `src/scene.js` — renderer, particles, motion, resize and resource lifecycle.
- `src/shaders.js` — backdrop, ice, refraction and bubble shaders.
- `src/ice-shader.js` — separately rendered solid ice cubes.
- `src/ice-physics.js` — ice drift, rotation, contacts and boundaries.
- `src/ice-physics.test.js` — contact, momentum transfer, stability and resize checks (`npm test`).
- `src/main.js` — pointer / touch events, controls, Web Audio and accessibility.
- `src/style.css` — responsive page styling.
- `public/assets/` — optimized production WebP images.
- `artwork/` — original PNGs and generation provenance; not copied to the production build.

`FizzScene` can be imported into another Vite project and mounted on a canvas. Call `init()`, pass normalized bottom-left-origin coordinates to `move(x, y)`, and call `dispose()` on unmount. The class also exposes `boop()`, `moreFizz()`, `reset()`, `leave()`, and `setPaused(boolean)`.

### Practical limits

Requires WebGL2. Unsupported browsers get a clear fallback message. This preserves a frontal view of the puppy; it does not rotate to a side or rear view. Render resolution is capped to avoid excessive work on high-density screens. Animation stops when the document is hidden; paused frames are not redrawn unnecessarily. WebGL context restoration recreates GPU resources.

## Validation

Production build passed. Browser checks covered desktop and 390px / 320px phone viewports, pointer following, bounded movement, pause, reset (including while paused), bubble bursts, sound toggle, absence of horizontal overflow, and WebGL error diagnostics. Phone controls have 44px touch targets. Desktop rendering was approximately 60 fps on the test machine; performance depends on device and browser. The touch event path is implemented, but has not been verified on physical phone hardware.

Original image prompts and tool provenance are in `artwork/PROMPTS.md`. Fonts use the SIL Open Font License, included in `public/fonts/`.
