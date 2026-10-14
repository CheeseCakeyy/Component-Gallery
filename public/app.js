// The wall. Reads manifest.json (built by scripts/sync.mjs from public/components/ +
// components.json) and hangs one card per component. Nothing about any component is
// hard-coded here: add a folder, and the wall grows a slot.

const $ = (sel) => document.querySelector(sel);
const root = document.documentElement;
const room = $('#room');
const track = $('#track');
const panel = $('#panel');
const stage = $('#stage');
const stagePoster = $('#stage-poster');
const stageStill = $('#stage-still');
const viewer = $('#viewer');
let viewerFrame = $('#viewer-frame');
const viewerLoading = $('#viewer-loading');
const indexPanel = $('#index-panel');

const NEW_FOR_DAYS = 21;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const OPEN_MS = reduceMotion ? 1 : 720;
const CLOSE_MS = reduceMotion ? 1 : 540;
const SHOW_PAD = 0.06; // must match scripts/posters.mjs, so the live view lines up with the still

// ── Data ────────────────────────────────────────────────
let items = [];
try {
  const res = await fetch('manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(res.status);
  items = (await res.json()).items;
} catch (err) {
  console.error('Could not load manifest.json', err);
}

// Numbers follow the order things were made, so a new piece gets the next number and
// older ones keep theirs. The wall itself starts with the newest.
const chronological = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
const numberOf = new Map(chronological.map((item, i) => [item.slug, i + 1]));
const pad = (n) => String(n).padStart(2, '0');
const hue = (slug) => [...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const fmtDate = (d, opts) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', opts);
const isNew = (item) => item === items[0] && item.date
  && (Date.now() - new Date(item.date + 'T00:00:00')) / 864e5 <= NEW_FOR_DAYS;

{
  const now = new Date();
  $('#today').textContent = `${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.getDate()} ${now.toLocaleDateString('en-GB', { month: 'short' }).toLowerCase()}`;
  $('#pieces').textContent = `${items.length} piece${items.length === 1 ? '' : 's'}, on the wall`;
}

// ── Geometry ────────────────────────────────────────────
// Proportions are taken from the reference: cards are 40% of the room's height,
// hung at 17.7%, one card-and-a-bit apart; the desk spans ~84 units wide.
let G = {};
function measure() {
  const W = innerWidth, H = innerHeight;
  const portrait = W / H < 0.9;
  let cw, ch, gap, top, deskW, edge, left0;
  if (!portrait) {
    const u = Math.min(H / 100, W * 0.0074);
    ch = 40 * u; cw = ch * 0.737; gap = 10.4 * u;
    top = 17.7 * u + (H - 100 * u) * 0.3;
    deskW = 83.7 * u;
    edge = Math.max(20, W * 0.056);
    left0 = edge;
  } else {
    cw = Math.min(W * 0.64, H * 0.34); ch = cw / 0.737; gap = W * 0.075;
    top = Math.max(70, H * 0.11);
    deskW = Math.min(W * 1.02, H * 0.56);
    edge = 18;
    left0 = (W - cw) / 2;
  }
  G = { W, H, portrait, cw, ch, gap, top, deskW, edge, left0, p: cw + gap };
  for (const [k, v] of Object.entries({ cw, ch, gap, top, 'desk-w': deskW, edge })) root.style.setProperty(`--${k}`, `${v}px`);
}

// Where the open panel goes, and how far the neighbours must step aside. A piece that only
// shows one element ("show" in components.json) gets a stage shaped like that element.
const stageAspect = (item) => (item.show && item.stage?.rect ? item.stage.rect[2] / item.stage.rect[3] : 1.6);

function panelGeometry(item) {
  const { W, H, portrait, cw, ch, gap, top } = G;
  const aspect = stageAspect(item);
  if (portrait) {
    const sw = Math.min(W - 2 * G.edge, H * 0.42 * aspect), sh = sw / aspect;
    const stageTop = top + ch * 0.2;
    return {
      stage: { left: (W - sw) / 2, top: stageTop, width: sw, height: sh },
      title: { left: G.edge, right: 'auto', bottom: H - stageTop + 6 },
      side: { left: G.edge, top: stageTop + sh + 16, width: W - 2 * G.edge },
      dL: -W * 0.75, dR: W * 0.75,
    };
  }
  const sw = Math.min(cw * 2.2, W * 0.52, ch * 1.04 * aspect), sh = sw / aspect;
  const lw = cw * 0.92, inner = cw * 0.16;
  const pw = lw + inner + sw;
  const panelLeft = W / 2 - pw / 2 - cw * 0.1;
  const stageLeft = panelLeft + lw + inner;
  const stageTop = Math.min(top + (ch - sh) / 2 + ch * 0.07, top + ch * 1.05 - sh);
  const panelRight = stageLeft + sw;
  return {
    stage: { left: stageLeft, top: stageTop, width: sw, height: sh },
    title: { left: 'auto', right: W - panelRight - sw * 0.02, bottom: H - stageTop + 2 },
    side: { left: panelLeft, top: top + ch * 0.1, width: lw },
    dL: (panelLeft - gap * 0.85 - cw) - (W / 2 - cw / 2 - G.p),
    dR: (panelRight + gap * 0.85) - (W / 2 + cw / 2 + gap),
  };
}

// ── Cards ───────────────────────────────────────────────
// The row loops forever. If there aren't enough pieces to fill the room plus a card on
// each side, the list is repeated (copies are hidden from assistive tech and tabbing).
let slots = [];   // [{ item, el, copy }]
let L = 1;        // length of the whole loop in px

function buildTrack() {
  const n = items.length;
  if (!n) { track.replaceChildren(); slots = []; return; }
  const reps = Math.max(1, Math.ceil((G.W + 3 * G.p) / (n * G.p)));
  if (slots.length === n * reps) return false;
  slots = [];
  const frag = document.createDocumentFragment();
  for (let r = 0; r < reps; r++) {
    items.forEach((item) => {
      const el = makeCard(item, r > 0);
      slots.push({ item, el, copy: r > 0 });
      frag.append(el);
    });
  }
  track.replaceChildren(frag);
  slots.forEach((s, i) => { s.el.dataset.v = i; });
  return true;
}

function makeCard(item, copy) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'card';
  if (copy) { el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); }
  el.setAttribute('aria-label', `${item.title}${item.subtitle ? ', ' + item.subtitle : ''}. Open on the wall`);
  el.style.setProperty('--h', hue(item.slug));
  // the card is printed in the poster's own colour, so the picture has no visible edge
  if (item.poster?.bg) el.style.setProperty('--poster-bg', item.poster.bg);
  el.dataset.ink = item.poster?.ink || 'auto';
  el.dataset.kind = item.poster?.kind || 'scene';
  el.innerHTML = `
    <span class="card-inner">
      ${item.thumb ? `<img alt="" draggable="false" decoding="async">` : ''}
      <span class="card-text"><span class="card-title"></span><span class="card-sub"></span></span>
      <span class="orb"></span>
      <span class="card-num"></span>
      ${isNew(item) ? '<span class="new-dot">New</span>' : ''}
    </span>`;
  const img = el.querySelector('img');
  if (img) img.src = item.thumb;
  el.querySelector('.card-title').textContent = item.title;
  el.querySelector('.card-sub').textContent = item.subtitle || item.tags[0] || '';
  el.querySelector('.card-num').textContent = `No. ${pad(numberOf.get(item.slug))}`;
  // only keyboard focus scrolls a card into view; a mouse click must not move the wall under it
  el.addEventListener('focus', () => { if (!dragging && el.matches(':focus-visible')) ensureVisible(+el.dataset.v); });
  return el;
}

