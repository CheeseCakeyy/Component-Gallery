# Dragonflight — Pixel skies

A pixel dragon with an articulated 3D skeleton and a software pixel renderer. The wings hinge and flex, the tail moves, and the camera can orbit continuously around the dragon. Above, forest terrain and a winding river scroll beneath cloud shadows. Below, three layers of overhead clouds move at different speeds against a starry sky. The side view retains its sunset horizon. Scenery transitions with camera elevation, and movement follows the camera's orientation. No external libraries or network assets are needed.

## Run locally

The recipient can double-click `Start Preview.cmd` inside that folder. It uses Windows PowerShell, starts the local server, chooses another port if 4173 is busy, and opens the preview automatically. Python, Node.js, npm, frameworks, and internet access are not required.

The matching `Start Preview.cmd` in this project root simply launches the copy inside `dist`.

Alternatively, developers can serve `dist` with any static server. For example, from this directory:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173/. If the existing preview is running, use that server instead of starting another.

Drag to orbit, scroll to zoom, use the three camera buttons or keys 1–3, and press Space to pause or resume. Dragging produces a small bank that settles after release. Flight combines quick downstrokes, slower folded recovery strokes, delayed wrist flex, membrane ripples, head movement, tucked-leg adjustments, and a travelling tail wave. Every twelve seconds the dragon eases into a short glide and resumes beating its wings. Pause freezes these motions and background travel together. The local page refreshes automatically after changes to `dist/index.html` or `dist/flight.js`.

`dist/flight.js` builds and rasterizes the articulated model. `dist/index.html` owns the controls and animation clock. `node verify-render.cjs` renders reference frames directly from the same renderer into `qa/`, without a browser, and reports render time.
