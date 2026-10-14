// Every sound is synthesised with Web Audio; there are no sound files.

export class CardAudio {
  muted = false;

  // Must first be called from a user gesture so the browser lets audio start.
  ensure() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  out(pan) {
    if (!this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.master);
    return p;
  }

  env(gain, t, attack, peak, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  noiseHit(t, dest, type, freq, q, attack, peak, decay, rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    this.env(gain, t, attack, peak, decay);
    src.connect(filter).connect(gain).connect(dest);
    src.start(t, Math.random() * 0.5, attack + decay + 0.05);
    return filter;
  }

  thump(t, dest, f0, f1, peak, decay) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.8);
    const gain = this.ctx.createGain();
    this.env(gain, t, 0.002, peak, decay);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  tick() {
    if (!this.ensure()) return;
    this.noiseHit(this.now + 0.01, this.out(0), 'highpass', 4200, 0.7, 0.001, 0.25, 0.02, 1.3);
  }

  /** One card turning over: a fingertip flick, air as it turns, a soft snap as it settles. */
  card(t, dur, pan, vol, far) {
    const o = this.out(pan);
    this.noiseHit(t, o, 'highpass', 3800 + Math.random() * 1500, 0.7, 0.001, vol * 0.5, 0.018, 1.4);
    if (!far) {
      const f = this.noiseHit(t + 0.04, o, 'bandpass', 800, 1.1, dur * 0.35, vol * 0.2, dur * 0.4);
      f.frequency.setValueAtTime(700, t + 0.04);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.04 + dur * 0.45);
    }
    const land = t + dur * 0.9;
    this.noiseHit(land, o, 'bandpass', 1500 + Math.random() * 900, 0.8, 0.002, vol * 0.85, 0.05, 0.95 + Math.random() * 0.3);
    this.thump(land, o, 210, 90, vol * 0.25, 0.05);
  }

  /** The reverse card: a swell that grows into the turn, like a cymbal played backwards. */
  hero(t, dur, reversing) {
    const ctx = this.ctx;
    const o = this.out(0);
    const land = t + dur * 0.9;
    this.noiseHit(t, o, 'highpass', 4200, 0.7, 0.001, 0.35, 0.02, 1.3);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.exponentialRampToValueAtTime(5200, land);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(reversing ? 0.34 : 0.18, land - 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, land + 0.02);
    src.connect(filter).connect(gain).connect(o);
    src.start(t, 0, land - t + 0.06);
    this.noiseHit(land, o, 'bandpass', 1300, 0.7, 0.002, 0.6, 0.09, 0.9);
    this.thump(land, o, 160, 55, 0.45, 0.16);
  }
}
