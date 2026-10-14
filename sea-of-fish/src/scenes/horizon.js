import { TAU, clamp, rng, smoothstep } from '../util.js';
import { BASE, applyView, drawSprite, pickInk, tailFrame, view } from '../art/sprites.js';
import { theme } from '../theme.js';
import { BOAT_CENTER_Y, BOAT_RADIUS, drawBoat } from '../art/boat.js';
import { Moon, ShootingStars, drawStars, makeStars } from '../art/sky.js';
import { bodyTurn, makeBody, ripple, stepBody, stepRipples } from '../physics.js';

// Page two: the hill has flattened into a horizon and the camera has come in close
// on the boat. The sea is rows of fish, tiny at the horizon and big up front,
// sliding past each other. Rows continue far below the screen for the dive.
//
// Without WebGL (2D fallback), the far rows, which hold most of the fish at a few pixels
// each, are painted once into a looping strip and slid sideways. A strip row switches
// back to live fish while the pointer or a ripple is near it, so it can still scatter.

const STRIP_BELOW = 0.55; // rows whose fish are smaller than this (× Lb) become strips

export class HorizonScene {
  constructor(sprites) {
    this.sprites = sprites;
    this.ripples = [];
    this.shooting = new ShootingStars();
    this.field = { pointer: { x: 0, y: 0, active: false, r: 95, force: 1700 }, ripples: this.ripples };
    this.jumpers = [];
    this.rand = rng(77);
    this.splashes = [];
    this.rock = 0;
    this.tug = 0;
    this.useStrips = true; // main turns this off when the WebGL fish layer is available
  }

  layout(w, h) {
    this.w = w;
    this.h = h;
    const yH = h * (w > h ? 0.58 : 0.5);
    this.yH = yH;
    this.boatX = w * 0.47;
    this.boatScale = clamp(Math.min(w * 0.0026, h * 0.0042), 1.25, 3.4);

    const Lb = clamp(Math.min(w, h * 1.4) * 0.05, 24, 58);
    this.inkBig = this.sprites.ink(Lb * 1.35 * 1.12 * view.dpr);
    this.inkSmall = this.sprites.ink(Lb * STRIP_BELOW * 1.12 * view.dpr);
    const r = rng(41);
    this.rows = [];
    let y = yH + 2;
    const depthEnd = yH + (h - yH) + h * 1.45;
    while (y < depthEnd) {
      const depth = (y - yH) / (h - yH);
      const s = 0.2 + Math.min(depth, 1.35) * 0.85;
      const L = Lb * s;
      const dir = r() < 0.36 ? 1 : -1;
      const margin = L * 2;
      const span = w + margin * 2;
      const fish = [];
      for (let x = r() * L; x < span; x += L * r.range(1.15, 1.7)) {
        fish.push({
          x0: x,
          jy: r.range(-0.12, 0.12) * L,
          scale: (L / BASE) * r.range(0.85, 1.12),
          spr: pickInk(r),
          phase: r() * TAU,
          freq: r.range(5, 9),
          dev: r.range(-0.08, 0.08),
          body: makeBody(),
        });
      }
      const row = { y, L, s, span, margin, speed: (10 + 34 * s) * dir * r.range(0.8, 1.2), phase: r() * TAU, fish, liveUntil: 0 };
      if (s < STRIP_BELOW && this.useStrips) row.strip = this.buildStrip(row);
      this.rows.push(row);
      y += L * 0.34;
    }

    const mr = clamp(Math.min(w, h) * 0.06, 24, 62);
    this.moon = w > h ? new Moon(w * 0.13, h * 0.18, mr) : new Moon(w * 0.2, h * 0.3, mr);
    this.stars = makeStars(rng(9), Math.round(clamp((w * h) / 22000, 20, 70)), w, yH - 20, (x, sy) => {
      if (Math.hypot(x - this.moon.x, sy - this.moon.y) < this.moon.r * 1.7) return false;
      return Math.abs(x - this.boatX) > 70 * this.boatScale || sy < yH - 60 * this.boatScale;
    });
  }