const mod = (a, n) => ((a % n) + n) % n;
// x of a slot (before any open-panel shift) for a given scroll offset
const baseX = (v, off = offset) => G.left0 + mod(v * G.p - off + G.p, L) - G.p;

// ── Motion loop ─────────────────────────────────────────
let offset = 0, target = 0;
let shiftL = 0, shiftR = 0, shiftLT = 0, shiftRT = 0;
let openV = -1;
let rafId = 0, lastT = 0, moving = false;

function kick() { if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(tick); } }

function tick(t) {
  const dt = Math.min(64, t - lastT); lastT = t;
  const k = reduceMotion ? 1 : 1 - Math.exp(-dt / 85);
  const ks = reduceMotion ? 1 : 1 - Math.exp(-dt / 120);
  if (!dragging) offset += (target - offset) * k;
  shiftL += (shiftLT - shiftL) * ks;
  shiftR += (shiftRT - shiftR) * ks;
  layout();
  // While the wall slides, hover effects are off. Otherwise every card that passes under a
  // resting cursor starts (and abandons) its hover animation, which reads as stutter.
  const nowMoving = dragging || Math.abs(target - offset) > 0.5;
  if (nowMoving !== moving) { moving = nowMoving; track.classList.toggle('is-moving', moving); }
  const still = Math.abs(target - offset) < 0.3 && Math.abs(shiftLT - shiftL) < 0.3 && Math.abs(shiftRT - shiftR) < 0.3;
  if (still && !dragging) {
    offset = target; shiftL = shiftLT; shiftR = shiftRT; layout();
    if (moving) { moving = false; track.classList.remove('is-moving'); }
    rafId = 0; return;
  }
  rafId = requestAnimationFrame(tick);
}

