import { TAU, clamp, rng } from '../util.js';
import { BASE, applyView, pickInk, tailFrame, view } from '../art/sprites.js';
import { theme } from '../theme.js';
import { BOAT_CENTER_Y, BOAT_RADIUS, drawBoat } from '../art/boat.js';
import { Moon, ShootingStars, drawStars, makeStars } from '../art/sky.js';
import { bodyTurn, makeBody, ripple, stepBody, stepRipples } from '../physics.js';

// Page one: a hill of fish, more than half a circle, slowly turning like a tiny planet
// while the red boat rides on top. Rings of fish rotate at slightly different speeds.

export const BOAT_ANGLE = -Math.PI / 2 + 0.1;

export class DomeScene {
  constructor(sprites) {
    this.sprites = sprites;
    this.ripples = [];
    this.shooting = new ShootingStars();
    this.field = { pointer: { x: 0, y: 0, active: false, r: 80, force: 1500 }, ripples: this.ripples };
    this.hop = 0;
    this.hopV = 0;
    this.rock = 0;
  }

  layout(w, h) {
    this.w = w;
    this.h = h;
    // Landscape: an arc from the bottom-left corner to the bottom-right one, rising to
    // half the screen height. Portrait: a wide arc that spills off both edges.
    let R;
    let top;
    if (w < h) {
      R = w * 0.78;
      top = h * 0.5;
    } else {
      const half = w / 2;
      const rise = Math.min(half, h * 0.65);
      R = (rise * rise + half * half) / (2 * rise);
      top = h - rise;
    }
    this.R = R;
    this.cx = w * 0.5;
    this.cy = top + R;
    this.boatScale = clamp(Math.min(R, w * 0.5) * 0.0018, 0.6, 2.4);

    const L = clamp(R * 0.05, 14, 46);
    // Sprites sized for the largest fish here, including the scroll zoom.
    this.ink = this.sprites.ink(L * 1.14 * 1.1 * view.dpr);
    const r = rng(11);
    this.fish = [];
    const step = L * 0.42;
    for (let rad = R - L * 0.24; rad > L * 1.2; rad -= step * r.range(0.94, 1.08)) {
      if (this.cy - rad > h + L) break; // this ring and every inner one sit below the screen
      const omega = -0.05 * r.range(0.72, 1.3);
      const n = Math.floor((TAU * rad) / (L * r.range(1.12, 1.32)));
      const off = r() * TAU;
      for (let j = 0; j < n; j++) {
        this.fish.push({
          rad: rad + r.range(-1.5, 1.5),
          th: off + ((j + r.range(-0.2, 0.2)) * TAU) / n,
          omega,
          scale: (L / BASE) * r.range(0.84, 1.14),
          spr: pickInk(r),
          phase: r() * TAU,
          freq: r.range(4, 8),
          dev: r.range(-0.2, 0.2),
          back: r() < 0.03,
          body: makeBody(),
        });
      }
    }

    const mr = clamp(Math.min(w, h) * 0.045, 20, 46);
    this.moon = w > h ? new Moon(w * 0.8, h * 0.16, mr) : new Moon(w * 0.78, h * 0.33, mr);
    this.stars = makeStars(rng(5), Math.round(clamp((w * h) / 26000, 18, 60)), w, h, (x, y) => {
      if (Math.hypot(x - this.cx, y - this.cy) < R + 24) return false;
      if (Math.hypot(x - this.moon.x, y - this.moon.y) < this.moon.r * 1.8) return false;
      return y < h * 0.95;
    });
  }

  boatPose(t) {
    const rad = this.R + 0.5 + Math.sin(t * 1.6) * 1.1 + this.hop;
    return {
      x: this.cx + Math.cos(BOAT_ANGLE) * rad,
      y: this.cy + Math.sin(BOAT_ANGLE) * rad,
      a: BOAT_ANGLE + Math.PI / 2 + Math.sin(t * 1.1) * 0.04 + this.rock,
    };
  }

  setView(t, zoom) {
    const b = this.boatPose(t);
    const s = 1 + zoom;
    // Kept per scene: other layers reset the shared view later in the frame.
    this.cam = { s, x: b.x * (1 - s), y: b.y * (1 - s) };
    Object.assign(view, this.cam);
  }

