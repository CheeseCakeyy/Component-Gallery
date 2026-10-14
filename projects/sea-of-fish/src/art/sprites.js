import { rng } from '../util.js';

// Two hand-made looks, pre-rendered into sprite atlases:
//  - "ink": side-on marker fish with fine-liner outlines (the sea-hill drawing)
//  - "wc":  top-down watercolour fish with soft, pooled edges (the underwater swirl)
// Each variant has five tail poses so the school can wag without per-frame path work.
// Every variant and pose of one look lives in a single atlas, rendered at the pixel size
// it will be shown at: one texture, no per-draw uploads, no heavy downscaling.

import { theme } from '../theme.js';

// Fish keep their own fineliner ink and cream in both themes; only the watercolours change.
export const INK = '#1d2838';
export const PAPER = '#fbf8f1';
export const BASE = 40; // ink fish length in sprite units
export const WC_BASE = 80; // watercolour fish length in sprite units
const TAIL = [-0.34, -0.17, 0, 0.17, 0.34];

// ---------------------------------------------------------------- view / drawing

// A shared 2D camera: scene coords -> CSS px is (p * s + offset). Scenes set it each frame.
export const view = { s: 1, x: 0, y: 0, dpr: 1 };

export function applyView(ctx) {
  const k = view.s * view.dpr;
  ctx.setTransform(k, 0, 0, k, view.x * view.dpr, view.y * view.dpr);
}

export function drawSprite(ctx, spr, x, y, angle, scale, flip) {
  const k = (scale * view.s * view.dpr) / spr.res;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // Side-on fish swimming left get mirrored instead of turned belly-up.
  const f = flip && c < 0 ? -1 : 1;
  ctx.setTransform(c * k, s * k, -s * k * f, c * k * f, (x * view.s + view.x) * view.dpr, (y * view.s + view.y) * view.dpr);
  ctx.drawImage(spr.atlas.img, spr.sx, spr.sy, spr.sw, spr.sh, -spr.ax, -spr.ay, spr.sw, spr.sh);
}

export const tailFrame = (t, freq, phase) => Math.round((Math.sin(t * freq + phase) + 1) * 2);

// ---------------------------------------------------------------- palettes

export const INK_COLORS = [
  { c: '#45b0a5', w: 15 }, // teal
  { c: '#6cc4b0', w: 11 }, // seafoam
  { c: '#2f9a95', w: 11 }, // jade
  { c: '#4a8fd0', w: 11 }, // sky
  { c: '#2f6cb8', w: 13 }, // cobalt
  { c: '#2a55a0', w: 10 }, // royal
  { c: '#253f7c', w: 9 }, // navy
  { c: '#3a7fae', w: 8 }, // denim
  { c: '#b5c95a', w: 0.9 }, // the odd lime one
  { c: '#cf4a3f', w: 0.25 }, // and one red
  { c: PAPER, w: 1.1, white: true }, // outline-only
];

const INK_SHAPES = [
  { h: 0.46, tail: 0.22, kind: 'fork', gill: true, w: 5 },
  { h: 0.56, tail: 0.2, kind: 'fan', gill: false, w: 2.5 },
  { h: 0.36, tail: 0.25, kind: 'fork', gill: true, w: 2.5 },
];

export const WC_COLORS = [
  { c: '#a6d6f1', deep: '#6aaedd', w: 4 },
  { c: '#7cc0ea', deep: '#4596d2', w: 5 },
  { c: '#4c9fdc', deep: '#2a70b8', w: 4.5 },
  { c: '#2f7cc4', deep: '#1c5190', w: 2.6 },
  { c: '#245a9e', deep: '#163a70', w: 1.1 },
];

// The deep at night: saturated, denser washes. Pale translucent colours turn grey over
// dark water, so these keep their chroma and are laid on thicker (`wash`) to glow.
// Same order and weights as WC_COLORS, so a fish keeps its place in the palette.
const WC_NIGHT = [
  { c: '#8fdcff', deep: '#4fb6ee', w: 4, wash: 0.92 },
  { c: '#5cc4fa', deep: '#2f9be6', w: 5, wash: 0.92 },
  { c: '#38a8f0', deep: '#1f7fd0', w: 4.5, wash: 0.9 },
  { c: '#2d8be0', deep: '#1a62b4', w: 2.6, wash: 0.9 },
  { c: '#2f6fd0', deep: '#1c4c9c', w: 1.1, wash: 0.88 },
];

