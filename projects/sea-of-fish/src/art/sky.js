import { TAU } from '../util.js';
import { theme } from '../theme.js';

export function makeStars(r, n, w, h, keep) {
  const stars = [];
  let guard = 0;
  while (stars.length < n && guard++ < n * 40) {
    const x = r() * w;
    const y = r() * h;
    if (!keep(x, y)) continue;
    stars.push({ x, y, s: r.range(1.3, 3.2), rate: r.range(0.8, 2.4), phase: r() * TAU, filled: r() < 0.25 });
  }
  return stars;
}

// Little ink circles that swell and sparkle when the pointer comes close.
export function drawStars(ctx, stars, t, pointer, lw) {
  ctx.strokeStyle = theme.ink;
  ctx.fillStyle = theme.ink;
  ctx.lineCap = 'round';
  for (const s of stars) {
    let rad = s.s * (1 + Math.sin(t * s.rate + s.phase) * 0.22);
    let near = 0;
    if (pointer.active) {
      const d = Math.hypot(s.x - pointer.x, s.y - pointer.y);
      near = Math.max(0, 1 - d / 130);
      rad *= 1 + near * 1.1;
    }
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.arc(s.x, s.y, rad, 0, TAU);
    if (s.filled) ctx.fill();
    ctx.stroke();
    if (near > 0.1) {
      const k = rad * (1.6 + near * 2.2);
      const a = t * 0.6 + s.phase;
      ctx.lineWidth = lw * 0.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = a + (i * TAU) / 4;
        ctx.moveTo(s.x + Math.cos(ang) * rad * 1.5, s.y + Math.sin(ang) * rad * 1.5);
        ctx.lineTo(s.x + Math.cos(ang) * k, s.y + Math.sin(ang) * k);
      }
      ctx.stroke();
    }
  }
}

// A dotted moon whose lit side is drawn like a fingerprint of fine concentric lines.
export function drawMoon(ctx, x, y, r, t, lw) {
  ctx.save();
  ctx.fillStyle = theme.ink;
  const n = Math.floor((TAU * r) / 5.5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, lw * 0.75, 0, TAU);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  const sx = x - r * 0.42 + Math.sin(t * 0.15) * r * 0.04;
  ctx.beginPath();
  ctx.rect(x - r - 4, y - r - 4, r * 2 + 8, r * 2 + 8);
  ctx.arc(sx, y - r * 0.08, r * 0.92, 0, TAU);
  ctx.clip('evenodd');

  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = lw * 0.6;
  const cx = x + r * 0.55;
  const step = Math.max(2.4, r * 0.085);
  for (let rr = step; rr < r * 2.2; rr += step) {
    ctx.beginPath();
    ctx.arc(cx, y, rr, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// The moon doubles as a hidden day/night switch (pages one and two): it swells a little
// under the pointer and gives a small pulse when clicked.
export class Moon {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.hover = 0;
    this.pulse = 0;
    this.hovered = false;
  }

  hit(p) {
    return Math.hypot(p.x - this.x, p.y - this.y) < this.r * 1.35;
  }

  update(dt, pointer) {
    this.hovered = pointer.active && this.hit(pointer);
    this.hover += ((this.hovered ? 1 : 0) - this.hover) * Math.min(1, dt * 8);
    this.pulse = Math.max(0, this.pulse - dt * 2.2);
  }

  draw(ctx, t, lw) {
    const k = 1 + this.hover * 0.1 + Math.sin(this.pulse * Math.PI) * 0.22;
    drawMoon(ctx, this.x, this.y, this.r * k, t, lw);
  }
}

export class ShootingStars {
  constructor() {
    this.list = [];
  }

  spawn(x, y) {
    const a = Math.PI * 0.82 + (Math.random() - 0.5) * 0.3;
    this.list.push({ x, y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1 });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.2;
      if (s.life <= 0) this.list.splice(i, 1);
    }
  }

  draw(ctx, lw) {
    ctx.strokeStyle = theme.ink;
    ctx.fillStyle = theme.ink;
    for (const s of this.list) {
      const len = 0.16;
      ctx.globalAlpha = Math.min(1, s.life * 1.6);
      ctx.lineWidth = lw;
      ctx.setLineDash([lw * 3, lw * 3]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * len, s.y - s.vy * len);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
