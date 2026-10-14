// Every interactive fish carries a small spring "body": an offset from where the
// school wants it to be. The pointer and click ripples push the offset, the spring
// pulls it home, so the school scatters and then quietly re-forms.

export const makeBody = () => ({ ox: 0, oy: 0, vx: 0, vy: 0 });

export function stepBody(b, x, y, field, dt) {
  const p = field.pointer;
  const resting = Math.abs(b.ox) + Math.abs(b.oy) + Math.abs(b.vx) + Math.abs(b.vy) < 0.05;
  if (resting && field.ripples.length === 0) {
    // Most of the school is untouched most of the time: skip the spring entirely.
    if (!p.active) return;
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy > p.r * p.r) return;
  }

  let ax = -b.ox * 14 - b.vx * 5;
  let ay = -b.oy * 14 - b.vy * 5;

  if (p.active) {
    const dx = x + b.ox - p.x;
    const dy = y + b.oy - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < p.r * p.r) {
      const d = Math.sqrt(d2) + 0.001;
      const k = 1 - d / p.r;
      const f = k * k * p.force;
      ax += (dx / d) * f;
      ay += (dy / d) * f;
    }
  }

  for (const rp of field.ripples) {
    const dx = x - rp.x;
    const dy = y - rp.y;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
    const band = 1 - Math.abs(d - rp.r) / rp.width;
    if (band > 0) {
      const f = band * rp.force * rp.life;
      ax += (dx / d) * f;
      ay += (dy / d) * f;
    }
  }

  b.vx += ax * dt;
  b.vy += ay * dt;
  b.ox += b.vx * dt;
  b.oy += b.vy * dt;
}

// How much a pushed fish should turn to face the way it is being shoved.
export function bodyTurn(b, angle) {
  const side = Math.cos(angle) * b.vy - Math.sin(angle) * b.vx;
  return Math.max(-0.9, Math.min(0.9, side * 0.004));
}

export function ripple(x, y, opts = {}) {
  return { x, y, r: 0, speed: 420, width: 50, force: 4200, life: 1, duration: 1.2, ...opts };
}

export function stepRipples(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const rp = list[i];
    rp.r += rp.speed * dt;
    rp.life -= dt / rp.duration;
    if (rp.life <= 0) list.splice(i, 1);
  }
}
