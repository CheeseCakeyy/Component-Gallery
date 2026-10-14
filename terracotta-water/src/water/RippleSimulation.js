/** Low-resolution masked height field. CPU stepping avoids GPU readback for flowers;
 * the same field is uploaded once per frame for GPU water rendering.
 * Coordinates and coefficients contain no asset-specific landmarks or colors.
 */
export class RippleSimulation {
  constructor(aspect, sampleMask, settings) {
    this.settings = settings;
    this.aspect = aspect;
    this.width = settings.resolution;
    this.height = Math.max(32, Math.round(this.width / aspect));
    this.cellSize = aspect / (this.width - 1);
    const count = this.width * this.height;
    this.current = new Float32Array(count);
    this.previous = new Float32Array(count);
    this.next = new Float32Array(count);
    this.mask = new Uint8Array(count);
    this.sampleMask = sampleMask;
    this.accumulator = 0;
    this.time = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.mask[y * this.width + x] = sampleMask(x / (this.width - 1), y / (this.height - 1)) > 0.8 ? 1 : 0;
      }
    }
  }

  disturb(u, v, strength, radius = this.settings.pointerRadius) {
    if (this.sampleMask(u, v) < 0.8) return false;
    const rx = Math.ceil(radius / this.aspect * this.width * 3);
    const ry = Math.ceil(radius * this.height * 3);
    const cx = Math.round(u * (this.width - 1)), cy = Math.round(v * (this.height - 1));
    for (let y = Math.max(1, cy - ry); y <= Math.min(this.height - 2, cy + ry); y++) {
      for (let x = Math.max(1, cx - rx); x <= Math.min(this.width - 2, cx + rx); x++) {
        const i = y * this.width + x;
        if (!this.mask[i]) continue;
        const dx = (x / (this.width - 1) - u) * this.aspect;
        const dy = y / (this.height - 1) - v;
        // Displace current and previous equally: stable impulse without a dt spike.
        // Zero-volume crest/trough impulse leaves no raised patch behind.
        const d2 = (dx * dx + dy * dy) / (radius * radius);
        const impulse = strength * (1-d2*.5) * Math.exp(-d2*.5);
        this.current[i] += impulse;
        this.previous[i] += impulse;
      }
    }
    return true;
  }

  step(dt) {
    const damping = Math.exp(-this.settings.damping * dt);
    const coefficient = Math.min(0.24, (this.settings.propagation * dt / this.cellSize) ** 2);
    const w = this.width, h = this.height;
    const field = this.current, old = this.previous, next = this.next, mask = this.mask;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) { next[i] = 0; continue; }
      const center = field[i];
      // Zero normal derivative at dry cells reflects waves at the stone boundary.
      const laplacian = (mask[i-1] ? field[i-1] : center) + (mask[i+1] ? field[i+1] : center)
        + (mask[i-w] ? field[i-w] : center) + (mask[i+w] ? field[i+w] : center) - 4 * center;
      next[i] = Math.max(-0.4, Math.min(0.4, center + (center - old[i]) * damping + coefficient * laplacian));
    }
    this.previous = field;
    this.current = next;
    this.next = old;
    this.time += dt;
  }

  update(dt) {
    this.accumulator += Math.min(dt, 0.05);
    while (this.accumulator >= this.settings.fixedStep) {
      this.step(this.settings.fixedStep);
      this.accumulator -= this.settings.fixedStep;
    }
  }

  sampleArray(array, u, v) {
    const x = Math.max(0, Math.min(this.width - 1.001, u * (this.width - 1)));
    const y = Math.max(0, Math.min(this.height - 1.001, v * (this.height - 1)));
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, i = iy * this.width + ix;
    return (array[i] * (1-fx) + array[i+1] * fx) * (1-fy)
      + (array[i+this.width] * (1-fx) + array[i+this.width+1] * fx) * fy;
  }

  heightAt(u, v) { return this.sampleArray(this.current, u, v); }

  microHeight(u, v, time) {
    const x = u * this.aspect, y = 1 - v;
    return .0008 * Math.sin(x * 43 + y * 28 + time * .65)
      + .00055 * Math.sin(x * 31 - y * 47 - time * .48);
  }

  surfaceAt(u, v) {
    return this.heightAt(u, v) + this.microHeight(u, v, this.time);
  }

  sample(u, v, out) {
    const du = 1 / (this.width - 1), dv = 1 / (this.height - 1);
    out.height = this.surfaceAt(u, v);
    out.dx = (this.surfaceAt(u+du, v) - this.surfaceAt(u-du, v)) / (2 * du * this.aspect);
    out.dy = (this.surfaceAt(u, v+dv) - this.surfaceAt(u, v-dv)) / (2 * dv);
    out.velocity = (out.height - this.sampleArray(this.previous, u, v)
      - this.microHeight(u, v, this.time - this.settings.fixedStep)) / this.settings.fixedStep;
    return out;
  }
}
