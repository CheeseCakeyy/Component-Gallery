import { createTypingMetrics } from './typing-metrics.js';

(() => {
  'use strict';
  const canvas = document.querySelector('#world');
  const ctx = canvas.getContext('2d', { alpha: false });
  const stage = document.querySelector('.stage');
  const intro = document.querySelector('.intro');
  const globeCopy = document.querySelector('.globe-copy');
  const controls = document.querySelector('.globe-controls');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const palette = ['#b5da76', '#abaceb', '#f5cd54', '#8cd4ce', '#f19da7'];
  const cream = [255, 246, 223], orange = [243, 107, 44], paper = [233, 232, 225];
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t = clamp(t), t * t * (3 - 2 * t));
  const color = (a, b, t) => `rgb(${a.map((v, i) => Math.round(mix(v, b[i], t))).join(',')})`;
  const keys = [];
  const add = (code, label, upper = '') => keys.push({ code, label, upper });
  add('Escape', 'esc');
  for (let i = 1; i <= 12; i++) add(`F${i}`, `F${i}`);
  add('Backquote', '`', '~');
  '1234567890'.split('').forEach((n, i) => add(`Digit${n}`, n, '!@#$%^&*()'[i]));
  add('Minus', '−', '_'); add('Equal', '=', '+'); add('Backspace', '⌫'); add('Tab', 'tab ⇥');
  'QWERTYUIOP'.split('').forEach(n => add(`Key${n}`, n));
  add('BracketLeft', '[', '{'); add('BracketRight', ']', '}'); add('Backslash', '\\', '|');
  add('CapsLock', 'caps');
  'ASDFGHJKL'.split('').forEach(n => add(`Key${n}`, n));
  add('Semicolon', ';', ':'); add('Quote', "'", '"'); add('Enter', '↵'); add('ShiftLeft', 'shift');
  'ZXCVBNM'.split('').forEach(n => add(`Key${n}`, n));
  add('Comma', ',', '<'); add('Period', '.', '>'); add('Slash', '/', '?'); add('ShiftRight', 'shift');
  add('ControlLeft', 'ctrl'); add('MetaLeft', '⌘'); add('AltLeft', 'alt'); add('Space', 'space');
  add('AltRight', 'alt'); add('MetaRight', '⌘'); add('ControlRight', 'ctrl'); add('ContextMenu', '☰');
  add('ArrowLeft', '←'); add('ArrowUp', '↑'); add('ArrowDown', '↓'); add('ArrowRight', '→');
  ['Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown'].forEach((n, i) => add(n, ['ins', 'home', 'pg up', 'del', 'end', 'pg dn'][i]));
  add('NumLock', 'num');
  for (let i = 0; i <= 9; i++) add(`Numpad${i}`, `${i}`);
  [['Add','+'],['Subtract','−'],['Multiply','×'],['Divide','/'],['Decimal','.'],['Enter','↵']].forEach(([c,l])=>add(`Numpad${c}`,l));
  add('PrintScreen', 'prt sc'); add('ScrollLock', 'scr lk'); add('Pause', 'pause');

  const keyboardRows = [
    ['Escape', ...Array.from({length:12},(_,i)=>`F${i+1}`), ['Delete',2]],
    ['Backquote', ...'1234567890'.split('').map(n=>`Digit${n}`), 'Minus','Equal',['Backspace',2]],
    [['Tab',1.5], ...'QWERTYUIOP'.split('').map(n=>`Key${n}`),'BracketLeft','BracketRight',['Backslash',1.5]],
    [['CapsLock',1.75], ...'ASDFGHJKL'.split('').map(n=>`Key${n}`),'Semicolon','Quote',['Enter',2.25]],
    [['ShiftLeft',2.25], ...'ZXCVBNM'.split('').map(n=>`Key${n}`),'Comma','Period','Slash',['ShiftRight',2.75]],
    [['ControlLeft',1.25],['MetaLeft',1.25],['AltLeft',1.25],['Space',5.25],'AltRight','ControlRight','ArrowLeft','ArrowDown','ArrowUp','ArrowRight']
  ];
  const keyboardTargets = new Map();
  function layoutKeyboard() {
    const space = document.querySelector('.keyboard-space').getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const unit = Math.min(space.width / 15, space.height / 4.6, 65);
    const left = space.left - stageRect.left + (space.width - unit * 15) / 2;
    const top = space.top - stageRect.top + (space.height - unit * 4.6) / 2;
    keyboardRows.forEach((row, r) => {
      let x = 0;
      row.forEach(entry => {
        const [code, units] = Array.isArray(entry) ? entry : [entry, 1];
        keyboardTargets.set(code, {x:left+(x+units/2)*unit,y:top+(r+.5)*unit*.76,w:units*unit-unit*.09,h:unit*(r===0?.5:.66)});
        x += units;
      });
    });
  }

  const tiles = [];
  const rows = 25;
  for (let row = 0; row < rows; row++) {
    const lat = -Math.PI / 2 + (row + .5) * Math.PI / rows;
    const count = Math.max(5, Math.round(Math.cos(lat) * 48));
    for (let col = 0; col < count; col++) {
      const i = tiles.length;
      tiles.push({ i, lat, lon: col / count * Math.PI * 2 + (row % 2) * .058, key: keys[i % keys.length], row, size: .112, flat: null });
    }
  }
  let width = 0, height = 0, dpr = 1, progress = 0, targetProgress = 0;
  let yaw = -.36, pitch = -.15, yawTarget = yaw, pitchTarget = pitch;
  let sphereX, sphereY, radius, lastTime = 0, raf = 0, dragging = null, dragged = false;
  let colorIndex = 0, currentStage = 0, hitAreas = [], noteTimer, uiProgress = -1;
  const active = new Map(), held = new Set();
  const note = document.querySelector('#key-note');
  const arrowButtons = [...document.querySelectorAll('[data-direction]')];
  const history = document.querySelector('#key-history');
  const countLabel = document.querySelector('#key-count');
  const soundToggle = document.querySelector('#sound-toggle');
  let audioContext, clickBuffer, soundEnabled = true, pressCount = 0;
  const typingRoom = document.querySelector('.typing-room');
  const typingScene = document.querySelector('.typing-scene');
  const metrics = createTypingMetrics();
  const typingInput = document.querySelector('#typing-input');
  const passageEl = document.querySelector('#typing-passage');
  const typingStatus = document.querySelector('#typing-status');
  const passages = [
    'the world is full of small wonders. slow down and let your fingers find their rhythm. every new word is another place to begin.',
    'a quiet morning brings a little space to think. follow the light across the room and turn a simple thought into something new.',
    'some journeys start with a single step. this one starts with a single key. take your time and see where the next sentence leads.'
  ];
  let passageIndex = 0, typed = '', attempts = 0, correctAttempts = 0, runStart = 0, elapsed = 0, completed = false;
  const elapsedSeconds = () => (elapsed + (runStart ? performance.now() - runStart : 0)) / 1000;
  function pauseTyping() { if(runStart) elapsed += performance.now()-runStart; runStart=0; }
  function typingStats() {
    const seconds = elapsedSeconds();
    const correct = [...typed].filter((c,i)=>c===passages[passageIndex][i]).length;
    document.querySelector('#typing-wpm').textContent = seconds >= 1 ? Math.round(correct / 5 / (seconds / 60)) : '0';
    document.querySelector('#typing-accuracy').textContent = attempts ? Math.round(correctAttempts / attempts * 100) : '100';
    document.querySelector('#typing-time').textContent = Math.floor(seconds);
    renderCharts(seconds);
  }
  function renderCharts(seconds) {
    const result = metrics.sample(seconds);
    document.querySelector('#chart-error-total').innerHTML=`${result.totalErrors} <small>total</small>`;
    document.querySelector('#chart-wpm-drop').innerHTML=`${result.drop ? '−' : ''}${result.drop} <small>wpm</small>`;
    const points=result.points, first=points[0].second, span=Math.max(9,points.length-1);
    const x=i=>30+i/span*258;
    const ns='http://www.w3.org/2000/svg';
    function el(name,attrs,text) {const node=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v));if(text!==undefined) node.textContent=text;return node;}
    for(const [id,property] of [['error-chart','errors'],['pace-chart','pace']]) {
      const svg=document.querySelector(`#${id}`), isError=property==='errors';
      const max=isError?Math.max(2,...points.map(p=>p.errors)):Math.max(40,Math.ceil(Math.max(...points.map(p=>p.pace))/20)*20);
      const y=value=>104-value/max*84;
      svg.replaceChildren();
      for(const value of [0,max/2,max]) {
        svg.append(el('line',{x1:30,y1:y(value),x2:288,y2:y(value),class:'chart-grid'}));
        svg.append(el('text',{x:23,y:y(value)+3,'text-anchor':'end',class:'chart-label'},Math.round(value)));
      }
      svg.append(el('text',{x:30,y:123,class:'chart-label'},`${first}s`));
      svg.append(el('text',{x:288,y:123,'text-anchor':'end',class:'chart-label'},`${first+span}s`));
      if(isError) {
        points.forEach((p,i)=>{if(p.errors) svg.append(el('rect',{x:x(i)-3,y:y(p.errors),width:6,height:104-y(p.errors),rx:2,class:'error-bar'}));});
        svg.setAttribute('aria-label',`${result.totalErrors} incorrect characters total. Bars show errors in each second of active typing.`);
      } else {
        const path=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(p.pace).toFixed(2)}`).join(' ');
        svg.append(el('path',{d:path,class:'pace-line'}));
        points.forEach((p,i)=>{if(i&&p.pace<points[i-1].pace) svg.append(el('line',{x1:x(i-1),y1:y(points[i-1].pace),x2:x(i),y2:y(p.pace),class:'drop-line'}));});
        const latest=points.at(-1);svg.append(el('circle',{cx:x(points.length-1),cy:y(latest.pace),r:3,class:'pace-dot'}));
        svg.setAttribute('aria-label',`Current 5-second typing pace ${result.pace} WPM. Down ${result.drop} WPM from the previous sample. Declining segments are orange.`);
      }
    }
  }
  function renderTyping() {
    passageEl.replaceChildren();
    let position = 0;
    passages[passageIndex].split(/( )/).forEach(word => {
      const wrapper = document.createElement('span');
      if(word !== ' ') wrapper.className = 'word';
      for(const char of word) {
        const span = document.createElement('span'); span.textContent = char;
        span.className = position < typed.length ? (typed[position]===char ? 'correct' : 'incorrect') : position===typed.length ? 'current' : '';
        wrapper.append(span); position++;
      }
      passageEl.append(wrapper);
    });
    const caret = passageEl.querySelector('.current');
    const wrap = document.querySelector('.passage-wrap');
    if(caret) {
      const relativeTop = caret.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
      if(relativeTop > wrap.clientHeight-35) wrap.scrollTop += relativeTop-wrap.clientHeight+50;
      else if(relativeTop<0) wrap.scrollTop += relativeTop-5;
    }
    typingStats();
  }
  function acceptTyping(value) {
    if(currentStage!==2 || completed) {typingInput.value=typed; return;}
    const target = passages[passageIndex];
    value = value.slice(0,target.length);
    if(value === typed) return;
    if(!runStart && value.length) runStart = performance.now();
    let common = 0;
    while(common < typed.length && common < value.length && typed[common]===value[common]) common++;
    for(let i=common;i<value.length;i++) { attempts++; const correct=value[i]===target[i];if(correct) correctAttempts++;metrics.record(elapsedSeconds(),correct); }
    typed=value; typingInput.value=typed;
    if(typed.length === target.length) {
      completed=true; pauseTyping();
      typingStatus.textContent='Passage complete. Try a new one with ↻.';
    } else typingStatus.textContent='Keep going. Backspace to correct.';
    renderTyping();
  }
  function restartTyping() {
    passageIndex=(passageIndex+1)%passages.length; typed=''; attempts=0; correctAttempts=0; runStart=0; elapsed=0; completed=false;
    metrics.reset();
    typingInput.value=''; document.querySelector('#typing-source').textContent=passages[passageIndex];
    document.querySelector('.passage-wrap').scrollTop=0;
    typingStatus.textContent='Click the words or start typing. Backspace to correct.'; renderTyping();
  }
  function typeKey(code) {
    if(code==='Backspace') {acceptTyping(typed.slice(0,-1)); return;}
    if(code==='Space') {acceptTyping(typed+' '); return;}
    const key=keys.find(k=>k.code===code);
    if(key && key.label.length===1 && !code.startsWith('Arrow')) acceptTyping(typed+key.label.toLowerCase());
  }
  typingInput.addEventListener('input', e => {
    if(e.isComposing) return;
    // Mobile keyboards do not consistently provide physical key codes.
    if(e.data && !held.size) {
      const ch=e.data.slice(-1).toUpperCase();
      const key=keys.find(k=>k.label===ch || (ch===' ' && k.code==='Space'));
      if(key) flash(key.code);
    }
    acceptTyping(typingInput.value);
  });
  document.querySelector('#restart-typing').addEventListener('click', restartTyping);
  document.querySelector('#typing-source').textContent=passages[passageIndex];
  renderTyping();
  setInterval(()=>{if(runStart) typingStats();},1000);

  async function clickSound() {
    if (!soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audioContext) {
        audioContext = new Audio();
        clickBuffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * .045), audioContext.sampleRate);
        const samples = clickBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioContext.sampleRate * .009));
      }
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (!soundEnabled || audioContext.state !== 'running') return;
      const now = audioContext.currentTime;
      const noise = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
      noise.buffer = clickBuffer; noise.playbackRate.value = .9 + Math.random() * .2;
      filter.type = 'highpass'; filter.frequency.value = 650;
      gain.gain.setValueAtTime(.24, now); gain.gain.exponentialRampToValueAtTime(.001, now + .05);
      noise.connect(filter); filter.connect(gain); gain.connect(audioContext.destination);
      noise.start(now); noise.stop(now + .06);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
      const body = audioContext.createOscillator(), bodyGain = audioContext.createGain();
      body.type = 'triangle'; body.frequency.setValueAtTime(190, now); body.frequency.exponentialRampToValueAtTime(75, now + .035);
      bodyGain.gain.setValueAtTime(.11, now); bodyGain.gain.exponentialRampToValueAtTime(.001, now + .04);
      body.connect(bodyGain); bodyGain.connect(audioContext.destination); body.start(now); body.stop(now + .045);
      body.onended = () => { body.disconnect(); bodyGain.disconnect(); };
    } catch { /* Audio availability must never interrupt the keyboard interaction. */ }
  }
  function recordKey(key, shade) {
    if (!pressCount) history.replaceChildren();
    pressCount++;
    const item = document.createElement('li');
    item.textContent = key.label; item.title = key.code; item.style.backgroundColor = shade;
    history.append(item);
    // Keep the recent trail bounded during long sessions; repeated keys remain separate entries.
    if (history.children.length > 200) history.firstElementChild.remove();
    history.scrollTop = history.scrollHeight;
    countLabel.textContent = `${pressCount} ${pressCount === 1 ? 'KEY' : 'KEYS'}`;
  }
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    soundToggle.setAttribute('aria-label', soundEnabled ? 'Mute key sounds' : 'Enable key sounds');
    soundToggle.title = soundEnabled ? 'Mute key sounds' : 'Enable key sounds';
    soundToggle.textContent = soundEnabled ? '♪' : '♪̸';
    if (soundEnabled) clickSound();
  });
  document.querySelector('#clear-keys').addEventListener('click', () => {
    pressCount = 0; history.replaceChildren();
    const empty = document.createElement('li'); empty.className = 'history-empty'; empty.textContent = 'Make a little noise.';
    history.append(empty); countLabel.textContent = 'KEY TRAIL';
  });
  document.addEventListener('click', e => {
    const button = e.target.closest('button,a');
    if (button && button !== soundToggle && !button.hasAttribute('data-direction')) clickSound();
  });

  // A portrait poster layout: partial keyboard ribbons frame an open lower-right corner.
  // These are the same interactive tiles that later gather into the globe.
  function mobilePoster() {
    const points = [];
    function ribbon(cx, cy, radii, start, end, anchorY) {
      radii.forEach((r, row) => {
        const functionRow = row < 2;
        const size = functionRow ? 32 : 37;
        const count = Math.floor((end - start) * r / (size + 6));
        for (let col = 0; col < count; col++) {
          const a = start + (col + .5) * (end - start) / count;
          points.push({ x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r, anchorY,
            angle: a, size, aspect: functionRow ? .60 : 1 });
        }
      });
    }
    ribbon(440, 386, [565, 531, 486, 442, 398, 354], -1.18, -.06, 95);
    ribbon(590, 339, [420, 387, 342, 298, 254, 210], -.22, .88, 95);
    ribbon(513, 558, [355, 324, 280, 236, 192, 148], -1.12, .38, 345);
    ribbon(641, 650, [533, 502, 458, 414, 370], -1.77, -1.28, 650);
    ribbon(-112, 273, [256, 223, 179, 135, 91], 1.58, 2.43, 330);
    // A few isolated modifier keys echo the little detached cluster in the reference.
    for (const [x, y, aspect] of [[-44, 0, 2.4], [0, 0, 2.4], [42, -38, .9], [42, 0, .9], [42, 38, .9]]) {
      points.push({ x: 277 + x * Math.cos(-.43) - y * Math.sin(-.43), y: 850 + x * Math.sin(-.43) + y * Math.cos(-.43), anchorY: 850, angle: -.43, size: 32, aspect });
    }
    const unit = width / 736;
    return points.map(p => ({ ...p, x: p.x * unit, y: p.anchorY * height / 1041 + (p.y - p.anchorY) * unit, size: p.size * unit }));
  }

  function resize() {
    width = stage.clientWidth; height = stage.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mobile = width <= 600;
    const scale = Math.min(width / 1300, height / 780);
    const groups = [[.02,.10,-.62],[.40,-.20,.38],[.86,.01,.27],[1.20,.43,-.45],[.16,.69,-.42],[.45,.22,.6],[-.10,1.12,.45],[.47,1.21,-.55]];
    const poster = mobile ? mobilePoster() : null;
    tiles.forEach(tile => {
      if (poster) {
        tile.flat = poster[tile.i] || { x: -width * (1 + tile.i / tiles.length), y: height * .4, angle: -.4, size: width * .045, aspect: 1 };
        return;
      }
      const group = Math.floor(tile.i / 100) % groups.length;
      const n = tile.i % 100, row = Math.floor(n / 14), col = n % 14;
      const [gx, gy, rotation] = groups[group];
      const a = (col - 6.5) * .102, r = 185 + row * 38;
      const x = Math.sin(a) * r, y = -Math.cos(a) * r + 290;
      tile.flat = { x: gx * width + (x * Math.cos(rotation) - y * Math.sin(rotation)) * scale, y: gy * height + (x * Math.sin(rotation) + y * Math.cos(rotation)) * scale, angle: a + rotation, size: Math.min(34, r * .088) * scale, aspect: row < 2 ? .7 : 1 };
    });
    sphereX = width * (mobile ? .50 : width < 900 ? .58 : .62);
    sphereY = height * (mobile ? .49 : .45);
    radius = mobile ? Math.min(width * .405, height * (height < 650 ? .17 : .22)) : Math.min(width * .27, height * (width < 1100 ? .29 : .325));
    layoutKeyboard();
    onScroll(); wake();
  }
  function onScroll() {
    const distance = document.querySelector('#journey').offsetHeight - innerHeight;
    targetProgress = clamp(scrollY / Math.max(1, distance)) * 2;
    if (reduced.matches) progress = targetProgress;
    wake();
  }
  function gotoStage(index) { window.scrollTo({ top: index / 2 * (document.querySelector('#journey').offsetHeight - innerHeight), behavior: reduced.matches ? 'instant' : 'smooth' }); }
  document.querySelector('#explore').addEventListener('click', () => gotoStage(1));
  document.querySelector('#switch-stage').addEventListener('click', () => gotoStage((currentStage+1)%3));
  document.querySelector('#scroll-cue').addEventListener('click', () => gotoStage((currentStage+1)%3));
  document.querySelector('.wordmark').addEventListener('click', e => { e.preventDefault(); gotoStage(0); });

  function flash(code, record = true) {
    const key = keys.find(k => k.code === code);
    if (!key) return;
    if (!active.has(code) || !held.has(code)) active.set(code, { color: palette[colorIndex++ % palette.length], time: performance.now() });
    else active.get(code).time = performance.now();
    if (record) { recordKey(key, active.get(code).color); clickSound(); }
    note.textContent = `${key.label === ' ' ? 'SPACE' : key.label.toUpperCase()} — A LITTLE COLOR, JUST FOR YOU`;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.textContent = 'YOUR KEYBOARD IS THE CANVAS'; }, 2300);
    wake();
  }
  function rotate(code, step) {
    if (code === 'ArrowLeft') yawTarget -= step;
    if (code === 'ArrowRight') yawTarget += step;
    if (code === 'ArrowUp') pitchTarget -= step;
    if (code === 'ArrowDown') pitchTarget += step;
    pitchTarget = clamp(pitchTarget, -1.2, 1.2); wake();
  }
  window.addEventListener('keydown', e => {
    if(e.target===typingInput) {
      if(!e.isComposing && e.code!=='Unidentified') {flash(e.code,!e.repeat);held.add(e.code);}
      return;
    }
    if (e.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (e.target.closest('button,a') && (e.code === 'Enter' || e.code === 'Space')) return;
    if(currentStage===2 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && (e.key.length===1 || e.code==='Backspace')) {
      e.preventDefault(); acceptTyping(e.code==='Backspace' ? typed.slice(0,-1) : typed+e.key);
    }
    if (currentStage===1 && e.code.startsWith('Arrow')) e.preventDefault();
    if (currentStage===1 && e.code.startsWith('Arrow') && !e.repeat) rotate(e.code, .09);
    if (e.code === 'Space' && e.target === document.body) e.preventDefault();
    flash(e.code, !e.repeat); held.add(e.code);
    arrowButtons.forEach(b => b.classList.toggle('active', held.has(b.dataset.direction)));
  });
  window.addEventListener('keyup', e => {
    held.delete(e.code);
    if (active.has(e.code)) active.get(e.code).time = performance.now();
    arrowButtons.forEach(b => b.classList.toggle('active', held.has(b.dataset.direction))); wake();
  });
  function release() { held.clear(); dragging = null; document.body.classList.remove('dragging'); arrowButtons.forEach(b => b.classList.remove('active')); wake(); }
  window.addEventListener('blur', () => {release();pauseTyping();});
  document.addEventListener('visibilitychange', () => { if (document.hidden) {release();pauseTyping();} else wake(); });
  arrowButtons.forEach(button => {
    button.addEventListener('click', () => { flash(button.dataset.direction); rotate(button.dataset.direction, .28); });
  });
  function inside(x, y, p) {
    let found = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i].y > y) !== (p[j].y > y) && x < (p[j].x - p[i].x) * (y - p[i].y) / (p[j].y - p[i].y) + p[i].x) found = !found;
    return found;
  }
  canvas.addEventListener('pointerdown', e => {
    dragged = false;
    dragging = { x: e.clientX, y: e.clientY, id: e.pointerId, rotate: currentStage===1 && Math.hypot(e.clientX - sphereX, e.clientY - sphereY) < radius * 1.3 };
    if (dragging.rotate) { canvas.setPointerCapture(e.pointerId); document.body.classList.add('dragging'); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.id || !dragging.rotate) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
    yawTarget += dx * .007; pitchTarget = clamp(pitchTarget - dy * .007, -1.2, 1.2);
    dragging.x = e.clientX; dragging.y = e.clientY; wake();
  });
  canvas.addEventListener('pointerup', e => {
    if (!dragged) {
      const hit = [...hitAreas].reverse().find(h => inside(e.clientX, e.clientY, h.points));
      if (hit) {flash(hit.code);if(currentStage===2) typeKey(hit.code);}
    }
    dragging = null; document.body.classList.remove('dragging');
  });
  canvas.addEventListener('pointercancel', release);

  function turn(x, y, z) {
    const a = x * Math.cos(yaw) + z * Math.sin(yaw);
    const b = z * Math.cos(yaw) - x * Math.sin(yaw);
    return { x: a, y: y * Math.cos(pitch) - b * Math.sin(pitch), z: b * Math.cos(pitch) + y * Math.sin(pitch) };
  }
  function project(p) {
    const zoom = 4.8 / (4.8 - p.z);
    return { x: sphereX + p.x * radius * zoom, y: sphereY + p.y * radius * zoom };
  }
  function polygon(p, fill, stroke, line = 1) {
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function updateUI(p, t) {
    const nextStage = p > 1.65 ? 2 : p > .65 ? 1 : 0;
    if (nextStage !== currentStage) {
      if(currentStage===2) {pauseTyping();typingInput.blur();}
      currentStage = nextStage; document.body.classList.toggle('globe', nextStage===1);document.body.classList.toggle('typing',nextStage===2);
      intro.inert = nextStage!==0; controls.inert = nextStage!==1; globeCopy.inert = nextStage!==1;typingScene.inert=nextStage!==2;
      document.querySelector('#stage-number').textContent = `0${nextStage+1}`;
      document.querySelector('#stage-name').textContent = ['THE FIELD','THE WORLD','THE FLOW'][nextStage];
      document.querySelector('#page-count').textContent = `0${nextStage+1}`;
      document.querySelector('#scroll-cue').innerHTML = ['SCROLL TO TRANSFORM <span>↓</span>','SCROLL TO TYPE <span>↓</span>','BACK TO THE FIELD <span>↑</span>'][nextStage];
      document.querySelector('#switch-stage').setAttribute('aria-label', ['Scroll to the keyboard globe','Scroll to the typing exercise','Return to the keyboard field'][nextStage]);
      controls.style.pointerEvents = nextStage===1 ? 'auto' : 'none';
    }
    if (Math.abs(uiProgress - p) < .0002) return;
    uiProgress = p;
    const a = 1 - smooth(p / .32), b = smooth((p - .72) / .25)*(1-smooth((p-1.08)/.28));
    intro.style.opacity = a; intro.style.visibility = a < .01 ? 'hidden' : 'visible';
    intro.style.transform = `translateY(${-35 * (1 - a)}px)`;
    globeCopy.style.opacity = b; controls.style.opacity = b;
    globeCopy.style.visibility=controls.style.visibility=b<.01?'hidden':'visible';
    const typingOpacity=smooth((p-1.6)/.35);
    typingScene.style.opacity=typingOpacity;typingScene.style.visibility=typingOpacity<.01?'hidden':'visible';
    stage.style.color = color(cream, [36, 38, 35], smooth((p - .4) / .4));
    document.querySelector('#progress').style.transform = `scaleX(${p/2})`;
  }
  function drawStand(t) {
    if (t <= 0) return;
    ctx.save(); ctx.globalAlpha = t;
    const groundY = sphereY + radius * 1.43;
    const shadow = ctx.createRadialGradient(sphereX, groundY, 0, sphereX, groundY, radius * .72);
    shadow.addColorStop(0, 'rgba(45,41,33,.18)'); shadow.addColorStop(1, 'rgba(45,41,33,0)');
    ctx.save(); ctx.translate(0, groundY); ctx.scale(1,.2); ctx.translate(0,-groundY);
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(sphereX, groundY, radius * .74, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#30322f'; ctx.lineWidth = Math.max(5,radius * .036); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(sphereX, sphereY, radius * 1.14, radius * 1.14, -.27, -Math.PI * .45, Math.PI * .54); ctx.stroke();
    ctx.lineWidth = radius * .045; ctx.beginPath(); ctx.moveTo(sphereX, sphereY + radius * 1.10); ctx.lineTo(sphereX, groundY - radius * .06); ctx.stroke();
    ctx.fillStyle = '#31332f'; ctx.beginPath(); ctx.ellipse(sphereX, groundY - radius * .025, radius * .34, radius * .066, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#65665e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sphereX, groundY - radius * .04, radius * .32, radius * .043, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function draw(now) {
    raf = 0;
    if (document.hidden) return;
    const dt = Math.min((now - lastTime) / 1000 || .016, .04); lastTime = now;
    progress = reduced.matches ? targetProgress : mix(progress, targetProgress, 1 - Math.exp(-dt * 9));
    if (Math.abs(progress - targetProgress) < .0001) progress = targetProgress;
    if (currentStage===1) held.forEach(code => { if (code.startsWith('Arrow')) rotate(code, dt * 1.25); });
    yaw = mix(yaw, yawTarget, reduced.matches ? 1 : 1 - Math.exp(-dt * 11));
    pitch = mix(pitch, pitchTarget, reduced.matches ? 1 : 1 - Math.exp(-dt * 11));
    const morph = smooth((progress - .08) / .8), solid = smooth((progress - .35) / .54);
    const unfold = smooth((progress - 1.12) / .83);
    const bg = color(orange, paper, smooth((progress - .25) / .65));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); updateUI(progress, morph);
    drawStand(smooth((progress - .76) / .22)*(1-smooth(unfold/.45)));
    // The core closes the tiny gaps between the individually projected keycaps.
    if (solid > .02) {
      ctx.globalAlpha = solid*(1-unfold);
      const g = ctx.createRadialGradient(sphereX - radius * .35, sphereY - radius * .45, 0, sphereX, sphereY, radius * 1.03);
      g.addColorStop(0, '#e4e1d4'); g.addColorStop(.72, '#bbb9ad'); g.addColorStop(1, '#787c71');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sphereX, sphereY, radius * 1.015 * morph, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    const projected = [];
    for (const tile of tiles) {
      const sl = Math.sin(tile.lon), cl = Math.cos(tile.lon), sp = Math.sin(tile.lat), cp = Math.cos(tile.lat);
      const n = { x: cp * sl, y: sp, z: cp * cl };
      const normal = turn(n.x,n.y,n.z);
      const target = keyboardTargets.get(tile.key.code);
      const finalKey = tile.i < keys.length && !!target;
      const globeVisible = 1 - smooth(morph) * (1 - smooth((normal.z + .13) / .28));
      const visible = finalKey ? mix(globeVisible,1,unfold) : globeVisible*(1-smooth(unfold/.85));
      if (visible < .005) continue;
      const right = { x: cl, y: 0, z: -sl };
      const up = { x: -sp * sl, y: cp, z: -sp * cl };
      const size = tile.size / 2;
      const f = tile.flat, ca = Math.cos(f.angle), sa = Math.sin(f.angle);
      const corners = [], base = [];
      const pulse = active.get(tile.key.code);
      const pulseAlpha = pulse ? held.has(tile.key.code) ? 1 : 1 - smooth((now - pulse.time - 450) / 1400) : 0;
      for (const [dx,dy] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
        const flatX = f.x + (dx * ca - dy * sa * f.aspect) * f.size / 2;
        const flatY = f.y + (dx * sa + dy * ca * f.aspect) * f.size / 2;
        const dep = 1.012 - pulseAlpha * .014;
        const top = project(turn(n.x * dep + right.x * dx * size * .90 + up.x * dy * size * .86, n.y * dep + up.y * dy * size * .86, n.z * dep + right.z * dx * size * .90 + up.z * dy * size * .86));
        const bottom = project(turn(n.x * .983 + right.x * dx * size + up.x * dy * size, n.y * .983 + up.y * dy * size, n.z * .983 + right.z * dx * size + up.z * dy * size));
        const tx=target ? target.x+dx*target.w/2 : width/2;
        const ty=target ? target.y+dy*target.h/2 : height*.7;
        corners.push({x:mix(mix(flatX,top.x,morph),tx,unfold),y:mix(mix(flatY,top.y,morph),ty,unfold)});
        base.push({x:mix(mix(flatX,bottom.x,morph),tx,unfold),y:mix(mix(flatY,bottom.y,morph),ty,unfold)});
      }
      if (corners.every(p=>p.x < -60) || corners.every(p=>p.x>width+60) || corners.every(p=>p.y < -60) || corners.every(p=>p.y>height+60)) continue;
      projected.push({ tile, corners, base, z:mix(normal.z,finalKey?2:0,unfold), normal, visible, pulse, pulseAlpha });
    }
    projected.sort((a,b)=>a.z-b.z);
    hitAreas = [];
    for (const p of projected) {
      const {tile,corners,base,normal,visible,pulse,pulseAlpha} = p;
      const headerFade = mix(smooth((tile.flat.y - (width < 600 ? 42 : 70)) / (width < 600 ? 38 : 55)), 1, morph);
      ctx.globalAlpha = visible * headerFade;
      const light = mix(clamp(.71 - normal.x * .12 - normal.y * .15 + normal.z * .18),.94,unfold);
      const relief=solid*(1-unfold);
      if (relief > .01) {
        ctx.globalAlpha=visible*headerFade*(1-unfold);
        const side = color([167,165,151], [119,120,109], 1-light);
        polygon(base, side, null);
        for (let i=0;i<4;i++) { const j=(i+1)%4; polygon([base[i],base[j],corners[j],corners[i]],i===0?'#efecdf':i===3?'#c9c6b9':'#9f9f91',null); }
        ctx.globalAlpha=visible*headerFade;
      }
      const shade = [Math.round(219 + 28 * light),Math.round(218 + 25 * light),Math.round(203 + 25 * light)];
      const face = color(orange, shade, solid);
      const line = color(cream, [113,116,104], solid);
      polygon(corners,relief>.01?face:null,line,mix(1.05,.55,relief));
      if (pulseAlpha > .01) { ctx.globalAlpha = visible*headerFade*pulseAlpha; polygon(corners,pulse.color,null); ctx.globalAlpha = visible*headerFade; }
      const center = {x:corners.reduce((s,v)=>s+v.x,0)/4,y:corners.reduce((s,v)=>s+v.y,0)/4};
      const ex = {x:(corners[1].x-corners[0].x)/2,y:(corners[1].y-corners[0].y)/2};
      const ey = {x:(corners[3].x-corners[0].x)/2,y:(corners[3].y-corners[0].y)/2};
      if (Math.abs(ex.x*ey.y-ex.y*ey.x) > 4) {
        ctx.save(); ctx.transform(ex.x,ex.y,ey.x,ey.y,center.x,center.y);
        ctx.fillStyle = pulseAlpha>.4 ? '#313d38' : color(cream,[48,54,44],solid);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const label = tile.key.label;
        // Long keys keep human-sized labels instead of stretching their letters.
        if(unfold>.99) {
          ctx.restore();ctx.save();ctx.translate(center.x,center.y);
          ctx.fillStyle=pulseAlpha>.4?'#313d38':'#30362d';ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.font=`${Math.max(6,Math.min(12,keyboardTargets.get(tile.key.code).h*.40))}px Arial,sans-serif`;
          ctx.fillText(label,0,0);ctx.restore();
          if(visible>.5) hitAreas.push({code:tile.key.code,points:corners});
          continue;
        }
        ctx.font = `${solid>.5?500:400} ${label.length>3?.47:label.length>1?.58:.78}px Arial,sans-serif`;
        ctx.fillText(label,0,tile.key.upper ? .25 : .06);
        if(tile.key.upper) {ctx.font='.38px Arial,sans-serif';ctx.fillText(tile.key.upper,-.25,-.43);}
        ctx.restore();
      }
      if(visible>.5) hitAreas.push({code:tile.key.code,points:corners});
    }
    ctx.globalAlpha = 1;
    for(const [code,state] of active) if(!held.has(code)&&now-state.time>1900) active.delete(code);
    if(progress!==targetProgress || Math.abs(yaw-yawTarget)>.0001 || Math.abs(pitch-pitchTarget)>.0001 || active.size || held.size || dragging) wake();
  }
  function wake() { if(!raf&&!document.hidden) raf=requestAnimationFrame(draw); }
  window.addEventListener('resize',resize);
  new ResizeObserver(()=>{layoutKeyboard();wake();}).observe(document.querySelector('.keyboard-space'));
  window.addEventListener('scroll',onScroll,{passive:true});
  reduced.addEventListener('change',wake);
  document.fonts.ready.then(wake);
  resize();
})();