  toLocal(px, py) {
    const c = this.cam || { s: 1, x: 0, y: 0 };
    return { x: (px - c.x) / c.s, y: (py - c.y) / c.s };
  }

  // Returns 'moon' when the moon was clicked (main toggles the theme).
  click(px, py, t) {
    const p = this.toLocal(px, py);
    if (this.moon.hit(p)) {
      this.moon.pulse = 1;
      return 'moon';
    }
    const b = this.boatPose(t);
    const s = this.boatScale;
    const bcx = b.x + Math.sin(b.a) * -BOAT_CENTER_Y * s;
    const bcy = b.y - Math.cos(b.a) * -BOAT_CENTER_Y * s;
    if (Math.hypot(p.x - bcx, p.y - bcy) < BOAT_RADIUS * s) {
      if (this.hop < 2) this.hopV = 150;
      this.ripples.push(ripple(b.x, b.y, { force: 3000, duration: 0.9 }));
    } else if (Math.hypot(p.x - this.cx, p.y - this.cy) < this.R + 4) {
      this.ripples.push(ripple(p.x, p.y));
    } else {
      this.shooting.spawn(p.x, p.y);
    }
  }

  // `ctx` is the 2D line-art canvas, `layer` takes the fish, and `boatCtx` is where the
  // boat goes: the front canvas normally (so scattered fish pass behind it), or the back
  // one once the wipe school starts arriving (so it swims over the boat).
  draw(ctx, layer, boatCtx, t, dt, input, zoom) {
    this.setView(t, zoom);
    const ptr = this.toLocal(input.x, input.y);
    const fp = this.field.pointer;
    fp.x = ptr.x;
    fp.y = ptr.y;
    fp.active = input.active;

    // Boat hop + a little lean toward the pointer.
    this.hopV -= 520 * dt;
    this.hop = Math.max(0, this.hop + this.hopV * dt);
    if (this.hop === 0 && this.hopV < 0) this.hopV = 0;
    const lean = input.active ? clamp((ptr.x - this.cx) / this.w, -0.5, 0.5) * 0.12 : 0;
    this.rock += (lean - this.rock) * Math.min(1, dt * 3);

    stepRipples(this.ripples, dt);
    this.shooting.update(dt);
    this.moon.update(dt, fp);

    const lw = 1 / view.s;
    applyView(ctx);
    drawStars(ctx, this.stars, t, fp, lw);
    this.moon.draw(ctx, t, lw);
    this.shooting.draw(ctx, lw);

    // The sea's skin: one fine ink line around the hill.
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.R + 1, 0, TAU);
    ctx.stroke();

    // Visible bounds in scene coords, for culling.
    const x0 = -view.x / view.s - 30;
    const y0 = -view.y / view.s - 30;
    const x1 = x0 + this.w / view.s + 60;
    const y1 = y0 + this.h / view.s + 60;
    const ink = this.ink;

    for (const f of this.fish) {
      const th = f.th + f.omega * t;
      let x = this.cx + Math.cos(th) * f.rad;
      let y = this.cy + Math.sin(th) * f.rad;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      stepBody(f.body, x, y, this.field, dt);
      x += f.body.ox;
      y += f.body.oy;
      let ang = th - Math.PI / 2 + f.dev + Math.sin(t * 1.7 + f.phase) * 0.08;
      if (f.back) ang += Math.PI;
      ang += bodyTurn(f.body, ang);
      layer.sprite(ink[f.spr][tailFrame(t, f.freq, f.phase)], x, y, ang, f.scale, true);
    }

    const b = this.boatPose(t);
    const s = this.boatScale * view.s;
    const dpr = view.dpr;
    const c = Math.cos(b.a) * s * dpr;
    const sn = Math.sin(b.a) * s * dpr;
    boatCtx.setTransform(c, sn, -sn, c, (b.x * view.s + view.x) * dpr, (b.y * view.s + view.y) * dpr);
    drawBoat(boatCtx, t, 1.1 / this.boatScale, { tug: Math.min(1, this.hop / 10) });
  }
}