function layout() {
  const xOpen = openV >= 0 ? baseX(openV) : 0;
  for (let v = 0; v < slots.length; v++) {
    let x = baseX(v);
    if (openV >= 0 && v !== openV) {
      const rel = mod(x - xOpen + L / 2, L) - L / 2;
      x += rel < 0 ? shiftL : shiftR;
    }
    slots[v].el.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
  }
}

// nearest scroll offset that puts slot v at x
function offsetFor(v, x) {
  const raw = v * G.p - (x - G.left0);
  return raw + Math.round((offset - raw) / L) * L;
}
const snap = (off) => Math.round(off / G.p) * G.p;
const centerOn = (v) => offsetFor(v, G.W / 2 - G.cw / 2);

function ensureVisible(v) {
  const x = baseX(v, target);
  if (x < G.edge * 0.5 || x + G.cw > G.W - G.edge * 0.5) { target = offsetFor(v, G.left0); kick(); }
}

// ── Opening a card ──────────────────────────────────────
// The wall slides the card to the middle while the card grows into the stage, both at once.
// The stage shows a still of exactly what the live view will show (made by npm run posters).
// The live component only starts once the motion is over, because booting a WebGL page blocks
// the browser for a moment and would otherwise land in the middle of the animation.
let opId = 0;
let stageFrame = null;
let stageMotion = null;
let closing = null;

const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
const px = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v]));

function bezier(x1, y1, x2, y2) {
  const c = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
      if (Math.abs(d) < 1e-6) break;
      t -= (c(x1, x2, t) - x) / d;
    }
    return c(y1, y2, Math.min(1, Math.max(0, t)));
  };
}
// moves straight away and settles gently (no slow start, so no "pause" before it opens)
const ease = bezier(0.2, 0.8, 0.2, 1);

// Moves the stage between two boxes. `to` may be a function, so a closing stage can follow a
// card that is still sliding along the wall.
function moveStage(from, to, ms) {
  stageMotion?.cancel();
  let cancelled = false, finish;
  const done = new Promise((r) => { finish = r; });
  const t0 = performance.now();
  const frame = (now) => {
    if (cancelled) return finish(false);
    const p = ms <= 1 ? 1 : Math.min(1, (now - t0) / ms);
    const e = ease(p);
    const b = typeof to === 'function' ? to() : to;
    stage.style.left = `${from.left + (b.left - from.left) * e}px`;
    stage.style.top = `${from.top + (b.top - from.top) * e}px`;
    stage.style.width = `${from.width + (b.width - from.width) * e}px`;
    stage.style.height = `${from.height + (b.height - from.height) * e}px`;
    if (p < 1) requestAnimationFrame(frame);
    else { stageMotion = null; finish(true); }
  };
  requestAnimationFrame(frame);
  stageMotion = { cancel() { cancelled = true; } };
  return done;
}

