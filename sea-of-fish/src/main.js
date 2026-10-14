// Latin subsets only: all the copy is Latin (dashes and curly quotes included).
import '@fontsource/amatic-sc/latin-700.css';
import '@fontsource/caveat/latin-400.css';
import './style.css';

import { clamp, easeInOutCubic, smoothstep } from './util.js';
import { buildSprites, view } from './art/sprites.js';
import { applyTheme, hasSavedTheme, initialTheme, saveTheme, theme } from './theme.js';
import { Bubbles } from './art/bubbles.js';
import { BOAT_ANGLE, DomeScene } from './scenes/dome.js';
import { ArcCopy } from './arcCopy.js';
import { WipeScene } from './scenes/wipe.js';
import { HorizonScene } from './scenes/horizon.js';
import { VortexScene } from './scenes/vortex.js';
import { FishLayer } from './gl/FishLayer.js';

// Scroll progress (0..1) is the single timeline:
//   page 1 · fish wipe · page 2 · dive · page 3
// How much scrolling each part takes, in viewport heights (vh). Raise a number to make
// that part play out more slowly; everything else (copy fades, page dots) follows.
const SECTIONS = {
  hill: 126, // page 1
  wipe: 460, // the school pouring in and out (page 1 -> 2)
  boat: 144, // page 2
  dive: 189, // sinking under the fish (page 2 -> 3)
  deep: 153, // page 3
};
const SCROLL = Object.values(SECTIONS).reduce((a, b) => a + b, 0);
const vh = (n) => n / SCROLL; // a scroll distance in vh, as a share of the whole page
const P = {
  wipeA: vh(SECTIONS.hill),
  wipeB: vh(SECTIONS.hill + SECTIONS.wipe),
  diveA: vh(SECTIONS.hill + SECTIONS.wipe + SECTIONS.boat),
  diveB: vh(SECTIONS.hill + SECTIONS.wipe + SECTIONS.boat + SECTIONS.dive),
};
document.querySelector('.track').style.height = `${SCROLL + 100}vh`;

// Three stacked canvases: 2D line art (sky, moon, boat) at the back, every fish in one
// WebGL layer above it, and a thin 2D layer on top for splashes, bubbles and the page-1 boat.
applyTheme(initialTheme()); // before any layout: the deep's watercolour atlas depends on it

const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d', { alpha: false });
const fxCanvas = document.getElementById('fx');
const fx = fxCanvas.getContext('2d');
const layer = new FishLayer(document.getElementById('fish'), ctx);
const sprites = buildSprites();
const dome = new DomeScene(sprites);
const wipe = new WipeScene(sprites);
const horizon = new HorizonScene(sprites);
horizon.useStrips = !layer.gl;
const vortex = new VortexScene(sprites);
const bubbles = new Bubbles();
const arcCopy = new ArcCopy(document.querySelector('.copy--arc'));

const input = { x: -1e4, y: -1e4, active: false, speed: 0 };
let W = 0;
let H = 0;

function resize() {
  // A hidden or not-yet-laid-out window can report 0x0; geometry divides by these.
  W = Math.max(1, window.innerWidth);
  H = Math.max(1, window.innerHeight);
  // The 2D fallback is fill-bound on hi-dpi screens, so it renders a little softer.
  view.dpr = Math.min(window.devicePixelRatio || 1, layer.gl ? 2 : 1.5);
  canvas.width = fxCanvas.width = Math.round(W * view.dpr);
  canvas.height = fxCanvas.height = Math.round(H * view.dpr);
  layer.resize(canvas.width, canvas.height);
  dome.layout(W, H);
  wipe.layout(W, H);
  horizon.layout(W, H);
  vortex.layout(W, H);
  arcCopy.layout(W, H, dome, BOAT_ANGLE);
  document.querySelector('.copy--one').classList.toggle('is-curved', arcCopy.curved);
}

// ---------------------------------------------------------------- paper grain

(function paperGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const g = c.getContext('2d');
  const img = g.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 236 + Math.random() * 19;
    img.data[i] = v;
    img.data[i + 1] = v - 2;
    img.data[i + 2] = v - 6;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.querySelector('.paper').style.backgroundImage = `url(${c.toDataURL()})`;
})();

// ---------------------------------------------------------------- scroll

let target = 0;
let prog = 0;
let lastTarget = 0;
let scrollVel = 0;

const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
const readScroll = () => (target = clamp(window.scrollY / maxScroll()));
window.addEventListener('scroll', readScroll, { passive: true });

const dots = [...document.querySelectorAll('.dots button')];
dots[1].dataset.to = String((P.wipeB + P.diveA) / 2); // middle of page 2
for (const d of dots) {
  d.addEventListener('click', () => window.scrollTo({ top: Number(d.dataset.to) * maxScroll(), behavior: 'smooth' }));
}

// ---------------------------------------------------------------- pointer

let lastMove = 0;
window.addEventListener('pointermove', (e) => {
  const now = performance.now();
  const dtm = Math.max(8, now - lastMove);
  if (input.active) {
    const v = (Math.hypot(e.clientX - input.x, e.clientY - input.y) / dtm) * 1000;
    input.speed = Math.max(input.speed, Math.min(v, 4000));
  }
  lastMove = now;
  input.x = e.clientX;
  input.y = e.clientY;
  input.active = true;
});
document.documentElement.addEventListener('pointerleave', () => (input.active = false));
window.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') input.active = false;
});
window.addEventListener('blur', () => (input.active = false));