const WC_SHAPES = [
  { w: 0.19, tail: 0.24 },
  { w: 0.23, tail: 0.22 },
];

export function pickInk(r) {
  return r.weighted(INK_COLORS) * INK_SHAPES.length + r.weighted(INK_SHAPES);
}

export function pickWc(r) {
  const ci = r.weighted(WC_COLORS);
  return { idx: ci * WC_SHAPES.length + Math.floor(r() * WC_SHAPES.length), tone: ci };
}

// ---------------------------------------------------------------- helpers

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

// ---------------------------------------------------------------- ink fish

function inkBody(ctx, L, H, shape) {
  const nx = L * 0.5;
  const tb = -L * 0.5 + L * shape.tail;
  const hh = H * 0.5;
  ctx.beginPath();
  ctx.moveTo(nx, 0);
  ctx.bezierCurveTo(nx - L * 0.06, -hh * 0.98, tb + L * 0.3, -hh * 1.08, tb, -hh * 0.2);
  ctx.lineTo(tb, hh * 0.2);
  ctx.bezierCurveTo(tb + L * 0.3, hh * 1.0, nx - L * 0.06, hh * 0.9, nx, 0);
  ctx.closePath();
}

function inkTail(ctx, L, H, shape) {
  const tl = L * shape.tail + L * 0.03;
  const hh = H * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -hh * 0.22);
  if (shape.kind === 'fork') {
    ctx.quadraticCurveTo(-tl * 0.55, -hh * 0.4, -tl, -hh * 0.95);
    ctx.quadraticCurveTo(-tl * 0.78, -hh * 0.3, -tl * 0.62, 0);
    ctx.quadraticCurveTo(-tl * 0.78, hh * 0.3, -tl, hh * 0.95);
    ctx.quadraticCurveTo(-tl * 0.55, hh * 0.4, 0, hh * 0.22);
  } else {
    ctx.quadraticCurveTo(-tl * 0.6, -hh * 0.5, -tl, -hh * 0.85);
    ctx.quadraticCurveTo(-tl * 0.84, 0, -tl, hh * 0.85);
    ctx.quadraticCurveTo(-tl * 0.6, hh * 0.5, 0, hh * 0.22);
  }
  ctx.closePath();
}

