# Random Components: showcase

A gallery wall: every component hangs as a poster above a desk. Drag, scroll or use ← → to slide the wall (it loops). Click a poster and it opens in place with the live component running; the red **+** opens the full page. **Night** in the top bar switches to the dark theme. Nothing about any component is hard-coded in the page: it reads `public/manifest.json`, which is generated from the folders that exist.

Links: `#/<slug>` opens a piece full-screen, `?open=<slug>` opens it on the wall.

```
components.json          ← text and display settings for each piece (you edit this)
projects/<slug>/         ← the source projects (not published)
public/                  ← the website; publish this folder
  index.html, app.js, styles.css
  components/<slug>/     ← one built, working page per piece
  thumbs/<slug>.webp     ← poster        (made by npm run posters)
  thumbs/<slug>-stage.webp  still of the opened view, shown until the live piece is ready
  thumbs/<slug>.json     ← poster colour and measurements
  manifest.json          ← generated: folders + components.json + thumbs merged
scripts/
  add.mjs      npm run add       import a project (builds it, fixes paths, makes its poster)
  posters.mjs  npm run posters   make posters with the Chrome or Edge on this machine
  sync.mjs     npm run sync      rebuild manifest.json, add stubs for new folders
  serve.mjs    npm run dev       local server on http://127.0.0.1:5170
```

The source projects live in `projects/`, not `public/`, because everything in `public/` gets uploaded when you deploy and the sources carry about 110 MB of artwork, Blender files and duplicate builds. `public/components/` already holds the working copy of each one.

Needs Node 22 or newer.

## Adding a new component

Put the project in `projects/`, then:

```sh
npm run add -- projects/my-new-thing
```

`add` copies the project's `dist/` (or builds it with Vite, wraps a rendered video, or copies a plain HTML project), fixes absolute `/assets/...` paths so it works from a subfolder, adds an entry to `components.json` using the README's heading and first paragraph, and makes the poster. Then edit that entry's text and, if the poster needs it, its display settings (below), and run `npm run posters -- my-new-thing` again.

`npm run add -- --all` re-imports everything in `projects/`.

## components.json

Text:

| field         | what it does                                                       |
|---------------|--------------------------------------------------------------------|
| `title`       | poster heading and the big title when opened                       |
| `subtitle`    | the small line under the title (falls back to the first tag)       |
| `description` | shown beside the piece when it's opened                            |
| `tags`        | first two show as "Built with" when opened                         |
| `date`        | `YYYY-MM-DD`: newest hangs first; numbering follows it             |
| `hidden`      | `true` keeps the entry but takes it off the wall                   |

Display (re-run `npm run posters -- <slug>` after changing these):

| field       | what it does                                                                         |
|-------------|--------------------------------------------------------------------------------------|
| `show`      | CSS selector: when opened, only this element is shown, not the whole page            |
| `viewport`  | `[width, height]` to render the page at (default `[1280, 800]`)                       |
| `ready`     | selector that appears once the page has finished loading; the live view waits for it |
| `trim`      | with `show`: fraction to cut off `[left, top, right, bottom]`                         |
| `poster`    | how the poster is framed, see below                                                  |

`poster` options: `hide` (selectors to leave out, such as headers, captions and buttons), `x` / `y` (which point of the page to frame, 0–1), `at` (how far down the poster that point sits), `zoom` (above 1 is tighter, below 1 pulls back), `scroll` (scroll the page first), `fill` (with `show`: let the element fill the poster), `bg` (force the card colour), `wait` (ms to let the page settle), `image` (use a file instead of a picture).

Example:

```json
"koi-pond": {
  "title": "Stillwater",
  "show": ".pond-frame",
  "viewport": [1280, 1040],
  "ready": ".pond-frame.is-ready"
}
```

## Deploying

Run `npm run build` (just regenerates `manifest.json`), then publish the `public/` folder to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
