import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, pipLayout, flipDelay, maxDistance, waveDuration, isVisible, COLS, ROWS } from './deck.js';

test('deals a full field with exactly one impostor in the middle', () => {
  const cards = buildDeck();
  assert.equal(cards.length, COLS * ROWS);
  const centers = cards.filter((c) => c.isCenter);
  assert.equal(centers.length, 1);
  assert.equal(centers[0].dx, 0);
  assert.equal(centers[0].dy, 0);
});

test('every other card is a real playing card, at most three times (three packs)', () => {
  const counts = new Map();
  for (const c of buildDeck().filter((c) => !c.isCenter)) {
    assert.match(c.rank, /^(A|[2-9]|10|J|Q|K)$/);
    assert.match(c.suit, /^[shdc]$/);
    const key = c.rank + c.suit;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.ok(Math.max(...counts.values()) <= 3);
});

test('no card sits next to or directly under an identical card', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const cards = buildDeck(seed);
    const at = (r, c) => cards[r * COLS + c];
    for (const card of cards) {
      if (card.isCenter) continue;
      for (const [r, c] of [[card.row, card.col + 1], [card.row + 1, card.col]]) {
        if (r >= ROWS || c >= COLS) continue;
        const other = at(r, c);
        assert.ok(other.rank + other.suit !== card.rank + card.suit, `seed ${seed}: twin at ${r},${c}`);
      }
    }
  }
});

test('dealing is deterministic for a seed', () => {
  assert.deepEqual(buildDeck(3).map((c) => c.rank + c.suit), buildDeck(3).map((c) => c.rank + c.suit));
});

test('pip counts match the rank and lower pips are inverted', () => {
  for (let n = 2; n <= 10; n++) assert.equal(pipLayout(String(n)).length, n);
  assert.equal(pipLayout('A').length, 0);
  for (const p of pipLayout('10')) assert.equal(p.flip, p.y > 50);
});

test('both layouts keep the impostor visible and centred', () => {
  for (const mobile of [false, true]) {
    const visible = buildDeck().filter((c) => isVisible(c, mobile));
    assert.ok(visible.some((c) => c.isCenter));
    const cols = new Set(visible.map((c) => c.dx));
    const rows = new Set(visible.map((c) => c.dy));
    assert.equal(Math.min(...cols), -Math.max(...cols));
    assert.equal(Math.min(...rows), -Math.max(...rows));
  }
});

test('reversing ripples outward: centre first, then by distance', () => {
  const cards = buildDeck();
  const md = maxDistance(cards, false);
  const center = cards.find((c) => c.isCenter);
  const others = cards.filter((c) => !c.isCenter);
  assert.equal(flipDelay(center, true, md), 0);
  const near = others.reduce((a, b) => (a.dist < b.dist ? a : b));
  const far = others.reduce((a, b) => (a.dist > b.dist ? a : b));
  assert.ok(flipDelay(near, true, md) < flipDelay(far, true, md));
  assert.ok(Math.min(...others.map((c) => flipDelay(c, true, md))) >= 560);
});

test('undoing collapses inward and the impostor turns last', () => {
  for (const mobile of [false, true]) {
    const cards = buildDeck().filter((c) => isVisible(c, mobile));
    const md = maxDistance(cards, mobile);
    const center = cards.find((c) => c.isCenter);
    const latestOther = Math.max(...cards.filter((c) => !c.isCenter).map((c) => flipDelay(c, false, md)));
    assert.ok(flipDelay(center, false, md) > latestOther);
  }
});

test('wave duration covers the last visible flip', () => {
  const cards = buildDeck();
  assert.ok(waveDuration(cards, true, false) > 1000);
  assert.ok(waveDuration(cards, false, true) > 900);
});