  buildStrip(row) {
    const hgt = row.L * 0.8 + 6;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(row.span * view.dpr);
    cv.height = Math.ceil(hgt * view.dpr);
    const c = cv.getContext('2d');
    const saved = { s: view.s, x: view.x, y: view.y };
    view.s = 1;
    view.x = 0;
    view.y = hgt / 2;
    const dirAng = row.speed < 0 ? Math.PI : 0;
    for (const f of row.fish) {
      // Fish near either end are also painted wrapped, so the loop is seamless.
      for (const off of [-row.span, 0, row.span]) {
        const x = f.x0 + off;
        if (x < -row.L || x > row.span + row.L) continue;
        drawSprite(c, this.inkSmall[f.spr][2], x, f.jy, dirAng + f.dev, f.scale, true);
      }
    }
    Object.assign(view, saved);
    return { canvas: cv, hgt };
  }

  rowDisturbed(row) {
    const fp = this.field.pointer;
    if (fp.active && Math.abs(fp.y - row.y) < fp.r + row.L) return true;
    for (const rp of this.ripples) if (Math.abs(rp.y - row.y) < rp.r + rp.width) return true;
    return false;
  }

  boatPose(t) {
    return { x: this.boatX, y: this.yH + 1 + Math.sin(t * 1.2) * 1.6, a: Math.sin(t * 0.9) * 0.03 + this.rock };
  }

  setView(camY) {
    // Kept per scene: other layers reset the shared view later in the frame.
    this.cam = { s: 1, x: 0, y: -camY };
    Object.assign(view, this.cam);
  }

  toLocal(px, py) {
    const c = this.cam || { s: 1, x: 0, y: 0 };
    return { x: (px - c.x) / c.s, y: (py - c.y) / c.s };
  }

  rowAt(y) {
    let best = this.rows[0];
    for (const row of this.rows) if (row.y <= y) best = row;
    return best;
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
    if (Math.hypot(p.x - b.x, p.y - (b.y + BOAT_CENTER_Y * s)) < BOAT_RADIUS * s) {
      // A tug on the line: something leaps out right by the boat.
      this.tug = 1;
      this.jump(b.x - 72 * s, this.yH + 8, 1.3);
      return;
    }
    if (p.y > this.yH) {
      this.ripples.push(ripple(p.x, p.y, { force: 3600 }));
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.jump(p.x + (Math.random() - 0.5) * 40, p.y, 1);
    } else {
      this.shooting.spawn(p.x, p.y);
    }
  }

  jump(x, y, boost) {
    const row = this.rowAt(y);
    const s = row.s;
    const height = (70 + Math.random() * 90) * s * boost;
    const g = 900 * s;
    this.jumpers.push({
      x,
      y,
      y0: y,
      vx: (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 80) * s,
      vy: -Math.sqrt(2 * g * height),
      g,
      scale: (row.L / BASE) * 1.05,
      spr: pickInk(this.rand),
      s,
    });
  }

