// The wall. Reads manifest.json (built by scripts/sync.mjs from public/components/ +
// components.json) and hangs one card per component. Nothing about any component is
// hard-coded here: add a folder, and the wall grows a slot.

const $ = (sel) => document.querySelector(sel);
const root = document.documentElement;
const room = $('#room');
const track = $('#track');
const panel = $('#panel');
const stage = $('#stage');
const stageImg = $('#stage-img');
const viewer = $('#viewer');
let viewerFrame = $('#viewer-frame');
const viewerLoading = $('#viewer-loading');
const indexPanel = $('#index-panel');

const PREVIEW_W = 1280;
const NEW_FOR_DAYS = 21;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const OPEN_MS = reduceMotion ? 1 : 820;
const CLOSE_MS = reduceMotion ? 1 : 620;
const EASE = 'cubic-bezier(.68, 0, .18, 1)';

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

// Where the open panel goes, and how far the neighbours must step aside.
function panelGeometry() {
  const { W, H, portrait, cw, ch, gap, top } = G;
  if (portrait) {
    const sw = W - 2 * G.edge, sh = sw / 1.6;
    const stageTop = top + ch * 0.2;
    return {
      stage: { left: G.edge, top: stageTop, width: sw, height: sh },
      title: { left: G.edge, right: 'auto', bottom: H - stageTop + 6 },
      side: { left: G.edge, top: stageTop + sh + 16, width: sw },
      dL: -W * 0.75, dR: W * 0.75,
    };
  }
  const sw = Math.min(cw * 2.2, W * 0.52), sh = sw / 1.6;
  const lw = cw * 0.92, inner = cw * 0.16;
  const pw = lw + inner + sw;
  const panelLeft = W / 2 - pw / 2 - cw * 0.1;
  const stageLeft = panelLeft + lw + inner;
  const stageTop = top + (ch - sh) / 2 + ch * 0.07;
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
  el.innerHTML = `
    <span class="card-inner">
      ${item.thumb ? `<img alt="" draggable="false" decoding="async">` : ''}
      <span class="card-text"><span class="card-title"></span><span class="card-sub"></span></span>
      <span class="orb"></span>
      <span class="card-num"></span>
      ${isNew(item) ? '<span class="new-dot">New</span>' : ''}
    </span>`;
  const img = el.querySelector('img');
  if (img) { img.src = item.thumb; if (item.focus) img.style.objectPosition = item.focus; }
  el.querySelector('.card-title').textContent = item.title;
  el.querySelector('.card-sub').textContent = item.subtitle || item.tags[0] || '';
  el.querySelector('.card-num').textContent = `No. ${pad(numberOf.get(item.slug))}`;
  el.addEventListener('focus', () => { if (!dragging) ensureVisible(+el.dataset.v); });
  return el;
}

const mod = (a, n) => ((a % n) + n) % n;
// x of a slot (before any open-panel shift) for a given scroll offset
const baseX = (v, off = offset) => G.left0 + mod(v * G.p - off + G.p, L) - G.p;

// ── Motion loop ─────────────────────────────────────────
let offset = 0, target = 0;
let shiftL = 0, shiftR = 0, shiftLT = 0, shiftRT = 0;
let openV = -1;
let rafId = 0, lastT = 0;
let settleWaiters = [];

function kick() { if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(tick); } }

function tick(t) {
  const dt = Math.min(64, t - lastT); lastT = t;
  const k = reduceMotion ? 1 : 1 - Math.exp(-dt / 105);
  const ks = reduceMotion ? 1 : 1 - Math.exp(-dt / 140);
  if (!dragging) offset += (target - offset) * k;
  shiftL += (shiftLT - shiftL) * ks;
  shiftR += (shiftRT - shiftR) * ks;
  layout();
  const still = Math.abs(target - offset) < 0.3 && Math.abs(shiftLT - shiftL) < 0.3 && Math.abs(shiftRT - shiftR) < 0.3;
  if (Math.abs(target - offset) < 0.6) { settleWaiters.forEach((r) => r()); settleWaiters = []; }
  if (still && !dragging) {
    offset = target; shiftL = shiftLT; shiftR = shiftRT; layout();
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

function settle() {
  if (Math.abs(target - offset) < 0.6) return Promise.resolve();
  return new Promise((resolve) => { settleWaiters.push(resolve); setTimeout(resolve, 1100); });
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
  if (x < G.edge * 0.5 || x + G.cw > G.W - G.edge * 0.5) { target = offsetFor(v, G.portrait ? G.left0 : G.left0); kick(); }
}

// ── Opening a card ──────────────────────────────────────
let opId = 0;
let stageFrame = null;
let stageAnim = null;

const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
const px = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v]));

