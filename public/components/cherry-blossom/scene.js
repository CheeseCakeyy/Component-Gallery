import { resolveFlowerContacts, compareParticleDepth } from './petal-depth.mjs';

const root = document.querySelector('#experience');
const water = document.querySelector('#water');
const layer = document.querySelector('#petals');
const ctx = layer.getContext('2d');
const backdrop = document.querySelector('#backdrop');
const pauseButton = document.querySelector('#pause');
const status = document.querySelector('#status');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const MAX_RIPPLES = 20;
const LIFE = 5.8;
let width = innerWidth, height = innerHeight, pixelRatio = 1;
let paused = motionQuery.matches;
let time = 0, breezeTime = 0, previous = 0, frameId = 0;
let lastTrail = 0, lastAuto = 0, interactions = 0;
let gl, program, uniforms, ready = false;
const ripples = [];
const particles = [];
const rippleData = new Float32Array(MAX_RIPPLES * 4);
const petal = new Image();
petal.src = './assets/petal.webp';
const blossom = new Image();
blossom.src = './assets/blossom.webp';

const vertex = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = vec2(position.x * .5 + .5, .5 - position.y * .5);
  gl_Position = vec4(position, 0., 1.);
}`;

const fragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D image;
uniform vec2 resolution;
uniform vec2 imageSize;
uniform float time;
uniform float breeze;
uniform vec4 rings[20];

vec2 cover(vec2 uv) {
  float screenAspect = resolution.x / resolution.y;
  float imageAspect = imageSize.x / imageSize.y;
  vec2 scale = vec2(min(screenAspect/imageAspect, 1.), min(imageAspect/screenAspect, 1.));
  vec2 anchor = vec2(1., .5);
  return uv * scale + (1. - scale) * anchor;
}

void main() {
  vec2 uv = vUv;
  vec2 source = cover(uv);
  float aspect = resolution.x / resolution.y;
  // The canopy and trunk stay above the water; only the pool refracts.
  float pond = smoothstep(.18, .38, source.y) * (1.-smoothstep(.86, .94, source.x));
  vec2 slope = vec2(0.);
  float crest = 0.;
  for (int i = 0; i < 20; i++) {
    vec4 ring = rings[i];
    float age = time - ring.z;
    if (ring.w > 0. && age >= 0. && age < 5.8) {
      vec2 delta = (uv - ring.xy) * vec2(aspect, 1.);
      float d = length(delta);
      float radius = age * .18;
      float band = d - radius;
      float envelope = exp(-band * band / (.002 + age * .0007));
      float fade = exp(-age * .65) * smoothstep(0., .14, age);
      float wave = sin(band * 170. - age * 3.);
      float strength = envelope * fade * ring.w;
      slope += (delta / max(d, .001)) * wave * strength;
      crest += cos(band * 170. - age * 3.) * strength;
    }
  }
  vec2 drift = vec2(sin(source.y * 19. + breeze * .22), cos(source.x * 16. + breeze * .17)) * .00065;
  vec2 offset = (slope * .008 + drift) * pond;
  float canopy = (1. - smoothstep(.12, .42, source.y)) * smoothstep(.38, .75, source.x);
  vec2 sway = vec2(sin(breeze * .45 + source.x * 5.), cos(breeze * .36)) * .0015 * canopy;
  vec2 sampleUv = cover(uv + offset) + sway;
  vec3 color = texture2D(image, clamp(sampleUv, .001, .999)).rgb;
  // A narrow warm highlight and cooler trough make the rings feel like light.
  color += (crest * .064 + dot(slope, normalize(vec2(-.6, -.8))) * .026) * pond;
  float shimmer = sin(source.x*45. + source.y*24. + breeze*.37) * sin(source.x*22. - source.y*38. - breeze*.28);
  color += shimmer * .004 * pond;
  gl_FragColor = vec4(color, 1.);
}`;

function compile(kind, source) {
  const shader = gl.createShader(kind);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function setupWater() {
  gl = water.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) { root.dataset.renderer = 'canvas'; return; }
  try {
    program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backdrop);
    uniforms = Object.fromEntries(['resolution','imageSize','time','breeze','rings[0]'].map(key => [key, gl.getUniformLocation(program, key)]));
    gl.uniform2f(uniforms.imageSize, backdrop.naturalWidth, backdrop.naturalHeight);
    root.dataset.renderer = 'webgl';
  } catch (error) {
    console.warn('Water uses the canvas fallback:', error.message);
    gl = null; program = null;
    root.dataset.renderer = 'canvas';
  }
}

