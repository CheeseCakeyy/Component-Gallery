import './style.css';
import { FizzScene } from './scene.js';

const root = document.querySelector('#experience');
const canvas = document.querySelector('#scene');
const cursor = document.querySelector('#cursor');
const pauseButton = document.querySelector('#pause');
const soundButton = document.querySelector('#sound');
const announcement = document.querySelector('#announcement');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const abort = new AbortController();
const listen = (element, type, fn, options = {}) => element.addEventListener(type, fn, { ...options, signal: abort.signal });
let scene;
let started = false;
let pointerDown = null;
let hintTimeout;

class FizzAudio {
  enabled = false;
  async toggle() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      const ctx = this.context;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .35;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer; noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass'; filter.frequency.value = 5600;
      const volume = ctx.createGain(); volume.gain.value = .10;
      noise.connect(filter).connect(volume).connect(this.master);
      noise.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    this.master.gain.setTargetAtTime(this.enabled ? .5 : 0, this.context.currentTime, .15);
    return this.enabled;
  }
  pop() {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context, t = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650 + Math.random() * 250, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + .12);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.14, t + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .18);
    osc.connect(gain).connect(this.master);
    osc.start(t); osc.stop(t + .19);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  quiet(value) {
    if (this.context) this.master.gain.setTargetAtTime(this.enabled && !value ? .5 : 0, this.context.currentTime, .15);
  }
  dispose() { this.context?.close(); }
}
const audio = new FizzAudio();

function announce(message) { announcement.textContent = message; }
function setPaused(paused) {
  if (!scene) return;
  scene.setPaused(paused);
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
  document.querySelector('#hint-title').textContent = paused ? 'Taking a little breather.' : matchMedia('(pointer: coarse)').matches ? 'Drag gently. Make a friend.' : 'Move your cursor. Make a friend.';
  document.querySelector('#hint-detail').textContent = paused ? 'Press play whenever you’re ready.' : 'Click anywhere for a little happy.';
  audio.quiet(paused);
}
function coordinates(event) {
  const rect = root.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width, y: 1 - (event.clientY - rect.top) / rect.height, px: event.clientX - rect.left, py: event.clientY - rect.top };
}
function isControl(event) { return event.target.closest('button, a'); }
function showError(error) {
  console.error('[Little Fizz]', error);
  root.classList.add('is-ready');
  document.querySelector('#fallback').hidden = false;
  for (const control of root.querySelectorAll('button')) control.disabled = true;
  scene?.dispose();
}

try {
  scene = new FizzScene(canvas, { reducedMotion: motionPreference.matches, onError: showError });
  await scene.init();
  root.classList.add('is-ready');
  setPaused(scene.paused);
  // Read-only diagnostics for visual / interaction QA in development.
  if (import.meta.env.DEV) window.__fizz = scene;
} catch (error) { showError(error); }

listen(root, 'pointermove', event => {
  if (!scene || isControl(event)) { cursor.classList.remove('is-visible'); return; }
  if (event.pointerType === 'touch' && !pointerDown) return;
  const p = coordinates(event);
  scene.move(p.x, p.y);
  cursor.style.transform = `translate3d(${p.px}px, ${p.py}px, 0)`;
  cursor.classList.toggle('is-visible', event.pointerType !== 'touch' && !scene.paused);
  if (!started && !scene.paused) { started = true; root.classList.add('is-playing'); }
});
listen(root, 'pointerleave', () => { scene?.leave(); cursor.classList.remove('is-visible'); });
listen(root, 'pointerdown', event => {
  if (!scene || isControl(event) || !event.isPrimary || event.button !== 0) return;
  const p = coordinates(event);
  pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
  scene.move(p.x, p.y);
  if (event.pointerType === 'touch') root.setPointerCapture(event.pointerId);
});
listen(root, 'pointerup', event => {
  if (!pointerDown || pointerDown.id !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  if (!isControl(event) && distance < 15 && scene && !scene.paused) {
    const p = coordinates(event);
    scene.boop(p.x, p.y);
    audio.pop();
    root.classList.add('is-playing');
    document.querySelector('#hint-detail').textContent = 'That’s the spot. Again?';
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => {
      if (!scene.paused) document.querySelector('#hint-detail').textContent = 'Click anywhere for a little happy.';
    }, 2600);
  }
  if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
  pointerDown = null;
});
listen(root, 'pointercancel', () => { pointerDown = null; scene?.leave(); });
listen(document.querySelector('#fizz'), 'click', () => {
  if (!scene) return;
  if (scene.paused) setPaused(false);
  scene.moreFizz(); audio.pop();
  announce('An extra splash of bubbles for your little friend.');
});
listen(pauseButton, 'click', () => {
  if (!scene) return;
  setPaused(!scene.paused);
  announce(scene.paused ? 'Animation paused.' : 'Animation resumed.');
});
listen(document.querySelector('#reset'), 'click', () => {
  scene?.reset();
  root.classList.remove('is-playing');
  started = false;
  announce('Your puppy is floating back home.');
});
listen(soundButton, 'click', async () => {
  try {
    const enabled = await audio.toggle();
    soundButton.setAttribute('aria-pressed', String(enabled));
    soundButton.setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
    audio.quiet(scene?.paused || document.hidden);
    if (enabled && !scene?.paused) audio.pop();
    announce(enabled ? 'Gentle fizz sounds on.' : 'Sound off.');
  } catch { announce('Sound could not start in this browser.'); }
});
listen(motionPreference, 'change', event => { if (event.matches) setPaused(true); });
listen(document, 'visibilitychange', () => audio.quiet(document.hidden || scene?.paused));
listen(window, 'keydown', event => {
  if (event.code === 'Space' && event.target === document.body) { event.preventDefault(); if (scene) setPaused(!scene.paused); }
});
function dispose() { abort.abort(); clearTimeout(hintTimeout); scene?.dispose(); audio.dispose(); }
if (import.meta.hot) import.meta.hot.dispose(dispose);
