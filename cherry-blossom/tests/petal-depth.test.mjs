import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFlowerContacts, compareParticleDepth } from '../dist/petal-depth.mjs';

const flower = () => ({ blossomSlot: 0, x: 100, y: 100, size: 88, floating: true });
const petal = (values = {}) => ({ x: 100, y: 100, size: 30, phase: 0, angle: 0, vx: 0, vy: 0, floating: true, ...values });

test('airborne petal stays above a blossom without a premature collision', () => {
  const f = flower(), p = petal({ floating: false });
  resolveFlowerContacts([p, f], 1440, 1/60);
  assert.equal(p.x, 100);
  assert.equal(p.flowerContact, null);
  assert.deepEqual([p, f].sort(compareParticleDepth), [f, p]);
});

test('center landing stays above flower and slides off without teleporting', () => {
  const f = flower(), p = petal();
  resolveFlowerContacts([p, f], 1440, 1/60);
  assert.equal(p.flowerContact, f);
  assert.ok(p.x > 100 && p.x < 101);
  assert.deepEqual([p, f].sort(compareParticleDepth), [f, p]);
  for (let i = 0; i < 180; i++) resolveFlowerContacts([p, f], 1440, 1/60);
  assert.equal(p.flowerContact, null);
  assert.ok(p.x - f.x >= 88*.36 + 30*.23);
});

test('water petal approaching a flower loses its inward velocity', () => {
  const f = flower(), p = petal({ x: 130, vx: -18 });
  resolveFlowerContacts([p, f], 1440, 1/60);
  assert.equal(p.vx, 0);
  assert.ok(p.x > 130);
});

test('mobile contact radius matches the smaller displayed blossom', () => {
  const f = flower(), p = petal({ x: 135 });
  resolveFlowerContacts([p, f], 390, 0);
  assert.equal(p.flowerContact, null);
  resolveFlowerContacts([p, f], 1440, 0);
  assert.equal(p.flowerContact, f);
  assert.equal(p.x, 135);
});
