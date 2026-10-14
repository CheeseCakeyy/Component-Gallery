import '@fontsource-variable/archivo/wght.css';
import '@fontsource-variable/playfair-display/wght.css';
import '@fontsource-variable/playfair-display/wght-italic.css';
import './style.css';
import { buildDeck, pipLayout, flipDelay, maxDistance, waveDuration, isVisible, FLIP_MS, HERO_MS } from './deck.js';
import { CardAudio } from './audio.js';

const field = document.querySelector('#field');
const caption = document.querySelector('#caption');
const soundButton = document.querySelector('#sound');
const soundLabel = document.querySelector('#sound-label');
const mobileQuery = matchMedia('(max-width: 720px)');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

const BASE_TILT = 6; // degrees the field leans back at rest
const cards = buildDeck(7);
const audio = new CardAudio();
let reversed = false;
let busy = false;
let busyTimer;

// ---------- markup ----------
const use = (id) => `<use href="#${id}"></use>`;
const n = (v, d = 3) => v.toFixed(d);

function frontHTML(c) {
  const suit = `suit-${c.suit}`;
  const index = `<span class="rk">${c.rank}</span><svg class="is">${use(suit)}</svg>`;
  let body;
  if (c.rank === 'A') {
    body = `<svg class="ace${c.suit === 's' ? ' big' : ''}">${use(suit)}</svg>`;
  } else if (c.court) {
    body = `<div class="court"><span class="cl a">${c.rank}</span><svg class="cs a">${use(suit)}</svg>`
      + `<span class="medal"><svg>${use(suit)}</svg></span>`
      + `<svg class="cs b">${use(suit)}</svg><span class="cl b">${c.rank}</span></div>`;
  } else {
    const pips = pipLayout(c.rank).map((p) =>
      `<svg class="pip" style="left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%)${p.flip ? ' rotate(180deg)' : ''}">${use(suit)}</svg>`);
    body = `<div class="pips">${pips.join('')}</div>`;
  }
  return `<div class="face front ${c.red ? 's-red' : 's-black'}"><span class="idx tl">${index}</span>`
    + `<span class="idx br">${index}</span>${body}<span class="grain"></span></div>`;
}

const REVERSE_FACE = `<div class="face front uno"><div class="ink">
  <div class="oval"></div>
  <svg class="glyph" viewBox="0 0 100 100"><use href="#rev-arrows" x="4" y="4" width="100" height="100" class="glyph-shadow"></use><use href="#rev-arrows" width="100" height="100"></use></svg>
  <span class="corner tl"><svg>${use('rev-arrows')}</svg></span><span class="corner br"><svg>${use('rev-arrows')}</svg></span>
  <span class="glint"></span></div><span class="grain"></span></div>`;

const BACK = `<div class="face back"><div class="pattern"><span class="medallion"><svg>${use('back-orn')}</svg></span></div><span class="grain"></span></div>`;

function slotHTML(c) {
  const f = c.float;
  const cls = ['slot', c.side, c.outerCol && 'oc', c.extraRow && 'xr', c.isCenter ? 'center s-down wait' : 's-up'];
  const vars = `--deal:${Math.round(120 + c.dist * 55)}ms;--px:${n(c.push.x)}em;--py:${n(c.push.y)}em;`
    + `--fd:${n(f.dur, 2)}s;--fdel:${n(f.delay, 2)}s;--fl:${n(f.lift)}em;--fz:${n(f.depth)}em;--frx:${n(f.rx, 1)}deg;--fry:${n(f.ry, 1)}deg`;
  return `<div class="${cls.filter(Boolean).join(' ')}" style="${vars}">
    ${c.isCenter ? '<div class="glow"></div>' : ''}
    <div class="push"><div class="float">
      <div class="pose" style="transform:translate3d(${n(c.ox)}em,${n(c.oy)}em,${n(c.z)}em) rotate(${n(c.rz, 2)}deg)">
        <div class="hov">
          ${c.isCenter ? '<div class="halo"></div>' : ''}
          <div class="shadow"></div>
          <div class="lift"><div class="spin">${c.isCenter ? REVERSE_FACE : frontHTML(c)}${BACK}</div></div>
          ${c.isCenter ? '<button type="button" class="hit" aria-label="Flip the face-down card"></button>' : ''}
        </div>
      </div>
    </div></div>
  </div>`;
}