let activeScene = dome;
let cursorOnMoon = false;
let clock = 0;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, a')) return;
  input.x = e.clientX;
  input.y = e.clientY;
  input.active = true;
  if (!activeScene) return;
  // Easter egg: the moon on pages one and two flips day and night.
  if (activeScene.click(e.clientX, e.clientY, clock) === 'moon') toggleTheme();
  if (activeScene === vortex) bubbles.spawn(e.clientX, e.clientY, 10, 16);
});

// ---------------------------------------------------------------- theme

const themeBtn = document.querySelector('.theme-toggle');
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function syncThemeButton() {
  const dark = theme.name === 'dark';
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

function switchTheme(name) {
  if (name === theme.name) return;
  // Cross-fade: a sheet of the old paper colour over everything, fading away to reveal the new look.
  if (!reduceMotion?.matches) {
    const veil = document.createElement('div');
    veil.className = 'theme-veil';
    veil.style.background = theme.paper;
    document.body.append(veil);
    veil.addEventListener('animationend', () => veil.remove());
    setTimeout(() => veil.remove(), 1000); // in case animations are paused (e.g. a background tab)
  }
  applyTheme(name);
  vortex.refreshTheme();
  syncThemeButton();
}

function toggleTheme() {
  const next = theme.name === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  switchTheme(next);
}

themeBtn.addEventListener('click', toggleTheme);
// Follow the system setting until someone picks a theme themselves.
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
  if (!hasSavedTheme()) switchTheme(e.matches ? 'dark' : 'light');
});
syncThemeButton();

// ---------------------------------------------------------------- copy

const copy = {
  one: document.querySelector('.copy--one'),
  arc: document.querySelector('.copy--arc'),
  two: document.querySelector('.copy--two'),
  three: document.querySelector('.copy--three'),
  quote: document.querySelector('.copy--quote'),
  foot: document.querySelector('.copy--foot'),
};
const hint = document.querySelector('.hint');

function setCopy(el, v) {
  el.style.setProperty('--v', v.toFixed(3));
  el.style.visibility = v < 0.01 ? 'hidden' : 'visible';
}

function updateCopy(p) {
  const vOne = 1 - smoothstep(P.wipeA * 0.36, P.wipeA * 0.93, p);
  setCopy(copy.one, arcCopy.curved ? 0 : vOne);
  setCopy(copy.arc, arcCopy.curved ? vOne : 0);
  setCopy(copy.two, smoothstep(P.wipeB, P.wipeB + vh(45), p) * (1 - smoothstep(P.diveA - vh(36), P.diveA + vh(9), p)));
  setCopy(copy.three, smoothstep(P.diveB - vh(36), P.diveB + vh(45), p));
  setCopy(copy.quote, smoothstep(P.diveB + vh(9), P.diveB + vh(90), p));
  setCopy(copy.foot, smoothstep(P.diveB + vh(45), P.diveB + vh(117), p));
  hint.style.opacity = String(1 - smoothstep(vh(4), vh(36), p));
  const page = p < (P.wipeA + P.wipeB) / 2 ? 0 : p < (P.diveA + P.diveB) / 2 ? 1 : 2;
  dots.forEach((d, i) => d.classList.toggle('is-active', i === page));
}

// ---------------------------------------------------------------- frame

let last = performance.now();

function render(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  const t = clock;

  prog += (target - prog) * (1 - Math.exp(-dt * 4));
  if (Math.abs(target - prog) < 1e-5) prog = target;
  const v = (target - lastTarget) / Math.max(dt, 1e-3);
  lastTarget = target;
  scrollVel += (v - scrollVel) * Math.min(1, dt * 6);
  input.speed *= Math.exp(-dt * 5);

  const p = prog;
  const tw = clamp((p - P.wipeA) / (P.wipeB - P.wipeA));
  const td = clamp((p - P.diveA) / (P.diveB - P.diveA));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  fx.setTransform(1, 0, 0, 1, 0, 0);
  fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  layer.begin();

  activeScene = null;
  if (wipe.covers(tw)) {
    // The school hides the whole screen: nothing underneath needs drawing.
  } else if (tw < 0.5) {
    dome.draw(ctx, layer, tw > 0 ? ctx : fx, t, dt, input, smoothstep(0, P.wipeA + vh(108), p) * 0.1);
    arcCopy.follow(view);
    if (tw < 0.3) activeScene = dome;
  } else if (td < 1) {
    horizon.draw(ctx, layer, fx, t, dt, input, easeInOutCubic(td) * H * 1.3, td);
    if (tw > 0.75 && td < 0.5) activeScene = horizon;
  }

  // Bubbles stream up through the dive, and trail the pointer down in the deep.
  const hump = Math.sin(td * Math.PI);
  if (hump > 0.05 && Math.random() < hump * dt * 40) bubbles.spawn(Math.random() * W, H + 10, 1, 4);
  if (td >= 1 && input.active && input.speed > 300 && Math.random() < dt * 12) bubbles.spawn(input.x, input.y, 1, 4);
  bubbles.update(dt, t);

  if (td > 0.3) {
    vortex.draw(layer, t, dt, input, smoothstep(0.3, 1, td), scrollVel);
    if (td > 0.6) activeScene = vortex;
  }
  bubbles.draw(fx, view.dpr);

  if (tw > 0 && tw < 1) wipe.draw(layer, t, tw);
  layer.end();

  updateCopy(p);

  // A pointer cursor over the moon is the only hint that it can be clicked.
  const overMoon = !!(activeScene && activeScene.moon && activeScene.moon.hovered);
  if (overMoon !== cursorOnMoon) {
    cursorOnMoon = overMoon;
    document.body.style.cursor = overMoon ? 'pointer' : '';
  }
}

function frame(now) {
  render(now);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  resize();
  readScroll();
});
resize();
readScroll();
prog = target;
requestAnimationFrame(frame);