function buildInk(col, shape, tailAngle, seed, RES) {
  const L = BASE;
  const H = L * shape.h;
  const pad = 3;
  const wl = L + pad * 2;
  const hl = H * 1.3 + pad * 2;
  const cv = makeCanvas(wl * RES, hl * RES);
  const ctx = cv.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(wl / 2, hl / 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const fill = col.c;
  const line = col.white ? INK : mix(col.c, INK, 0.78);
  const tb = -L * 0.5 + L * shape.tail;

  ctx.save();
  ctx.translate(tb + L * 0.03, 0);
  ctx.rotate(tailAngle);
  inkTail(ctx, L, H, shape);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  inkBody(ctx, L, H, shape);
  ctx.fillStyle = fill;
  ctx.fill();

  // Marker streaks: a few translucent nose-to-tail passes, like felt-tip colouring.
  if (!col.white) {
    const r = rng(seed);
    ctx.save();
    inkBody(ctx, L, H, shape);
    ctx.clip();
    for (let i = 0; i < 7; i++) {
      const y0 = r.range(-H * 0.5, H * 0.5);
      ctx.strokeStyle = r() < 0.55 ? 'rgba(255,255,255,0.16)' : 'rgba(12,28,60,0.13)';
      ctx.lineWidth = H * r.range(0.1, 0.22);
      ctx.beginPath();
      ctx.moveTo(tb - 2, y0 + r.range(-2, 2));
      ctx.quadraticCurveTo(0, y0 + r.range(-3, 3), L * 0.55, y0 * 0.4 + r.range(-2, 2));
      ctx.stroke();
    }
    ctx.restore();
  }

  inkBody(ctx, L, H, shape);
  ctx.strokeStyle = line;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  if (shape.gill) {
    const gx = L * 0.5 - L * 0.27;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(gx + 1, -H * 0.27);
    ctx.quadraticCurveTo(gx - 1.6, 0, gx + 1, H * 0.27);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const ex = L * 0.5 - L * 0.13;
  const ey = -H * 0.1;
  if (col.white) {
    ctx.beginPath();
    ctx.arc(ex, ey, H * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(ex, ey, Math.max(0.9, H * 0.065), 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();

  return { canvas: cv, ax: (wl / 2) * RES, ay: (hl / 2) * RES, res: RES };
}

// ---------------------------------------------------------------- watercolour fish

function wcBody(ctx, L, W) {
  const nx = L * 0.5;
  const tb = -L * 0.5 + L * 0.22;
  const hw = W * 0.5;
  ctx.beginPath();
  ctx.moveTo(nx, 0);
  ctx.bezierCurveTo(nx, -hw * 0.95, nx - L * 0.18, -hw * 1.1, nx - L * 0.36, -hw * 0.95);
  ctx.bezierCurveTo(nx - L * 0.58, -hw * 0.7, tb + L * 0.08, -hw * 0.28, tb, -hw * 0.14);
  ctx.lineTo(tb, hw * 0.14);
  ctx.bezierCurveTo(tb + L * 0.08, hw * 0.28, nx - L * 0.58, hw * 0.7, nx - L * 0.36, hw * 0.95);
  ctx.bezierCurveTo(nx - L * 0.18, hw * 1.1, nx, hw * 0.95, nx, 0);
  ctx.closePath();
}

function wcFin(ctx, L, W, sgn, flap) {
  const hw = W * 0.5;
  const fx = L * 0.5 - L * 0.27;
  ctx.beginPath();
  ctx.moveTo(fx, sgn * hw * 0.7);
  ctx.quadraticCurveTo(fx - L * 0.05, sgn * hw * (2.3 + flap), fx - L * 0.2, sgn * hw * (2.0 + flap));
  ctx.quadraticCurveTo(fx - L * 0.12, sgn * hw * 1.2, fx - L * 0.11, sgn * hw * 0.75);
  ctx.closePath();
}

function wcTail(ctx, L, W, shape) {
  const tl = L * shape.tail + 2;
  const hw = W * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -hw * 0.18);
  ctx.quadraticCurveTo(-tl * 0.5, -hw * 0.5, -tl, -hw * 1.4);
  ctx.quadraticCurveTo(-tl * 0.74, -hw * 0.3, -tl * 0.6, 0);
  ctx.quadraticCurveTo(-tl * 0.74, hw * 0.3, -tl, hw * 1.4);
  ctx.quadraticCurveTo(-tl * 0.5, hw * 0.5, 0, hw * 0.18);
  ctx.closePath();
}

function buildWater(col, shape, tailAngle, seed, RESW) {
  const L = WC_BASE;
  const W = L * shape.w;
  const pad = 8;
  const wl = L + pad * 2;
  const hl = W * 2.8 + pad * 2;
  const tb = -L * 0.5 + L * 0.22;
  const r = rng(seed);
  const blurK = RESW / 3; // blur radii were tuned at 3 px per unit

  const setup = (cv) => {
    const c = cv.getContext('2d');
    c.scale(RESW, RESW);
    c.translate(wl / 2, hl / 2);
    return c;
  };
  const silhouette = (c) => {
    c.save();
    c.translate(tb + 1, 0);
    c.rotate(tailAngle);
    wcTail(c, L, W, shape);
    c.fill();
    c.restore();
    wcFin(c, L, W, -1, tailAngle * 0.8);
    c.fill();
    wcFin(c, L, W, 1, -tailAngle * 0.8);
    c.fill();
    wcBody(c, L, W);
    c.fill();
  };

  // Opaque silhouette first, then laid down as one translucent wash so parts don't double up.
  const shapeCv = makeCanvas(wl * RESW, hl * RESW);
  const sc = setup(shapeCv);
  sc.fillStyle = col.c;
  silhouette(sc);

  const cv = makeCanvas(wl * RESW, hl * RESW);
  const ctx = cv.getContext('2d');
  ctx.filter = `blur(${1.4 * blurK}px)`;
  ctx.globalAlpha = col.wash ?? 0.7;
  ctx.drawImage(shapeCv, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  const c2 = setup(cv);
  c2.globalCompositeOperation = 'source-atop';

  // Pigment pooled along the spine and the edges.
  c2.filter = `blur(${3 * blurK}px)`;
  c2.strokeStyle = col.deep;
  c2.globalAlpha = 0.4;
  c2.lineWidth = W * 0.45;
  c2.lineCap = 'round';
  c2.beginPath();
  c2.moveTo(L * 0.4, 0);
  c2.quadraticCurveTo(0, r.range(-1, 1), tb - 4, 0);
  c2.stroke();

  c2.filter = `blur(${1 * blurK}px)`;
  c2.globalAlpha = 0.5;
  c2.lineWidth = 1.3;
  wcBody(c2, L, W);
  c2.stroke();

  // A few blooms and granulation blots.
  c2.filter = `blur(${2 * blurK}px)`;
  for (let i = 0; i < 6; i++) {
    c2.globalAlpha = r.range(0.08, 0.2);
    c2.fillStyle = r() < 0.6 ? col.deep : '#ffffff';
    c2.beginPath();
    c2.arc(r.range(-L * 0.4, L * 0.4), r.range(-W * 0.5, W * 0.5), r.range(2, W * 0.4), 0, Math.PI * 2);
    c2.fill();
  }

  // Eyes: two dark specks near the head.
  c2.filter = `blur(${0.4 * blurK}px)`;
  c2.globalAlpha = 0.55;
  c2.fillStyle = col.deep;
  for (const s of [-1, 1]) {
    c2.beginPath();
    c2.arc(L * 0.5 - L * 0.1, s * W * 0.32, 1.1, 0, Math.PI * 2);
    c2.fill();
  }

  return { canvas: cv, ax: (wl / 2) * RESW, ay: (hl / 2) * RESW, res: RESW };
}

// ---------------------------------------------------------------- atlases

function makeAtlas(tiles, res) {
  const cw = Math.max(...tiles.flat().map((t) => t.canvas.width)) + 2;
  const ch = Math.max(...tiles.flat().map((t) => t.canvas.height)) + 2;
  const cv = makeCanvas(cw * TAIL.length, ch * tiles.length);
  const ctx = cv.getContext('2d');
  const atlas = { img: cv, canvas: cv };
  const frames = tiles.map((row, vi) =>
    row.map((tile, fi) => {
      const sx = fi * cw + 1;
      const sy = vi * ch + 1;
      ctx.drawImage(tile.canvas, sx, sy);
      return { atlas, sx, sy, sw: tile.canvas.width, sh: tile.canvas.height, ax: tile.ax, ay: tile.ay, res };
    }),
  );
  // An ImageBitmap stays resident on the GPU; keep drawing from the canvas until it's ready.
  if (typeof createImageBitmap === 'function') {
    createImageBitmap(cv)
      .then((b) => (atlas.img = b))
      .catch(() => {});
  }
  return frames;
}

// Returns a factory: ink(px) / wc(px) give frames[variant][pose] sized so a fish
// `px` device pixels long is drawn at ~1:1. Results are cached per size bucket.
export function buildSprites() {
  const cache = new Map();
  const get = (key, px, base, build) => {
    const res = Math.max(0.5, Math.ceil((px / base) * 4) / 4);
    const k = `${key}:${res}`;
    if (!cache.has(k)) cache.set(k, makeAtlas(build(res), res));
    return cache.get(k);
  };
  return {
    ink: (px) =>
      get('ink', px, BASE, (res) =>
        INK_COLORS.flatMap((col, ci) =>
          INK_SHAPES.map((shape, si) => TAIL.map((a) => buildInk(col, shape, a, ci * 31 + si * 7 + 1, res))),
        ),
      ),
    wc: (px) =>
      get(`wc-${theme.wc}`, px, WC_BASE, (res) =>
        (theme.wc === 'night' ? WC_NIGHT : WC_COLORS).flatMap((col, ci) =>
          WC_SHAPES.map((shape, si) => TAIL.map((a) => buildWater(col, shape, a * 1.2, ci * 17 + si * 5 + 3, res))),
        ),
      ),
  };
}
