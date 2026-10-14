import { TAU } from '../util.js';
import { theme } from '../theme.js';

// Watercolour-blue bubbles that wobble upwards (during the dive and in the deep).
export class Bubbles {
  constructor() {
    this.list = [];
  }

  spawn(x, y, n = 1, spread = 10) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: x + (Math.random() - 0.5) * spread * 2,
        y: y + (Math.random() - 0.5) * spread,
        r: 1.5 + Math.random() * 4.5,
        vy: -(40 + Math.random() * 70),
        phase: Math.random() * TAU,
        life: 1,
        fade: 0.15 + Math.random() * 0.25,
      });
    }
  }

  update(dt, t) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.y += b.vy * dt;
      b.x += Math.sin(t * 3 + b.phase) * 18 * dt;
      b.life -= dt * b.fade;
      if (b.y < -20 || b.life <= 0) this.list.splice(i, 1);
    }
  }

  draw(ctx, dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1;
    for (const b of this.list) {
      ctx.globalAlpha = Math.min(1, b.life * 2) * 0.7;
      ctx.strokeStyle = theme.bubble;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha *= 0.8;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.4, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