function resize() {
  const oldW = width, oldH = height;
  width = innerWidth; height = innerHeight;
  pixelRatio = Math.min(devicePixelRatio || 1, 1.75);
  // Bound fill rate on high-density displays.
  const waterRatio = Math.min(pixelRatio, Math.sqrt(2400000 / (width * height)));
  water.width = Math.round(width * waterRatio); water.height = Math.round(height * waterRatio);
  layer.width = Math.round(width * pixelRatio); layer.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (gl && program) { gl.viewport(0, 0, water.width, water.height); gl.uniform2f(uniforms.resolution, width, height); }
  for (const p of particles) { p.x *= width/oldW; p.y *= height/oldH; p.landY *= height/oldH; }
  wake();
}

function resetPetal(p, initial = false) {
  const foreground = Math.random() > .88;
  p.x = width * (.38 + Math.random() * .6);
  p.y = initial ? height * (Math.random() * 1.05 - .08) : -50;
  p.size = (foreground ? 58 + Math.random()*24 : 26 + Math.random()*24) * Math.min(1.1, Math.max(.75, width/1500));
  p.speed = (foreground ? 21 : 11) + Math.random() * 14;
  p.phase = Math.random() * Math.PI * 2;
  p.angle = Math.random() * Math.PI * 2;
  p.spin = (Math.random() - .5) * .65;
  p.landY = height * (.42 + Math.random() * .52);
  p.floating = initial && Math.random() < .36;
  if (p.floating) p.y = p.landY;
  p.waterAge = Math.random() * 8;
  p.waterLife = 18 + Math.random() * 16;
  p.vx = 0; p.vy = 0;
  p.blur = foreground ? 2.5 : 0;
  p.alpha = foreground ? .68 : .93;
  p.flowerContact = null;
}

function blossomHome(slot) {
  const positions = width < 700 ? [[.28, .43], [.61, .29]] : [[.62, .74], [.79, .43]];
  return { x: positions[slot][0] * width, y: positions[slot][1] * height };
}

function createBlossom(slot) {
  const p = {};
  resetPetal(p, true);
  const home = blossomHome(slot);
  Object.assign(p, {
    blossomSlot: slot, x: home.x, y: home.y, landY: home.y,
    size: slot === 0 ? 88 : 73, angle: slot === 0 ? -.22 : .48,
    floating: true, blur: 0, alpha: .98, waterAge: 0,
  });
  return p;
}

function addRipple(x, y, strength = 1) {
  if (!ready) return;
  if (ripples.length >= MAX_RIPPLES) ripples.shift();
  ripples.push({ x: x/width, y: y/height, start: time, strength });
  root.dataset.ripples = String(ripples.length);
  wake();
}

