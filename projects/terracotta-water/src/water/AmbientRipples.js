/** Occasional soft disturbances keep the pool alive when nobody is touching it.
 * Drops land only on wet cells; the mask, not this module, decides where water is.
 */
export function createAmbientRipples(simulation, settings, random = Math.random) {
  let wait = settings.ambientDelay * random();
  return {
    update(dt) {
      wait -= dt;
      if (wait > 0) return;
      wait = settings.ambientDelay * (.45 + random() * 1.1);
      for (let tries = 0; tries < 16; tries++) {
        const strength = settings.ambientStrength * (.55 + random() * .45);
        if (simulation.disturb(random(), random(), strength, settings.pointerRadius * 1.6)) return;
      }
    },
  };
}
