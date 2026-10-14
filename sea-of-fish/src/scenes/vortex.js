import { TAU, clamp, easeOutCubic, lerp, lerpAngle, rng, smoothstep } from '../util.js';
import { WC_BASE, pickWc, tailFrame, view } from '../art/sprites.js';
import { bodyTurn, makeBody, ripple, stepBody, stepRipples } from '../physics.js';
import { theme } from '../theme.js';

// Page three, under the water: watercolour fish wheel around the words in a
// three-armed spiral. Scrolling or moving the pointer quickens the swirl,
// hovering the words draws the circle in, clicking bursts it open.

export class VortexScene {
  constructor(sprites) {
    this.sprites = sprites;
    this.ripples = [];
    this.field = { pointer: { x: 0, y: 0, active: false, r: 120, force: 2600 }, ripples: this.ripples };
    this.spin = 0;
    this.boost = 0;
    this.gather = 0;
  }

  layout(w, h) {
    this.w = w;
    this.h = h;
    this.cx = w * 0.5;
    this.cy = h * 0.48;
    const rMin = clamp(Math.min(w, h) * 0.2, 105, 190);
    const rMax = Math.hypot(w, h) * 0.52;
    this.rMin = rMin;
    const size = clamp(Math.min(w, h) / 820, 0.55, 1.15);
    this.wcPx = 92 * 1.22 * size * view.dpr;
    this.wc = this.sprites.wc(this.wcPx);
    const r = rng(77);
    const count = Math.round(clamp((w * h) / 4600, 90, 300));
    const fish = [];
    for (let i = 0; i < count; i++) {
      const u = r() ** 0.85;
      const rad = lerp(rMin + 14, rMax, u);
      const arm = Math.floor(r() * 3);
      const pick = pickWc(r);
      fish.push({
        rad,
        th: (arm * TAU) / 3 + u * 2.7 + r.gauss() * 0.55,
        k: r.range(0.92, 1.08),
        scale: ((lerp(46, 92, r()) * (0.82 + u * 0.4)) / WC_BASE) * size,
        spr: pick.idx,
        tone: pick.tone,
        alpha: r.range(0.6, 1),
        phase: r() * TAU,
        freq: r.range(3, 5.5),
        breathe: r.range(6, 20),
        tilt: r.range(0.06, 0.22),
        // Where it rises from during the dive.
        sx: r() * w,
        sy: h * r.range(1.15, 1.8),
        delay: r() * 0.35,
        body: makeBody(),
      });
    }
    fish.sort((a, b) => a.tone - b.tone); // pale washes underneath, darkest strokes on top
    this.fish = fish;
  }

  // The watercolour palette depends on the theme; swap atlases without re-laying out.
  refreshTheme() {
    this.wc = this.sprites.wc(this.wcPx);
  }

  click(px, py) {
    this.ripples.push(ripple(px, py, { speed: 520, width: 80, force: 7000, duration: 1.1 }));
    this.boost = Math.min(4, this.boost + 1.2);
  }

  draw(layer, t, dt, input, assemble, scrollVel) {
    view.s = 1;
    view.x = 0;
    view.y = 0;
    const fp = this.field.pointer;
    fp.x = input.x;
    fp.y = input.y;
    fp.active = input.active;

    const dc = input.active ? Math.hypot(input.x - this.cx, input.y - this.cy) : Infinity;
    const gatherTarget = dc < this.rMin * 0.95 ? 1 : 0;
    this.gather += (gatherTarget - this.gather) * Math.min(1, dt * 2);
    const want = Math.min(3.5, Math.abs(scrollVel) * 10 + input.speed * 0.0007);
    this.boost += (Math.max(want, 0) - this.boost) * Math.min(1, dt * (want > this.boost ? 4 : 0.8));
    this.spin += dt * 0.16 * (1 + this.boost + this.gather * 0.8);
    stepRipples(this.ripples, dt);

    const wc = this.wc;
    const pull = 1 - this.gather * 0.07;
    for (const f of this.fish) {
      const a = easeOutCubic(clamp((assemble - f.delay) / (1 - f.delay)));
      if (a <= 0) continue;
      const th = f.th + this.spin * f.k * (this.rMin / f.rad) ** 0.25;
      const rad = (f.rad + Math.sin(t * 0.45 + f.phase) * f.breathe) * pull;
      const ox = this.cx + Math.cos(th) * rad;
      const oy = this.cy + Math.sin(th) * rad;
      const orbitAng = th + Math.PI / 2 + f.tilt + Math.sin(t * 1.3 + f.phase) * 0.07;

      let x = lerp(f.sx, ox, a);
      let y = lerp(f.sy, oy, a);
      let ang = a < 1 ? lerpAngle(Math.atan2(oy - f.sy, ox - f.sx), orbitAng, a * a) : orbitAng;
      if (x < -120 || x > this.w + 120 || y < -120 || y > this.h + 120) continue;

      stepBody(f.body, x, y, this.field, dt);
      x += f.body.ox;
      y += f.body.oy;
      ang += bodyTurn(f.body, ang);

      const frame = wc[f.spr][tailFrame(t, f.freq * (1 + this.boost * 0.3), f.phase)];
      layer.sprite(frame, x, y, ang, f.scale, false, Math.min(1, f.alpha * theme.wcAlpha) * smoothstep(0, 0.35, a));
    }
  }
}
