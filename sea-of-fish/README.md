# A Sea of Small Lives

A scroll-driven illustrated page in three parts, drawn live on a 2D canvas in a
marker-and-fineliner / watercolour style.

1. **The hill**: a half-planet of fish slowly turning, with a little red boat riding on top.
2. **Fish wipe**: a school pours in from the right, fills the screen, turns, and streams out.
3. **The horizon**: the sea goes flat and the camera moves in close on the boat.
4. **The dive**: the camera sinks below the fish and the ink washes out.
5. **Beneath the surface**: watercolour fish swirl in a spiral around the words.

Everything follows the scroll, so it plays backwards when you scroll back up.

## Interactions

- Move the pointer through any school and the fish scatter, then regroup.
- Hill: click the fish for a ripple, click the boat to make it hop, click the sky for a shooting star.
- Horizon: click the water and fish leap out; click the boat for a tug on the line; click the sky for a shooting star.
- Deep: click to burst the circle; hover the words to draw it in; scrolling or fast pointer moves speed up the swirl.
- The dots on the right jump between pages.

## Run

```bash
npm install
npm run dev
```

Opens on http://127.0.0.1:5191. `npm run build` writes a static site to `dist/`.

## Deploy to Vercel

The project lives in a subfolder of a larger repo, so point Vercel at it:

1. Push the repo to GitHub (or GitLab / Bitbucket).
2. In Vercel: **Add New → Project**, import the repo.
3. Set **Root Directory** to `sea-of-fish`. Everything else is read from `vercel.json`
   (Vite preset, `npm ci`, `npm run build`, output `dist/`) and `package.json` (Node 22).
4. Deploy.

Or from this folder with the CLI: `npx vercel` (preview) then `npx vercel --prod`.

`vercel.json` also sets long-term caching for the hashed files in `/assets` and a few
basic security headers. It's a fully static site: no server code or environment variables.

To check a production build locally first:

```bash
npm run build
npm run preview
```

Then open http://127.0.0.1:4191.

## Layout

- `src/main.js`: scroll timeline, pointer input, page copy, frame loop
- `src/art/`: fish sprite atlases (ink + watercolour, rendered at display size), boat, sky, bubbles
- `src/gl/FishLayer.js`: draws every fish in a few instanced WebGL calls (2D canvas fallback)
- `src/scenes/`: `dome` (page 1), `wipe` (transition), `horizon` (page 2 + dive), `vortex` (page 3)
- `src/physics.js`: spring offsets that let fish dodge the pointer and ripples