field.innerHTML = cards.map(slotHTML).join('');
const els = [...field.children].map((slot) => ({
  slot,
  push: slot.querySelector('.push'),
  hov: slot.querySelector('.hov'),
  lift: slot.querySelector('.lift'),
  spin: slot.querySelector('.spin'),
}));
const center = els[cards.findIndex((c) => c.isCenter)];
const hit = field.querySelector('.hit');

// ---------- the flip ----------
function setCaption(state) {
  const tpl = document.querySelector(state === 'reversed' ? '#cap-reversed' : '#cap-idle');
  caption.replaceChildren(tpl.content.cloneNode(true));
}

function flip() {
  if (busy) return;
  const reversing = !reversed;
  const mobile = mobileQuery.matches;
  const md = maxDistance(cards, mobile);
  const sound = !audio.muted && audio.ensure();
  const t0 = audio.now + 0.04;

  cards.forEach((c, i) => {
    const e = els[i];
    const delay = flipDelay(c, reversing, md);
    // Each card alternates between the two keyframe sets, so the animation restarts every time.
    e.slot.classList.remove('s-up', 's-down', 'a-up', 'a-down', 'wait');
    e.slot.classList.add(reversing === c.isCenter ? 'a-up' : 'a-down');
    e.spin.style.animationDelay = `${delay}ms`;
    e.lift.style.animationDelay = `${delay}ms`;
    e.push.style.transitionDelay = `${delay}ms`;
    if (c.isCenter) {
      e.slot.classList.toggle('hero', reversing);
      e.hov.style.transitionDelay = reversing ? '380ms' : `${delay}ms`;
    }
    if (sound && isVisible(c, mobile)) {
      const t = t0 + delay / 1000;
      if (c.isCenter) audio.hero(t, HERO_MS / 1000, reversing);
      else audio.card(t, FLIP_MS / 1000, Math.max(-0.9, Math.min(0.9, c.dx / 6)), Math.max(0.05, 0.26 - c.dist * 0.026), c.dist > 3.2);
    }
  });

  reversed = reversing;
  busy = true;
  field.classList.toggle('reversed', reversing);
  document.body.classList.add('busy');
  hit.setAttribute('aria-label', reversing ? 'Flip the reverse card back' : 'Flip the face-down card');
  setCaption(reversing ? 'reversed' : 'idle');

  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => {
    busy = false;
    document.body.classList.remove('busy');
    if (!reversed) {
      center.slot.classList.add('wait');
      center.hov.style.transitionDelay = '0ms';
    }
  }, waveDuration(cards, reversing, mobile) + 80);
}

hit.addEventListener('click', flip);

// ---------- sound toggle ----------
soundButton.addEventListener('click', () => {
  audio.muted = !audio.muted;
  soundButton.setAttribute('aria-pressed', String(!audio.muted));
  soundLabel.textContent = audio.muted ? 'Sound off' : 'Sound on';
  if (!audio.muted) audio.tick();
});

// ---------- parallax: the field leans toward the pointer ----------
let target = { x: 0, y: 0 };
let current = { x: 0, y: 0 };
let raf = 0;

function applyTilt() {
  field.style.transform = `rotateX(${n(BASE_TILT + current.x, 2)}deg) rotateY(${n(current.y, 2)}deg)`;
}
function step() {
  current.x += (target.x - current.x) * 0.07;
  current.y += (target.y - current.y) * 0.07;
  applyTilt();
  const moving = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.01;
  raf = moving ? requestAnimationFrame(step) : 0;
}
function aim(x, y) {
  if (motionQuery.matches || !finePointer.matches) return;
  target = { x, y };
  if (!raf) raf = requestAnimationFrame(step);
}
window.addEventListener('pointermove', (e) => aim((e.clientY / innerHeight - 0.5) * -7, (e.clientX / innerWidth - 0.5) * 10));
document.documentElement.addEventListener('pointerleave', () => aim(0, 0));
applyTilt();
