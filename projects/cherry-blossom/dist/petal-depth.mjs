// Surface contacts are separate from airborne overlap: a petal can fly over a
// blossom, but once it reaches the water it must slide off its raised petals.
export function resolveFlowerContacts(particles, width, dt) {
  const flowers = particles.filter(p => p.blossomSlot !== undefined);
  for (const p of particles) {
    if (p.blossomSlot !== undefined) continue;
    p.flowerContact = null;
    if (!p.floating) continue;
    for (const flower of flowers) {
      const flowerSize = flower.size * (width < 700 ? .7 : 1);
      const radius = flowerSize * .36 + p.size * .23;
      const dx = p.x - flower.x, dy = p.y - flower.y;
      const distance = Math.hypot(dx, dy / .78);
      if (distance >= radius) continue;
      p.flowerContact = flower;
      // Keep the landing position, then gently slip down the flower's edge.
      // A deterministic direction also handles a landing exactly at its center.
      const angle = distance < .001 ? p.phase : Math.atan2(dy, dx);
      const nx = Math.cos(angle), ny = Math.sin(angle);
      const inward = p.vx * nx + p.vy * ny;
      if (inward < 0) { p.vx -= nx * inward; p.vy -= ny * inward; }
      p.x += nx * 22 * dt;
      p.y += ny * 22 * dt;
      p.angle += .12 * dt;
      break;
    }
  }
}

export function compareParticleDepth(a, b) {
  const depth = p => !p.floating ? 3 : p.flowerContact ? 2 : p.blossomSlot !== undefined ? 1 : 0;
  const difference = depth(a) - depth(b);
  // Larger, defocused airborne petals are nearest the camera.
  return difference || (!a.floating ? a.size - b.size : a.y - b.y);
}
