import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbientRipples } from '../src/water/AmbientRipples.js';

test('ambient drops land only where the simulation accepts water, on a bounded rhythm', () => {
  const drops = [];
  // Left half dry: the simulation rejects those points, as RippleSimulation.disturb does.
  const simulation = { disturb(u, v, strength) { if (u < .5) return false; drops.push({ u, v, strength }); return true; } };
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ambient = createAmbientRipples(simulation, { ambientDelay: 2, ambientStrength: .02, pointerRadius: .01 }, random);
  for (let i = 0; i < 60 * 120; i++) ambient.update(1 / 120);
  assert.ok(drops.length > 20 && drops.length < 70, `unexpected drop count ${drops.length}`);
  assert.ok(drops.every(d => d.u >= .5 && d.strength <= .02 && d.strength > 0));
});
