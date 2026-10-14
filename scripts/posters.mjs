// Makes the artwork for each piece with the Chrome or Edge already on this machine:
//
//   public/thumbs/<slug>.webp        the poster that hangs on the wall
//   public/thumbs/<slug>-stage.webp  a still of exactly what the opened view shows, so the live
//                                    component can fade in over it without a visible jump
//   public/thumbs/<slug>.json        measurements: poster colour, and where the main element sits
//
//   npm run posters                       -> pieces that don't have artwork yet
//   npm run posters -- koi-pond keyspace  -> just these
//   npm run posters -- --all              -> everything
//
// How a poster is composed comes from components.json:
//   "show": ".pond-frame"     only this element is shown when the piece is opened, and the poster
//                             places it on its page's own colour
//   "viewport": [1280, 1040]  page size to render at (default 1280 x 800)
//   "ready": ".x.is-ready"    wait until this matches before taking pictures (and before the
//                             opened view swaps its still for the live page)
//   "trim": [0, 0, 0.13, 0]   with "show": cut this fraction off the element's left/top/right/bottom
//   "poster": {
//     "hide": [".intro"],     page UI to leave out of the poster (headers, captions, buttons)
//     "x": 0.5, "y": 0.5,     which point of the page to frame (0 = left/top, 1 = right/bottom)
//     "at": 0.62,             put that point this far down the poster (fills above with the scene's colour)
//     "zoom": 1,              above 1 frames tighter, below 1 pulls back
//     "scroll": 1300,         scroll the page this far first (for scroll-driven pages)
//     "fill": true,           with "show": let the element fill the poster instead of sitting on it
//     "wait": 3000,           ms to let the page settle before the picture is taken
//     "bg": "#121212",        the card colour, when the measured one isn't right
//     "image": "projects/x/art.png"   use this file instead of taking a picture
//   }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, THUMBS_DIR, readContent, sync } from './sync.mjs';
import { createServer } from './serve.mjs';

export const POSTER = { w: 720, h: 977 };   // the card's 0.737 aspect, at 2x the card's on-screen size
const STILL_W = 1200;
const SHOW_PAD = 0.06;                       // breathing room around a "show" element

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean);
export const findBrowser = () => BROWSERS.find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── A tiny DevTools-protocol client ─────────────────────
async function launch(browserPath) {
  if (typeof WebSocket === 'undefined') throw new Error('needs Node 22 or newer (for the built-in WebSocket)');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-posters-'));
  const proc = spawn(browserPath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });

  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch {}
  }
  if (!port) { proc.kill(); throw new Error('the browser did not start'); }
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');

  return {
    async goto(url, [width, height], dpr = 2) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
      const loaded = new Promise((resolve) => {
        const l = (m) => { if (m.method === 'Page.loadEventFired') { listeners.delete(l); resolve(); } };
        listeners.add(l);
        setTimeout(() => { listeners.delete(l); resolve(); }, 20000);
      });
      await send('Page.navigate', { url });
      await loaded;
    },
    async eval(fn, ...args) {
      const r = await send('Runtime.evaluate', {
        expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true,
      });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async shot(clip) {
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip && { clip: { ...clip, scale: 1 } }) });
      return 'data:image/png;base64,' + r.data;
    },
    async close() {
      try { ws.close(); } catch {}
      proc.kill();
      await sleep(400);
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}

// ── Code that runs inside the page ──────────────────────
// Hides everything but `sel` (keeping the page's own background colour behind it) and returns
// the element's box plus a little padding. app.js does the same thing in the opened view.
function isolateInPage(sel, padFrac) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    (function find() {
      const el = document.querySelector(sel);
      if (!el) return performance.now() - t0 > 6000 ? resolve({ error: `"${sel}" not found` }) : setTimeout(find, 100);
      let bg = null;
      for (let e = el.parentElement; e && !bg; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) bg = c;
      }
      const style = document.createElement('style');
      style.textContent = `html{background:${bg || 'transparent'} !important;overflow:hidden !important}
        body{background:transparent !important}
        body *{visibility:hidden !important}
        ${sel},${sel} *{visibility:visible !important}`;
      document.head.append(style);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const pad = bg ? padFrac * Math.max(r.width, r.height) : 0;
        const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
        const w = Math.min(innerWidth, r.right + pad) - x, h = Math.min(innerHeight, r.bottom + pad) - y;
        resolve({ rect: [x, y, w, h].map((v) => Math.round(v)), bg });
      }));
    })();
  });
}