async function open(v) {
  if (!slots[v] || (v === openV && !closing)) return;
  warming?.();
  hideHint();
  if (openV >= 0 || closing) await close({ fast: true });
  const id = ++opId;
  const { item, el } = slots[v];
  const g = panelGeometry(item);
  const from = rectOf(el);

  openV = v;
  target = centerOn(v);
  shiftLT = g.dL; shiftRT = g.dR;
  kick();

  fillLabels(item);
  placeLabels(g);
  stage.dataset.kind = item.poster?.kind || 'scene';
  stage.classList.remove('is-wide', 'live');
  stagePoster.src = item.thumb || '';
  stageStill.src = item.still || item.thumb || '';
  Object.assign(stage.style, px(from), { visibility: 'visible' });
  stageFrame?.remove(); stageFrame = null;

  const viaKeyboard = !!document.activeElement?.matches?.('.card:focus-visible');
  el.classList.add('is-open');
  room.classList.add('has-open');
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  void stage.offsetWidth; // start the mask and crossfade from the card's look
  stage.classList.add('is-wide');
  setTimeout(() => {
    if (id !== opId) return;
    panel.classList.add('show-labels');
    if (viaKeyboard) $('#panel-open').focus({ preventScroll: true });
  }, OPEN_MS * 0.3);

  if (!(await moveStage(from, g.stage, OPEN_MS)) || id !== opId) return;
  setTimeout(() => { if (id === opId) startFrame(item, g.stage); }, 60);
}

function close({ fast = false } = {}) {
  if (closing) return closing;
  if (openV < 0) return Promise.resolve();
  closing = (async () => {
    const id = ++opId;
    const v = openV;
    const { el } = slots[v];
    const hadFocus = panel.contains(document.activeElement);
    panel.classList.remove('show-labels');
    room.classList.remove('has-open');
    stage.classList.remove('live', 'is-wide');
    stageFrame?.remove(); stageFrame = null;
    if (hadFocus) el.focus({ preventScroll: true });
    shiftLT = 0; shiftRT = 0; kick();

    const ms = fast ? CLOSE_MS * 0.6 : CLOSE_MS;
    setTimeout(() => el.classList.remove('is-open'), ms * 0.5);
    await moveStage(rectOf(stage), () => rectOf(el), ms);
    el.classList.remove('is-open');
    if (openV === v) openV = -1;
    if (id === opId) {
      stage.style.visibility = 'hidden';
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
    }
    layout();
  })().finally(() => { closing = null; });
  return closing;
}

// Starts the live component inside the stage, invisible, and fades it in over the still once
// it has painted. A "show" piece is cropped to its element exactly the way the still was.
function startFrame(item, box) {
  const f = document.createElement('iframe');
  f.title = item.title;
  f.setAttribute('allow', 'autoplay; fullscreen');
  const [vw, vh] = item.stage?.viewport || [1280, 800];
  f.style.width = `${vw}px`;
  f.style.height = `${vh}px`;
  f.rect = item.show && item.stage?.rect ? item.stage.rect : [0, 0, vw, vh];
  fitFrame(f, box);
  f.addEventListener('load', async () => {
    if (item.show) {
      const r = await isolateInFrame(f, item);
      if (r && stageFrame === f) { f.rect = trimRect(r, item.trim); fitFrame(f, rectOf(stage)); }
    }
    // some pieces show a loading state first; keep the still up until they say they're ready
    if (item.ready) await waitInFrame(f, item.ready, 10000);
    // let the page paint a few real frames before it replaces the still
    setTimeout(() => {
      if (stageFrame !== f) return;
      f.classList.add('ready');
      stage.classList.add('live');
    }, item.show ? 120 : 320);
  }, { once: true });
  f.src = item.url;
  stage.append(f);
  stageFrame = f;
}

const trimRect = ([x, y, w, h], t) => (t ? [x + w * t[0], y + h * t[1], w * (1 - t[0] - t[2]), h * (1 - t[1] - t[3])] : [x, y, w, h]);

function waitInFrame(f, sel, ms) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    (function poll() {
      let found = false;
      try { found = !!f.contentDocument?.querySelector(sel); } catch {}
      if (found || stageFrame !== f || performance.now() - t0 > ms) return resolve(found);
      setTimeout(poll, 80);
    })();
  });
}