async function open(v) {
  if (v === openV || !slots[v]) return;
  hideHint();
  if (openV >= 0) await close({ fast: true });
  const id = ++opId; // taken after closing, so a newer open() or close() cancels this one

  target = centerOn(v); kick();
  await settle();
  if (id !== opId) return;

  const { item, el } = slots[v];
  openV = v;
  const g = panelGeometry();
  const from = rectOf(el);

  fillLabels(item);
  stage.classList.remove('is-wide', 'live');
  stageImg.src = item.thumb || '';
  stageImg.style.objectPosition = item.focus || '';
  Object.assign(stage.style, px(from), { visibility: 'visible' });
  stageFrame?.remove();
  stageFrame = makeStageFrame(item, g.stage.width);

  const viaKeyboard = document.activeElement?.classList.contains('card');
  el.classList.add('is-open');
  room.classList.add('has-open');
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  shiftLT = g.dL; shiftRT = g.dR; kick();
  placeLabels(g);

  stageAnim?.cancel();
  void stage.offsetWidth;
  stage.classList.add('is-wide');
  stageAnim = stage.animate([px(from), px(g.stage)], { duration: OPEN_MS, easing: EASE, fill: 'forwards' });
  setTimeout(() => {
    if (id !== opId) return;
    panel.classList.add('show-labels');
    if (viaKeyboard) $('#panel-open').focus({ preventScroll: true });
  }, OPEN_MS * 0.45);
  try { await stageAnim.finished; } catch { return; }
  if (id !== opId) return;
  Object.assign(stage.style, px(g.stage));
  stageAnim.cancel(); stageAnim = null;
  stage.dataset.settled = '1';
  revealFrame();
}

async function close({ fast = false } = {}) {
  if (openV < 0) return;
  const id = ++opId;
  const v = openV;
  const { el } = slots[v];
  const hadFocus = panel.contains(document.activeElement);
  panel.classList.remove('show-labels');
  room.classList.remove('has-open');
  stage.classList.remove('live');
  stageFrame?.classList.remove('ready');
  if (hadFocus) el.focus({ preventScroll: true });
  delete stage.dataset.settled;
  shiftLT = 0; shiftRT = 0; kick();

  const from = rectOf(stage);
  const to = rectOf(el);
  stage.classList.remove('is-wide');
  stageAnim?.cancel();
  stageAnim = stage.animate([px(from), px(to)], { duration: fast ? CLOSE_MS * 0.55 : CLOSE_MS, easing: EASE, fill: 'forwards' });
  setTimeout(() => el.classList.remove('is-open'), (fast ? CLOSE_MS * 0.55 : CLOSE_MS) * 0.55);
  try { await stageAnim.finished; } catch {}
  stageFrame?.remove(); stageFrame = null;
  if (openV === v) openV = -1;
  if (id === opId || fast) {
    stage.style.visibility = 'hidden';
    stageAnim?.cancel(); stageAnim = null;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  }
  el.classList.remove('is-open');
  layout();
}

function makeStageFrame(item, width) {
  const f = document.createElement('iframe');
  f.title = item.title;
  f.setAttribute('allow', 'autoplay; fullscreen');
  f.style.setProperty('--s', width / PREVIEW_W);
  f.addEventListener('load', () => { f.dataset.loaded = '1'; revealFrame(); });
  f.src = item.url;
  stage.append(f);
  return f;
}

function revealFrame() {
  if (!stageFrame?.dataset.loaded || !stage.dataset.settled) return;
  setTimeout(() => {
    if (!stageFrame) return;
    stageFrame.classList.add('ready');
    stage.classList.add('live');
  }, 250);
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
  const g = panelGeometry();
  offset = target = centerOn(openV);
  shiftL = shiftLT = g.dL; shiftR = shiftRT = g.dR;
  stageAnim?.cancel(); stageAnim = null;
  Object.assign(stage.style, px(g.stage));
  stageFrame?.style.setProperty('--s', g.stage.width / PREVIEW_W);
  placeLabels(g);
  layout();
}

$('#panel-open').addEventListener('click', () => {
  if (openV < 0) return;
  history.pushState({ fromWall: true }, '', `#/${slots[openV].item.slug}`);
  route();
});

// ── Input: drag, wheel, keys ────────────────────────────
let dragging = false, pointer = null, suppressClick = false;

track.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointer = { id: e.pointerId, x0: e.clientX, off0: target, lastX: e.clientX, lastT: e.timeStamp, vel: 0, moved: false };
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
  const card = e.target.closest('.card');
  if (card) open(+card.dataset.v);
  else if (openV >= 0) close();
});

let wheelTimer = 0;
room.addEventListener('wheel', (e) => {
  if (e.ctrlKey) return;
  if (e.target.closest('.index-panel')) return;
  e.preventDefault();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const delta = d * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? G.W : 1);
  if (Math.abs(delta) < 1) return;
  if (openV >= 0) close();
  hideHint();
  target += delta;
  kick();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { target = snap(target); kick(); }, 140);
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
  if (openV >= 0 && !stageFrame) stageFrame = makeStageFrame(slots[openV].item, panelGeometry().stage.width);
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
    stageAnim?.cancel(); stageAnim = null; stageFrame?.remove(); stageFrame = null;
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
