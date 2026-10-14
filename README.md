# Random Components: showcase

A gallery wall: every component hangs as a poster above a desk. Drag, scroll or use ← → to slide the wall (it loops). Click a poster and it opens in place with the live component running; the red **+** opens it full-screen. **Night** in the top bar switches to the dark theme. Nothing about any component is hard-coded in the page: it reads `public/manifest.json`, which is generated from the folders that exist.

Links: `#/<slug>` opens a piece full-screen, `?open=<slug>` opens it on the wall.

```
components.json          ← the text for each card (you edit this)
public/
  index.html, app.js, styles.css   ← the showcase page
  components/<slug>/     ← one built, working page per component
  thumbs/<slug>.png      ← card images
  manifest.json          ← generated: folders + components.json merged
scripts/
  add.mjs    npm run add      import a project (handles building + path fixing)
  sync.mjs   npm run sync     rebuild manifest.json, add stubs for new folders
  thumbs.mjs npm run thumbs   screenshot components that have no thumbnail
  serve.mjs  npm run dev      local server on http://127.0.0.1:5170
```

## Adding a new component

```sh
npm run add -- "../random components/my-new-thing"
npm run thumbs          # only if it had no preview.png
```

`add` copies the project's `dist/` (or builds it with Vite, wraps a rendered video, or copies a plain HTML project), fixes absolute `/assets/...` paths so it works from a subfolder, grabs a `preview.png` if there is one, and adds an entry to `components.json` using the README's heading and first paragraph. Then edit that entry's text to taste.

You can also skip the script: drop any folder with an `index.html` into `public/components/` and refresh. It gets a slot and a stub entry automatically. If its build used absolute paths (Vite's default), run it through `npm run add` instead, or build with `vite build --base ./`.

## components.json fields

| field         | what it does                                                       |
|---------------|--------------------------------------------------------------------|
| `title`       | poster heading and the big title when opened                       |
| `subtitle`    | the small line under the title (falls back to the first tag)       |
| `description` | shown beside the piece when it's opened                            |
| `tags`        | first two show as "Built with" when opened                         |
| `date`        | `YYYY-MM-DD`: newest hangs first; numbering follows it             |
| `focus`       | optional crop for the portrait poster, e.g. `"80% 40%"`            |
| `hidden`      | `true` keeps the entry but takes it off the wall                   |
| `thumb`       | optional path (relative to `public/`) to override the thumbnail    |

## Deploying

Run `npm run build` (just regenerates `manifest.json`), then publish the `public/` folder to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
