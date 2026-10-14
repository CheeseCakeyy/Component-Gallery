const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Pixel-space buoyant bodies. Contacts use rounded boxes, not sprite bounds. */
export class IceWorld {
  constructor(width, height) {
    this.contacts = 0;
    this.resize(width, height);
  }

  resize(width, height) {
    const oldWidth = this.width || width, oldHeight = this.height || height;
    this.width = width; this.height = height;
    const mobile = width < 600;
    const base = mobile ? Math.min(width * .61, height * .35) : Math.min(height * .52, width * .36, 440);
    const layout = [[.12,.72,1.08,-.30], [.37,.87,.82,.23], [.87,.76,1.1,.39], [.88,.26,.91,-.23], [.46,.17,.70,.48], [.12,.30,.88,.18]];
    if (!this.bodies) this.bodies = layout.slice(0, mobile ? 5 : 6).map(([x,y,scale,angle], i) => ({
      x: x * width, y: y * height, vx: 0, vy: 0, angle, omega: 0,
      scale, seed: i * 1.83 + .7, front: i === 2 || i === 4, size: base * scale,
      contact: 0,
    }));
    for (const body of this.bodies) {
      body.x *= width / oldWidth; body.y *= height / oldHeight;
      body.vx *= width / oldWidth; body.vy *= height / oldHeight;
      body.size = base * body.scale;
      this.constrain(body);
    }
  }

  constrain(body) {
    const r = body.size * .40;
    const loX = Math.min(r, this.width / 2), hiX = this.width - loX;
    const loY = Math.min(r, this.height / 2), hiY = this.height - loY;
    if (body.x < loX) { body.x = loX; body.vx = Math.max(0, body.vx) * .3; }
    if (body.x > hiX) { body.x = hiX; body.vx = Math.min(0, body.vx) * .3; }
    if (body.y < loY) { body.y = loY; body.vy = Math.max(0, body.vy) * .3; }
    if (body.y > hiY) { body.y = hiY; body.vy = Math.min(0, body.vy) * .3; }
  }

  puppyContact(body, circle, velocity) {
    const c = Math.cos(body.angle), s = Math.sin(body.angle);
    const dx = circle.x - body.x, dy = circle.y - body.y;
    const lx = c * dx + s * dy, ly = -s * dx + c * dy;
    const corner = body.size * .065, core = body.size * .235;
    const qx = clamp(lx, -core, core), qy = clamp(ly, -core, core);
    let nx = lx - qx, ny = ly - qy;
    let distance = Math.hypot(nx, ny);
    let penetration = circle.r + corner - distance;
    if (penetration <= 0) return;
    if (distance < .0001) {
      // A resize or reset can place the puppy inside a cube: pick a stable exit.
      if (core - Math.abs(lx) < core - Math.abs(ly)) { nx = lx >= 0 ? 1 : -1; ny = 0; penetration += core - Math.abs(lx); }
      else { nx = 0; ny = ly >= 0 ? 1 : -1; penetration += core - Math.abs(ly); }
    } else { nx /= distance; ny /= distance; }
    // World normal points away from the puppy and into the cube.
    const wx = -(c * nx - s * ny), wy = -(s * nx + c * ny);
    body.x += wx * penetration * .86;
    body.y += wy * penetration * .86;
    const relative = (body.vx - velocity.x) * wx + (body.vy - velocity.y) * wy;
    if (relative < 0) {
      const impulse = Math.min(420, -relative * 1.18);
      body.vx += wx * impulse; body.vy += wy * impulse;
      const rx = c * qx - s * qy, ry = s * qx + c * qy;
      body.omega += (rx * wy - ry * wx) * impulse / (body.size * body.size * .14);
    }
    body.contact = 1;
    this.contacts++;
  }

  pairContact(a, b) {
    const axes = [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2];
    const dx = b.x - a.x, dy = b.y - a.y;
    let depth = Infinity, nx = 0, ny = 0;
    for (const angle of axes) {
      const x = Math.cos(angle), y = Math.sin(angle);
      const radius = body => body.size * .275 * (Math.abs(Math.cos(angle - body.angle)) + Math.abs(Math.sin(angle - body.angle)));
      const separation = dx * x + dy * y;
      const overlap = radius(a) + radius(b) - Math.abs(separation);
      if (overlap <= 0) return;
      if (overlap < depth) { depth = overlap; nx = x * (separation >= 0 ? 1 : -1); ny = y * (separation >= 0 ? 1 : -1); }
    }
    const massA = a.size * a.size, massB = b.size * b.size;
    const shareA = massB / (massA + massB), shareB = 1 - shareA;
    a.x -= nx * depth * shareA * .7; a.y -= ny * depth * shareA * .7;
    b.x += nx * depth * shareB * .7; b.y += ny * depth * shareB * .7;
    const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (speed < 0) {
      const impulse = -speed * 1.25;
      a.vx -= nx * impulse * shareA; a.vy -= ny * impulse * shareA;
      b.vx += nx * impulse * shareB; b.vy += ny * impulse * shareB;
      const tangent = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
      a.omega += tangent * .06 / a.size; b.omega -= tangent * .06 / b.size;
    }
  }

  step(dt, time, puppy) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    for (let step = 0; step < steps; step++) {
      for (const body of this.bodies) {
        const drag = Math.exp(-h * .72);
        body.vx = (body.vx + Math.sin(time * .47 + body.seed) * 3 * h) * drag;
        body.vy = (body.vy + Math.cos(time * .61 + body.seed) * 4 * h) * drag;
        body.omega = clamp((body.omega + Math.sin(time * .4 + body.seed) * .013 * h) * Math.exp(-h * 1.4), -1.8, 1.8);
        body.x += body.vx * h; body.y += body.vy * h; body.angle += body.omega * h;
        body.contact *= Math.exp(-h * 4);
      }
      for (let iteration = 0; iteration < 3; iteration++) {
        for (let i = 0; i < this.bodies.length; i++) {
          const body = this.bodies[i];
          for (let j = i + 1; j < this.bodies.length; j++) this.pairContact(body, this.bodies[j]);
          if (puppy) {
            const blend = (step + 1) / steps;
            const x = puppy.x - puppy.vx * dt * (1 - blend), y = puppy.y - puppy.vy * dt * (1 - blend);
            const c = Math.cos(puppy.angle), s = Math.sin(puppy.angle);
            for (const [offset, radius] of [[.20, .40], [-.15, .36]]) {
              this.puppyContact(body, { x: x - s * puppy.height * offset, y: y + c * puppy.height * offset, r: puppy.width * radius }, { x: puppy.vx, y: puppy.vy });
            }
          }
          this.constrain(body);
        }
      }
    }
  }
}