function fitFrame(f, box) {
  const [x, y, w, h] = f.rect;
  const s = Math.min(box.width / w, box.height / h);
  const tx = (box.width - w * s) / 2 - x * s, ty = (box.height - h * s) / 2 - y * s;
  f.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
}

// Same trick as scripts/posters.mjs: hide everything but the element, keep the page colour.
function isolateInFrame(f, item) {
  return new Promise((resolve) => {
    let doc;
    try { doc = f.contentDocument; } catch { return resolve(null); }
    if (!doc) return resolve(null);
    const sel = item.show, bg = item.stage?.pageBg;
    const t0 = performance.now();
    (function find() {
      const el = doc.querySelector(sel);
      if (!el) return performance.now() - t0 > 6000 ? resolve(null) : setTimeout(find, 60);
      const style = doc.createElement('style');
      style.textContent = `html{background:${bg || 'transparent'} !important;overflow:hidden !important}
        body{background:transparent !important}
        body *{visibility:hidden !important}
        ${sel},${sel} *{visibility:visible !important}`;
      doc.head.append(style);
      f.contentWindow.requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const pad = bg ? SHOW_PAD * Math.max(r.width, r.height) : 0;
        const vw = f.contentWindow.innerWidth, vh = f.contentWindow.innerHeight;
        const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
        resolve([x, y, Math.min(vw, r.right + pad) - x, Math.min(vh, r.bottom + pad) - y]);
      });
    })();
  });
}

// Decode every still up front, so opening a card never waits on an image. Then rehearse an
// open once, invisibly: the first time the browser draws the stage and its labels it has to set
// up their layers, which otherwise costs a visible hitch on the first card you click.
const stillCache = [];
let warming = null;
(window.requestIdleCallback || ((fn) => setTimeout(fn, 400)))(() => {
  for (const item of items) {
    if (!item.still) continue;
    const im = new Image();
    im.decoding = 'async';
    im.src = item.still;
    im.decode?.().catch(() => {});
    stillCache.push(im);
  }
  warmUp();
});

function warmUp() {
  if (!items.length || openV >= 0 || closing) return;
  const first = items[0];
  stagePoster.src = first.thumb || '';
  stageStill.src = first.still || '';
  fillLabels(first);
  placeLabels(panelGeometry(first));
  panel.style.opacity = '0.01';
  Object.assign(stage.style, px(panelGeometry(first).stage), { visibility: 'visible' });
  stage.classList.add('is-wide');
  panel.classList.add('is-open', 'show-labels');
  const end = () => {
    if (warming !== end) return;
    warming = null;
    stage.classList.remove('is-wide');
    if (openV < 0) {
      panel.classList.remove('is-open', 'show-labels');
      stage.style.visibility = 'hidden';
    }
    panel.style.opacity = '';
  };
  warming = end;
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(end, 250)));
}

function fillLabels(item) {
  $('#panel-name').textContent = item.title;
  $('#panel-sub').textContent = item.subtitle || '';
  $('#panel-num').textContent = `No. ${pad(numberOf.get(item.slug))}`;
  $('#panel-date').textContent = item.date ? `Added ${fmtDate(item.date, { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  $('#panel-tags').textContent = item.tags.length ? item.tags.slice(0, 2).map((t) => t[0].toUpperCase() + t.slice(1)).join(', ') : '—';
  $('#panel-desc').textContent = item.description || '';
}

function placeLabels(g) {
  Object.assign($('#panel-title').style, px({ left: g.title.left, right: g.title.right, bottom: g.title.bottom, top: 'auto' }));
  Object.assign($('#panel-side').style, px(g.side));
}

// keep an open panel in place when the window changes size
function relayoutOpen() {
  if (openV < 0) return;
  const g = panelGeometry(slots[openV].item);
  offset = target = centerOn(openV);
  shiftL = shiftLT = g.dL; shiftR = shiftRT = g.dR;
  stageMotion?.cancel(); stageMotion = null;
  Object.assign(stage.style, px(g.stage));
  if (stageFrame) fitFrame(stageFrame, g.stage);
  placeLabels(g);
  layout();
}

$('#panel-open').addEventListener('click', () => {
  if (openV < 0) return;
  history.pushState({ fromWall: true }, '', `#/${slots[openV].item.slug}`);
  route();
});

