import test from 'node:test';
import assert from 'node:assert/strict';
import { IceWorld } from './ice-physics.js';

function cube(overrides = {}) {
  return { x: 450, y: 300, size: 180, vx: 0, vy: 0, angle: 0, omega: 0, seed: .7, scale: 1, contact: 0, ...overrides };
}

test('an off-center puppy contact pushes and spins the cube away', () => {
  const world = new IceWorld(1000, 700), body = cube();
  world.puppyContact(body, { x: 350, y: 330, r: 60 }, { x: 180, y: 0 });
  assert.ok(body.x > 450);
  assert.ok(body.vx > 0);
  assert.ok(Math.abs(body.omega) > .01);
  assert.equal(world.contacts, 1);
});

test('a puppy outside the contact surface does not push the cube', () => {
  const world = new IceWorld(1000, 700), body = cube(), before = { ...body };
  world.puppyContact(body, { x: 150, y: 300, r: 60 }, { x: 200, y: 0 });
  assert.deepEqual(body, before);
});

test('cube collisions transfer momentum instead of sticking together', () => {
  const world = new IceWorld(1000, 700), a = cube({x:400,vx:100}), b = cube({x:480});
  world.pairContact(a,b);
  assert.ok(b.vx > 0);
  assert.ok(a.vx < 100);
  assert.ok(b.x - a.x > 80);
  assert.ok(Math.abs(a.vx + b.vx - 100) < 1e-6);
});

test('overlapping centers and long interactions stay finite and in bounds', () => {
  const world = new IceWorld(390, 780);
  world.bodies[0].x = 195; world.bodies[0].y = 450;
  for (let i = 0; i < 900; i++) {
    world.step(1/60, i/60, {x:195 + Math.sin(i/60)*120,y:430,width:190,height:260,vx:Math.cos(i/60)*120,vy:0,angle:0});
    for (const b of world.bodies) {
      assert.ok([b.x,b.y,b.vx,b.vy,b.angle,b.omega].every(Number.isFinite));
      assert.ok(b.x >= 0 && b.x <= world.width && b.y >= 0 && b.y <= world.height);
    }
  }
  assert.ok(world.contacts > 0);
});

test('resizing preserves bodies and keeps them within the new scene', () => {
  const world = new IceWorld(1280,800), first = world.bodies[0];
  world.resize(320,699);
  assert.equal(world.bodies[0],first);
  for (const b of world.bodies) assert.ok(b.x >= 0 && b.x <= 320 && b.y >= 0 && b.y <= 699);
});
