import { clamp, rng, smoothstep } from '../util.js';
import { BASE, pickInk, tailFrame, view } from '../art/sprites.js';

// The hand-off between page one and two: a great school pours in from the right,
// packs the whole screen, turns as one, and streams back out to the right.
// Driven entirely by `tw` (0..1), so it scrubs both ways with the scroll.

// Tuning. Both are shares (0..1), so any values stay seamless; how slow the whole
// transition feels is set by its scroll length (P.wipeA..P.wipeB in main.js).
const HOLD = 0.12; // share of the transition where the full school just hovers, covering the screen
const STAGGER = 0.5; // share of each half spent spreading out start times; the rest is each fish's swim

// Derived phase boundaries: arrive in [0, ARRIVE], hover, leave in [LEAVE, 1].
const ARRIVE = (1 - HOLD) / 2;
const LEAVE = (1 + HOLD) / 2;
const SPREAD = ARRIVE * STAGGER; // range of start delays (tw units)
const SWIM = ARRIVE - SPREAD; // one fish's crossing time (tw units), the same for every fish
const JITTER = Math.min(0.035, SPREAD * 0.3);
const LAG = SWIM * 0.25; // paper is pulled back this long after a column of fish starts leaving

// Gentle at both ends, so nobody darts.
const ease = (t) => t * t * (3 - 2 * t);

export class WipeScene {
  constructor(sprites) {
    this.sprites = sprites;
  }

  layout(w, h) {
    this.w = w;
    this.h = h;
    const r = rng(23);
    const L0 = clamp(Math.min(w, h) * 0.075, 34, 70);
    this.L0 = L0;
    this.ink = this.sprites.ink(L0 * 1.2 * view.dpr);
    const gx = L0 * 0.62;
    const gy = L0 * 0.3;
    const fish = [];
    let row = 0;
    for (let y = -gy; y < h + gy; y += gy, row++) {
      for (let x = -gx * 0.5; x < w + gx; x += gx) {
        const rx = x + (row % 2) * gx * 0.5 + r.range(-0.4, 0.4) * gx;
        const ry = y + r.range(-0.35, 0.35) * gy;
        const u = clamp(rx / w);
        fish.push({
          rx,
          ry,
          scale: (L0 / BASE) * r.range(0.8, 1.2),
          spr: pickInk(r),
          phase: r() * Math.PI * 2,
          freq: r.range(9, 13),
          // Leftmost destinations set off first (they lead the school in); rightmost leave first.
          d1: (SPREAD - JITTER) * u + r() * JITTER,
          d2: (SPREAD - JITTER) * (1 - u) + r() * JITTER,
          travel: w + L0 * 2 + r() * w * 0.3,
          turn: r() < 0.5 ? -1 : 1,
          wav: r() * 6,
          key: r(),
        });
      }
    }
    fish.sort((a, b) => a.key - b.key); // mixed depths, so colours interleave
    this.fish = fish;
  }

  // True while the paper backing hides everything underneath (see draw()).
  covers(tw) {
    return tw >= ARRIVE && tw <= LEAVE + LAG;
  }

  draw(layer, t, tw) {
    const { w, h, L0 } = this;
    view.s = 1;
    view.x = 0;
    view.y = 0;

    // Paper behind the school while it is packed, so the page swap underneath stays hidden.
    if (tw <= 0.5) {
      layer.rect(0, 0, w, h, smoothstep(ARRIVE - SWIM * 0.25, ARRIVE, tw));
    } else {
      // Pull the paper back from the right, just behind the fish as they depart.
      const reveal = w * (1 - clamp((tw - LEAVE - LAG) / SPREAD));
      layer.rect(0, 0, reveal + L0, h);
    }

    const ink = this.ink;
    for (const f of this.fish) {
      let x;
      let ang;
      let moving;
      if (tw < 0.5) {
        const a = clamp((tw - f.d1) / SWIM);
        if (a <= 0) continue;
        const e = ease(a);
        x = f.rx + (1 - e) * f.travel;
        moving = 1 - e;
        ang = Math.PI;
      } else {
        const b = clamp((tw - LEAVE - f.d2) / SWIM);
        const e = ease(b);
        x = f.rx + e * (w - f.rx + L0 * 1.5 + f.travel * 0.2);
        moving = Math.min(1, b * 2);
        // Turn around during the hover, finishing just as this fish sets off.
        ang = Math.PI + f.turn * smoothstep(LEAVE - HOLD * 0.75 + f.d2, LEAVE + f.d2, tw) * Math.PI;
      }
      if (x < -L0 || x > w + L0) continue;

      // Ride a travelling wave; tilt along its slope.
      const k = 0.008;
      const amp = 5 + 18 * moving;
      const ph = x * k + t * 2.4 + f.wav;
      const y = f.ry + Math.sin(ph) * amp;
      ang += Math.atan(Math.cos(ph) * amp * k);
      ang += Math.sin(t * 2 + f.phase) * 0.05;

      layer.sprite(ink[f.spr][tailFrame(t, f.freq, f.phase)], x, y, ang, f.scale, true);
    }
  }
}