// ── Input: drag, wheel, keys ────────────────────────────
let dragging = false, pointer = null, suppressClick = false, pressedCard = null;

track.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointer = { id: e.pointerId, x0: e.clientX, off0: target, lastX: e.clientX, lastT: e.timeStamp, vel: 0, moved: false };
  pressedCard = e.target.closest('.card');
});
addEventListener('pointermove', (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  const dx = e.clientX - pointer.x0;
  if (!pointer.moved && Math.abs(dx) > 6) {
    pointer.moved = true; dragging = true;
    track.classList.add('dragging');
    try { track.setPointerCapture(e.pointerId); } catch {}
    if (openV >= 0) close();
    hideHint();
  }
  if (!pointer.moved) return;
  const dt = Math.max(1, e.timeStamp - pointer.lastT);
  pointer.vel = 0.8 * ((e.clientX - pointer.lastX) / dt) + 0.2 * pointer.vel;
  pointer.lastX = e.clientX; pointer.lastT = e.timeStamp;
  offset = target = pointer.off0 - dx;
  kick();
});
const endDrag = (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  if (pointer.moved) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    // a flick carries on, then comes to rest on a card
    target = snap(offset - pointer.vel * 260);
    kick();
  }
  dragging = false; pointer = null;
  track.classList.remove('dragging');
};
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);

track.addEventListener('click', (e) => {
  if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
  // if the wall was still gliding, the card may have slid out from under the pointer between
  // press and release, so fall back to the card the press started on
  const card = e.target.closest('.card') || (e.detail ? pressedCard : null);
  pressedCard = null;
  if (card) open(+card.dataset.v);
  else if (openV >= 0) close();
});

// Wheel and trackpad move the wall freely, 1:1, and it stays where you leave it. (Snapping back
// to the nearest card afterwards is what made small scrolls feel like they were being dragged.)
room.addEventListener('wheel', (e) => {
  if (e.ctrlKey) return;
  if (e.target.closest('.index-panel')) return;
  e.preventDefault();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const delta = d * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? G.W : 1);
  if (!delta) return;
  if (openV >= 0) close();
  hideHint();
  target += delta;
  kick();
}, { passive: false });

addEventListener('keydown', (e) => {
  if (!viewer.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') {
    if (!indexPanel.hidden) return toggleIndex(false);
    if (openV >= 0) return close();
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    hideHint();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (openV >= 0) return open(mod(openV + dir, slots.length));
    target = snap(target) + dir * G.p; kick();
  }
});

// ── Menu ────────────────────────────────────────────────
function toggleIndex(show = indexPanel.hidden) {
  indexPanel.hidden = !show;
  $('#nav-index').setAttribute('aria-expanded', String(show));
  $('#nav-index').classList.toggle('is-active', show);
  $('#nav-wall').classList.toggle('is-active', !show);
}
$('#index-list').replaceChildren(...items.map((item) => {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = '<span class="n"></span><span class="t"></span><span class="s"></span>';
  b.querySelector('.n').textContent = pad(numberOf.get(item.slug));
  b.querySelector('.t').textContent = item.title;
  b.querySelector('.s').textContent = item.subtitle || '';
  b.addEventListener('click', () => {
    toggleIndex(false);
    // of all the copies on the loop, open the one that's quickest to reach
    const vs = slots.map((s, v) => (s.item === item ? v : -1)).filter((v) => v >= 0);
    const best = vs.reduce((a, b2) => (Math.abs(centerOn(b2) - offset) < Math.abs(centerOn(a) - offset) ? b2 : a));
    open(best);
  });
  li.append(b);
  return li;
}));
$('#nav-index').addEventListener('click', (e) => { e.stopPropagation(); toggleIndex(); });
addEventListener('pointerdown', (e) => {
  if (!indexPanel.hidden && !e.target.closest('.index-panel, #nav-index')) toggleIndex(false);
});
$('#nav-wall').addEventListener('click', () => { toggleIndex(false); if (openV >= 0) close(); });
$('#nav-home').addEventListener('click', () => {
  toggleIndex(false);
  if (openV >= 0) close();
  target = Math.round(offset / L) * L; kick();
});
$('#nav-theme').addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch {}
});