function renderWater() {
  if (!gl || !program) return;
  rippleData.fill(0);
  ripples.forEach((r, i) => rippleData.set([r.x, r.y, r.start, r.strength], i * 4));
  gl.uniform1f(uniforms.time, time);
  gl.uniform1f(uniforms.breeze, breezeTime);
  gl.uniform4fv(uniforms['rings[0]'], rippleData);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawFallbackRipples() {
  if (gl && program) return;
  for (const r of ripples) {
    const age = time-r.start;
    for (let ring=0; ring<4; ring++) {
      const radius = age * height * .18 - ring * 13;
      if (radius <= 0) continue;
      ctx.beginPath(); ctx.ellipse(r.x*width, r.y*height, radius, radius*.78, 0, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,255,255,${Math.exp(-age*.7)*.42*r.strength})`;
      ctx.lineWidth = 1.6; ctx.stroke();
    }
  }
}

function drawPetals(dt) {
  ctx.clearRect(0, 0, width, height);
  drawFallbackRipples();
  for (const p of particles) {
    const isBlossom = p.blossomSlot !== undefined;
    if (!paused) {
      if (p.floating) {
        if (!isBlossom) p.waterAge += dt;
        p.x += Math.sin(breezeTime*.19+p.phase) * dt * 2.5;
        p.y += Math.cos(breezeTime*.23+p.phase) * dt;
        p.angle += dt * .035 * Math.sin(p.phase+breezeTime*.2);
        if (isBlossom) {
          const home = blossomHome(p.blossomSlot);
          p.x += (home.x - p.x) * dt * .055;
          p.y += (home.y - p.y) * dt * .055;
        }
        if (p.waterAge > p.waterLife) { resetPetal(p); continue; }
      } else {
        p.x += (-8 + Math.sin(breezeTime*.55+p.phase)*15) * dt;
        p.y += p.speed * dt;
        p.angle += p.spin * dt;
        if (p.y >= p.landY && p.blur === 0) {
          p.floating = true; p.waterAge = 0;
          addRipple(p.x, p.y, .19);
        }
        if (p.y > height+100 || p.x < -100) { resetPetal(p); continue; }
      }
    }
    // Surface petals respond to the same wave front used by the shader.
    if (p.floating) {
      for (const r of ripples) {
        const dx = p.x-r.x*width, dy = p.y-r.y*height;
        const d = Math.hypot(dx,dy), age = time-r.start;
        const band = d/height-age*.18;
        const force = Math.exp(-band*band/.0018) * Math.exp(-age*.75) * r.strength * 30;
        p.vx += dx/Math.max(d,1)*force*dt;
        p.vy += dy/Math.max(d,1)*force*dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.exp(-dt*2); p.vy *= Math.exp(-dt*2);
    }
  }
  // Finish all motion before drawing, so insertion order never determines depth.
  resolveFlowerContacts(particles, width, paused ? 0 : dt);
  for (const p of [...particles].sort(compareParticleDepth)) {
    const isBlossom = p.blossomSlot !== undefined;
    const fade = isBlossom ? 1 : p.floating ? Math.min(1, (p.waterLife-p.waterAge)/4) : Math.min(1, (p.y+50)/90);
    const tilt = isBlossom ? .88 : p.floating ? .58 : .42 + Math.abs(Math.sin(breezeTime*.85+p.phase))*.58;
    const bob = p.floating ? Math.sin(breezeTime*1.1+p.phase)*1.3 : 0;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.angle);
    ctx.scale(1, tilt);
    ctx.globalAlpha = p.alpha * Math.max(0, fade);
    if (p.blur) ctx.filter = `blur(${p.blur}px)`;
    if (p.floating) { ctx.shadowColor = '#62505e42'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 3; ctx.shadowOffsetX = 2; }
    const size = isBlossom && width < 700 ? p.size * .7 : p.size;
    ctx.drawImage(isBlossom ? blossom : petal, -size/2, -size/2, size, size);
    ctx.restore();
  }
}

function animate(stamp) {
  frameId = 0;
  if (document.hidden || !ready) return;
  const dt = previous ? Math.min((stamp-previous)/1000, .045) : 0;
  previous = stamp; time += dt;
  if (!paused) breezeTime += dt;
  for (let i = ripples.length-1; i >= 0; i--) if (time-ripples[i].start > LIFE) ripples.splice(i,1);
  if (!paused && time-lastAuto > 5.2) {
    lastAuto = time;
    addRipple(width*(.5+Math.random()*.3), height*(.5+Math.random()*.4), .16);
  }
  renderWater(); drawPetals(dt);
  root.dataset.ripples = String(ripples.length);
  if (!paused || ripples.length) wake();
  else previous = 0;
}

function wake() {
  if (ready && !document.hidden && !frameId) frameId = requestAnimationFrame(animate);
}

function setPaused(value) {
  paused = value;
  pauseButton.textContent = paused ? 'Resume breeze' : 'Pause breeze';
  pauseButton.setAttribute('aria-pressed', String(paused));
  root.dataset.paused = String(paused);
  status.textContent = paused ? 'The breeze is paused. You can still drop a stone.' : 'The breeze is moving again.';
  wake();
}

document.querySelector('#stone').addEventListener('click', () => {
  const x = width * (.56 + Math.random()*.22), y = height*(.5+Math.random()*.25);
  addRipple(x, y, 1.4);
  interactions++;
  root.dataset.interactions = String(interactions);
  status.textContent = `Stone ${interactions} dropped. Ripples spread across the water.`;
});
pauseButton.addEventListener('click', () => setPaused(!paused));
motionQuery.addEventListener('change', e => setPaused(e.matches));

root.addEventListener('pointerdown', e => {
  if (e.target.closest('button, a')) return;
  addRipple(e.clientX, e.clientY, 1.15);
  root.dataset.interactions = String(++interactions);
});
root.addEventListener('pointermove', e => {
  if (e.target.closest('button, a') || paused || performance.now()-lastTrail < 130) return;
  if (e.pointerType === 'touch' && !e.buttons) return;
  lastTrail = performance.now();
  addRipple(e.clientX, e.clientY, e.buttons ? .42 : .19);
});
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { previous = 0; wake(); });
water.addEventListener('webglcontextlost', e => {
  e.preventDefault(); gl = null; program = null;
  water.style.opacity = '0'; root.dataset.renderer = 'canvas'; wake();
});
water.addEventListener('webglcontextrestored', () => { setupWater(); resize(); water.style.opacity = ''; wake(); });

async function start() {
  try {
    await Promise.all([backdrop.decode(), petal.decode(), blossom.decode()]);
    setupWater();
    for (let i=0; i<(width<700 ? 20 : 26); i++) { const p={}; resetPetal(p, true); particles.push(p); }
    particles.push(createBlossom(0), createBlossom(1));
    ready = true;
    root.dataset.state = gl ? 'ready' : 'fallback';
    root.dataset.petals = String(particles.length - 2);
    root.dataset.blossoms = '2';
    resize(); setPaused(paused);
    if (!paused) addRipple(width*.67, height*.68, .55);
  } catch (error) {
    root.dataset.state = 'error';
    status.textContent = 'The scene could not load. Please refresh to try again.';
    document.querySelector('#stone').disabled = true;
    pauseButton.disabled = true;
    console.error('Unable to load blossom artwork', error);
  }
}
start();