function hideInPage(selectors) {
  const style = document.createElement('style');
  // opacity as well: some pages set visibility on their own text while animating it in
  style.textContent = selectors.map((sel) => `${sel},${sel} *`).join(',') + '{visibility:hidden !important;opacity:0 !important}';
  document.head.append(style);
}

// Builds the poster on a canvas: an element sitting on its page colour ("object"),
// or a portrait slice of a full scene ("scene"). Returns webp data plus the colour the card
// should be, so the picture runs into the card without a visible edge.
async function composeInPage(src, mode, opts) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const { outW, outH, x = 0.5, y = 0.5, zoom = 1 } = opts;
  const c = document.createElement('canvas');
  c.width = outW; c.height = outH;
  const g = c.getContext('2d');
  // median rather than mean, so a band of white cards on black felt reads as black, not grey
  const median = (ctx, sx, sy, sw, sh) => {
    const d = ctx.getImageData(Math.round(sx), Math.round(sy), Math.max(1, Math.round(sw)), Math.max(1, Math.round(sh))).data;
    const ch = [[], [], []];
    for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
    return ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  };
  let bg;
  if (mode === 'object') {
    const t = document.createElement('canvas');
    t.width = img.width; t.height = img.height;
    const tg = t.getContext('2d');
    tg.drawImage(img, 0, 0);
    const k = Math.max(2, Math.round(Math.min(img.width, img.height) * 0.02));
    const corners = [[0, 0], [img.width - k, 0], [0, img.height - k], [img.width - k, img.height - k]]
      .map(([cx, cy]) => median(tg, cx, cy, k, k));
    bg = corners.reduce((a, v) => a.map((s, i) => s + v[i] / 4), [0, 0, 0]);
    g.fillStyle = `rgb(${bg.map(Math.round)})`;
    g.fillRect(0, 0, outW, outH);
    // feather the element's edges into the paper, so it reads as printed, not pasted on
    const soft = document.createElement('canvas');
    soft.width = img.width; soft.height = img.height;
    const sg = soft.getContext('2d');
    sg.drawImage(img, 0, 0);
    sg.globalCompositeOperation = 'destination-in';
    const f = Math.min(img.width, img.height) * 0.09;
    for (const [x0, y0, x1, y1, len] of [[0, 0, img.width, 0, img.width], [0, 0, 0, img.height, img.height]]) {
      const grad = sg.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(f / len, '#000');
      grad.addColorStop(1 - f / len, '#000');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = grad;
      sg.fillRect(0, 0, img.width, img.height);
    }
    const s = Math.min((outW * 0.86) / img.width, (outH * 0.56) / img.height);
    const w = img.width * s, h = img.height * s;
    g.drawImage(soft, (outW - w) / 2, outH * 0.665 - h / 2, w, h);
  } else {
    // The point (x, y) of the scene lands at height `at` on the poster. With zoom < 1 or a
    // custom `at`, any uncovered edge is filled with the colour along the scene's top edge.
    const at = opts.at ?? 0.5;
    const free = zoom < 1 || opts.at != null;
    const sc = Math.max(outW / img.width, outH / img.height) * zoom;
    const w = img.width * sc, h = img.height * sc;
    let dx = outW / 2 - x * w, dy = outH * at - y * h;
    if (!free) { dx = Math.min(0, Math.max(outW - w, dx)); dy = Math.min(0, Math.max(outH - h, dy)); }
    if (free) {
      const t = document.createElement('canvas');
      t.width = img.width; t.height = Math.max(1, Math.round(img.height * 0.04));
      const tg = t.getContext('2d');
      tg.drawImage(img, 0, 0);
      g.fillStyle = `rgb(${median(tg, 0, 0, t.width, t.height)})`;
      g.fillRect(0, 0, outW, outH);
    }
    g.drawImage(img, dx, dy, w, h);
    bg = median(g, 0, outH * 0.2, outW, outH * 0.12);
  }
  const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
  const hex = '#' + bg.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { data: c.toDataURL('image/webp', 0.88), bg: hex, ink: lum > 0.62 ? 'dark' : 'light' };
}

async function resizeInPage(src, maxW) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const s = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', 0.86);
}

function inkFor(hex) {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? 'dark' : 'light';
}

function waitForInPage(sel, ms) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    (function poll() {
      if (document.querySelector(sel)) return resolve(true);
      if (performance.now() - t0 > ms) return resolve(false);
      setTimeout(poll, 100);
    })();
  });
}

export const trimRect = ([x, y, w, h], t) => (t ? [x + w * t[0], y + h * t[1], w * (1 - t[0] - t[2]), h * (1 - t[1] - t[3])].map(Math.round) : [x, y, w, h]);