let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; $('#hint').classList.add('gone'); } }

// ── Full-screen viewer (#/slug) ─────────────────────────
function currentSlug() {
  const m = /^#\/(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

function route() {
  const item = items.find((i) => i.slug === currentSlug());
  item ? openViewer(item) : closeViewerUI();
}

function openViewer(item) {
  const i = items.indexOf(item);
  $('#viewer-num').textContent = `No. ${pad(numberOf.get(item.slug))}`;
  $('#viewer-title').textContent = item.title;
  $('#viewer-open').href = item.url;
  document.title = `${item.title} · Random Components`;
  if (viewerFrame.dataset.slug !== item.slug) {
    viewerLoading.classList.remove('done');
    setViewerFrame(item);
  }
  const prev = items[(i - 1 + items.length) % items.length];
  const next = items[(i + 1) % items.length];
  $('#viewer-prev').onclick = () => goViewer(prev);
  $('#viewer-next').onclick = () => goViewer(next);
  $('#viewer-prev').disabled = $('#viewer-next').disabled = items.length < 2;
  if (viewer.hidden) {
    viewer.hidden = false;
    // only one live copy at a time: park the one on the wall
    if (stageFrame) { stageFrame.remove(); stageFrame = null; stage.classList.remove('live'); }
    $('#viewer-close').focus();
  }
}

function goViewer(item) {
  history.replaceState(history.state, '', `#/${item.slug}`);
  route();
}

function closeViewer() {
  if (history.state?.fromWall) history.back();
  else { history.replaceState(null, '', location.pathname + location.search); route(); }
}

function closeViewerUI() {
  if (viewer.hidden) return;
  viewer.hidden = true;
  document.title = 'Random Components';
  setViewerFrame(null);
  if (openV >= 0 && !stageFrame && !closing) startFrame(slots[openV].item, rectOf(stage));
  (openV >= 0 ? $('#panel-open') : null)?.focus({ preventScroll: true });
}

// Iframes are swapped for fresh elements instead of changing their src: changing the src
// of an existing iframe adds a browser history entry, which would hijack the Back button.
function setViewerFrame(item) {
  const f = viewerFrame.cloneNode(false);
  f.removeAttribute('src');
  delete f.dataset.slug;
  if (item) {
    f.dataset.slug = item.slug;
    f.addEventListener('load', () => {
      viewerLoading.classList.add('done');
      // same origin, so Esc still works after you click into a component
      try {
        f.contentWindow.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !e.defaultPrevented) closeViewer();
        });
      } catch {}
    });
    f.src = item.url;
  }
  viewerFrame.replaceWith(f);
  viewerFrame = f;
}
$('#viewer-close').addEventListener('click', closeViewer);
addEventListener('popstate', route);
addEventListener('hashchange', route);
addEventListener('keydown', (e) => {
  if (viewer.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowLeft') $('#viewer-prev').click();
  if (e.key === 'ArrowRight') $('#viewer-next').click();
});

// ── Go ──────────────────────────────────────────────────
function setup() {
  measure();
  if (buildTrack() && openV >= 0) {
    // the loop was rebuilt underneath an open card: drop the panel without animating
    opId++; openV = -1; shiftL = shiftLT = shiftR = shiftRT = 0;
    stageMotion?.cancel(); stageMotion = null; stageFrame?.remove(); stageFrame = null;
    stage.style.visibility = 'hidden'; stage.classList.remove('is-wide', 'live');
    panel.classList.remove('is-open', 'show-labels');
    room.classList.remove('has-open');
  }
  L = Math.max(1, slots.length * G.p);
  if (openV >= 0) relayoutOpen();
  else { offset = target = snap(target); layout(); }
}
setup();
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 80); });
route();

// ?open=<slug> opens that piece on the wall (handy for sharing a link to one)
{
  const slug = new URLSearchParams(location.search).get('open');
  const v = slots.findIndex((s) => s.item.slug === slug && !s.copy);
  if (v >= 0) setTimeout(() => open(v), 350);
}
