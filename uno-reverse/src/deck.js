// Layout, dealing and wave timing. Pure functions so they can be tested in Node.

export const COLS = 13;
export const ROWS = 9;
export const CENTER_COL = 6;
export const CENTER_ROW = 4;

export const STEP_MS = 78; // delay added per card-width of distance from the centre
export const WAVE_START_MS = 560; // the reverse card lands before the wave leaves it
export const FLIP_MS = 640;
export const HERO_MS = 900;

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['s', 'h', 'd', 'c'];

// Pip centres as % of the pip box (x, y); pips below the middle print upside down.
const PIPS = {
  2: [[50, 0], [50, 100]],
  3: [[50, 0], [50, 50], [50, 100]],
  4: [[0, 0], [100, 0], [0, 100], [100, 100]],
  5: [[0, 0], [100, 0], [50, 50], [0, 100], [100, 100]],
  6: [[0, 0], [100, 0], [0, 50], [100, 50], [0, 100], [100, 100]],
  7: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [0, 100], [100, 100]],
  8: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [50, 75], [0, 100], [100, 100]],
  9: [[0, 0], [100, 0], [0, 33.3], [100, 33.3], [50, 50], [0, 66.7], [100, 66.7], [0, 100], [100, 100]],
  10: [[0, 0], [100, 0], [50, 16.7], [0, 33.3], [100, 33.3], [0, 66.7], [100, 66.7], [50, 83.3], [0, 100], [100, 100]],
};

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function pipLayout(rank) {
  return (PIPS[rank] || []).map(([x, y]) => ({ x, y, flip: y > 50 }));
}

const span = (rnd, range) => (rnd() - 0.5) * range;

/**
 * A 13 × 9 field dealt from three shuffled 52-card packs, with the impostor (the
 * reverse card) in the middle. Desktop hides the top and bottom rows; phones hide
 * the three outer columns on each side.
 */
export function buildDeck(seed = 7) {
  const rnd = rng(seed * 9973 + 17);
  const pack = [];
  for (let n = 0; n < 3; n++) for (const suit of SUITS) for (const rank of RANKS) pack.push({ rank, suit });
  for (let i = pack.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pack[i], pack[j]] = [pack[j], pack[i]];
  }

  const cards = [];
  let next = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const isCenter = row === CENTER_ROW && col === CENTER_COL;
      const dx = col - CENTER_COL;
      const dy = row - CENTER_ROW;
      const dist = Math.hypot(dx, dy * 1.15);
      // Three packs means repeats; never let a card sit beside or under its twin.
      const left = col > 0 ? cards[cards.length - 1] : null;
      const above = row > 0 ? cards[cards.length - COLS] : null;
      const twin = (p) => [left, above].some((o) => o && o.rank === p.rank && o.suit === p.suit);
      if (!isCenter) {
        let k = next;
        while (k < pack.length - 1 && twin(pack[k])) k++;
        [pack[next], pack[k]] = [pack[k], pack[next]];
      }
      const { rank, suit } = isCenter ? { rank: '', suit: '' } : pack[next++];
      cards.push({
        id: row * COLS + col,
        row, col, dx, dy, dist, isCenter, rank, suit,
        red: suit === 'h' || suit === 'd',
        court: rank === 'J' || rank === 'Q' || rank === 'K',
        jitter: Math.round(rnd() * 50),
        side: dx < 0 ? 'L' : dx > 0 ? 'R' : rnd() < 0.5 ? 'L' : 'R',
        outerCol: col < 3 || col > 9,
        extraRow: row === 0 || row === ROWS - 1,
        // resting pose, in card widths (em) and degrees
        rz: isCenter ? 0 : span(rnd, 12),
        ox: isCenter ? 0 : span(rnd, 0.1),
        oy: isCenter ? 0 : span(rnd, 0.08),
        z: isCenter ? 0.25 : span(rnd, 0.9),
        // idle float: each card drifts on its own slow cycle
        float: {
          dur: 4.5 + rnd() * 3.5,
          delay: -rnd() * 8,
          lift: 0.04 + rnd() * 0.05,
          depth: 0.05 + rnd() * 0.08,
          rx: 2 + rnd() * 4,
          ry: 2 + rnd() * 5,
        },
        // where the shockwave nudges it when the table turns
        push: isCenter ? { x: 0, y: 0 } : { x: (dx / dist) * 0.16, y: (dy / dist) * 0.16 },
      });
    }
  }
  return cards;
}

export const isVisible = (card, mobile) => (mobile ? !card.outerCol : !card.extraRow);

export function maxDistance(cards, mobile) {
  return cards.reduce((m, c) => (isVisible(c, mobile) ? Math.max(m, c.dist) : m), 0);
}

/**
 * Reversing: the wave ripples outward from the centre. Undoing: it collapses
 * inward and the reverse card turns face-down last.
 */
export function flipDelay(card, reversing, maxDist) {
  if (reversing) return card.isCenter ? 0 : Math.round(WAVE_START_MS + card.dist * STEP_MS + card.jitter);
  return card.isCenter
    ? Math.round(maxDist * STEP_MS + 330)
    : Math.round((maxDist - card.dist) * STEP_MS + card.jitter);
}

export function waveDuration(cards, reversing, mobile) {
  const maxDist = maxDistance(cards, mobile);
  return cards.reduce((end, c) => {
    if (!isVisible(c, mobile)) return end;
    return Math.max(end, flipDelay(c, reversing, maxDist) + (c.isCenter ? HERO_MS : FLIP_MS));
  }, 0);
}