// ── One piece ───────────────────────────────────────────
async function makeOne(page, base, item, cfg = {}) {
  const url = base + item.url;
  const pc = cfg.poster || {};
  const viewport = cfg.viewport || [1280, 800];
  const wait = pc.wait ?? 3000;

  // 1. the opened view: the whole page, or just the "show" element
  await page.goto(url, viewport);
  if (cfg.ready && !(await page.eval(waitForInPage, cfg.ready, 20000))) throw new Error(`"${cfg.ready}" never appeared`);
  await sleep(wait);
  const meta = { viewport };
  let still;
  if (cfg.show) {
    const iso = await page.eval(isolateInPage, cfg.show, SHOW_PAD);
    if (iso.error) throw new Error(iso.error);
    await sleep(250);
    const rect = trimRect(iso.rect, cfg.trim);
    const [x, y, w, h] = rect;
    still = await page.shot({ x, y, width: w, height: h });
    Object.assign(meta, { show: cfg.show, rect, pageBg: iso.bg });
  } else {
    still = await page.shot();
  }

  // 2. the poster
  let poster;
  if (pc.image) {
    const file = path.resolve(ROOT, pc.image);
    const type = path.extname(file).slice(1).replace('jpg', 'jpeg');
    poster = await page.eval(composeInPage, `data:image/${type};base64,${fs.readFileSync(file).toString('base64')}`,
      'scene', { outW: POSTER.w, outH: POSTER.h, x: pc.x, y: pc.y, zoom: pc.zoom });
  } else if (cfg.show) {
    poster = await page.eval(composeInPage, still, pc.fill ? 'scene' : 'object',
      { outW: POSTER.w, outH: POSTER.h, x: pc.x, y: pc.y, zoom: pc.zoom, at: pc.at });
  } else {
    if (pc.hide?.length || pc.viewport || pc.scroll) {
      await page.goto(url, pc.viewport || viewport);
      if (cfg.ready) await page.eval(waitForInPage, cfg.ready, 20000);
      await sleep(Math.min(wait, 1500));
      if (pc.scroll) await page.eval((y) => window.scrollTo(0, y), pc.scroll);
      if (pc.hide?.length) await page.eval(hideInPage, pc.hide);
      await sleep(wait);
    }
    const scene = await page.shot();
    poster = await page.eval(composeInPage, scene, 'scene',
      { outW: POSTER.w, outH: POSTER.h, x: pc.x, y: pc.y, zoom: pc.zoom, at: pc.at });
  }
  meta.bg = pc.bg || poster.bg;
  meta.ink = pc.bg ? inkFor(pc.bg) : poster.ink;
  meta.kind = cfg.show && !pc.fill && !pc.image ? 'object' : 'scene';

  const stillWebp = await page.eval(resizeInPage, still, STILL_W);
  const write = (name, dataUrl) => fs.writeFileSync(path.join(THUMBS_DIR, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
  write(`${item.slug}.webp`, poster.data);
  write(`${item.slug}-stage.webp`, stillWebp);
  fs.writeFileSync(path.join(THUMBS_DIR, `${item.slug}.json`), JSON.stringify(meta, null, 2) + '\n');
  for (const ext of ['.png', '.jpg', '.jpeg', '.avif']) fs.rmSync(path.join(THUMBS_DIR, item.slug + ext), { force: true });
}

export async function makePosters(slugs = [], { all = false } = {}) {
  const browserPath = findBrowser();
  if (!browserPath) throw new Error('No Chrome or Edge found. Set CHROME_PATH to one.');
  const { items } = await sync({ quiet: true });
  const content = readContent();
  const targets = all ? items
    : slugs.length ? items.filter((i) => slugs.includes(i.slug))
    : items.filter((i) => !fs.existsSync(path.join(THUMBS_DIR, `${i.slug}.json`)));
  if (!targets.length) { console.log('Every piece already has artwork.'); return 0; }

  const server = createServer({ quiet: true }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const page = await launch(browserPath);
  let failed = 0;
  try {
    for (const item of targets) {
      process.stdout.write(`… ${item.slug} `);
      try { await makeOne(page, base, item, content[item.slug]); console.log('✓'); }
      catch (err) { failed++; console.log(`✗ ${err.message}`); }
    }
  } finally {
    await page.close();
    server.close();
  }
  await sync();
  return failed;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    const failed = await makePosters(args.filter((a) => !a.startsWith('--')), { all: args.includes('--all') });
    process.exit(failed ? 1 : 0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