  updateJumpers(dt) {
    for (let i = this.jumpers.length - 1; i >= 0; i--) {
      const j = this.jumpers[i];
      j.vy += j.g * dt;
      j.x += j.vx * dt;
      j.y += j.vy * dt;
      if (j.vy > 0 && j.y > j.y0) {
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI * (0.15 + Math.random() * 0.7);
          const v = (60 + Math.random() * 120) * j.s;
          this.splashes.push({ x: j.x, y: j.y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: j.g, life: 1, r: 1 + Math.random() * 1.6 * j.s });
        }
        this.ripples.push(ripple(j.x, j.y0, { force: 1800, duration: 0.8, speed: 260 }));
        this.jumpers.splice(i, 1);
      }
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.vy += s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 2.2;
      if (s.life <= 0) this.splashes.splice(i, 1);
    }
  }

  // `ctx`: 2D line art (sky, boat), `layer`: fish, `fx`: front 2D canvas (splashes).
  draw(ctx, layer, fx, t, dt, input, camY, td) {
    const { w, h, yH } = this;
    this.setView(camY);
    const ptr = this.toLocal(input.x, input.y);
    const fp = this.field.pointer;
    fp.x = ptr.x;
    fp.y = ptr.y;
    fp.active = input.active && ptr.y > yH - 10;

    const lean = input.active ? clamp((ptr.x - this.boatX) / w, -0.5, 0.5) * 0.1 : 0;
    this.rock += (lean - this.rock) * Math.min(1, dt * 2.5);
    this.tug = Math.max(0, this.tug - dt * 1.5);

    stepRipples(this.ripples, dt);
    this.shooting.update(dt);
    this.moon.update(dt, { x: ptr.x, y: ptr.y, active: input.active && camY < yH });
    this.updateJumpers(dt);

    const fadeAll = 1 - smoothstep(0.7, 1, td);
    ctx.globalAlpha = fadeAll;
    const lw = 1;
    const dpr = view.dpr;
    applyView(ctx);

    // Sky, only while it is on screen.
    if (camY < yH + 20) {
      drawStars(ctx, this.stars, t, { x: ptr.x, y: ptr.y, active: input.active }, lw);
      this.moon.draw(ctx, t, lw);
      this.shooting.draw(ctx, lw);
      ctx.globalAlpha = fadeAll;

      // A flat horizon now, with the slightest swell.
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = yH + Math.sin(x * 0.02 + t * 1.3) * 0.6;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const b = this.boatPose(t);
      const s = this.boatScale;
      const c = Math.cos(b.a) * s * dpr;
      const sn = Math.sin(b.a) * s * dpr;
      ctx.setTransform(c, sn, -sn, c, (b.x + view.x) * dpr, (b.y + view.y) * dpr);
      drawBoat(ctx, t, 1.25 / s, { tug: this.tug, wind: this.rock * 20 });
    }
    ctx.globalAlpha = 1;

    const top = camY - 40;
    const bottom = camY + h + 60;
    for (const row of this.rows) {
      if (row.y < top || row.y > bottom) continue;
      const deep = 1 - smoothstep(h * 0.8, h * 1.7, row.y - yH);
      if (deep <= 0.01) continue;
      const alpha = deep * fadeAll;
      const dirAng = row.speed < 0 ? Math.PI : 0;
      const shift = row.speed * t;
      const strip = row.strip;
      if (strip) {
        if (this.rowDisturbed(row)) row.liveUntil = t + 1.5;
        if (t > row.liveUntil) {
          const X = (((shift % row.span) + row.span) % row.span) - row.margin;
          const sy = (row.y + view.y - strip.hgt / 2) * dpr;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = alpha;
          ctx.drawImage(strip.canvas, X * dpr, sy);
          ctx.drawImage(strip.canvas, (X - row.span) * dpr, sy);
          ctx.globalAlpha = 1;
          continue;
        }
      }
      // Live strip rows match their painted strip exactly (straight tail, no bob) so the swap is invisible.
      const ink = row.s < STRIP_BELOW ? this.inkSmall : this.inkBig;
      for (const f of row.fish) {
        let x = (((f.x0 + shift) % row.span) + row.span) % row.span - row.margin;
        let y = row.y + f.jy;
        if (!strip) y += Math.sin(x * 0.012 + t * 1.4 + row.phase) * 1.6 * row.s;
        if (x < -row.L || x > w + row.L) continue;
        stepBody(f.body, x, y, this.field, dt);
        x += f.body.ox;
        y += f.body.oy;
        let ang = dirAng + f.dev;
        if (!strip) ang += Math.sin(t * 1.5 + f.phase) * 0.06;
        ang += bodyTurn(f.body, ang);
        const pose = strip ? 2 : tailFrame(t, f.freq, f.phase);
        layer.sprite(ink[f.spr][pose], x, y, ang, f.scale, true, alpha);
      }
    }

    for (const j of this.jumpers) {
      const ang = Math.atan2(j.vy, j.vx);
      layer.sprite(this.inkBig[j.spr][tailFrame(t, 14, 0)], j.x, j.y, ang, j.scale, true, fadeAll);
    }
    applyView(fx);
    fx.fillStyle = theme.ink;
    for (const s of this.splashes) {
      fx.globalAlpha = Math.max(0, s.life) * fadeAll;
      fx.beginPath();
      fx.arc(s.x, s.y, s.r, 0, TAU);
      fx.fill();
    }
    fx.globalAlpha = 1;
  }
}
