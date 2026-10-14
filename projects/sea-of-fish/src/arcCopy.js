import { clamp } from './util.js';

// Page-one words set along the rim of the fish hill: the title climbs the left shoulder
// up to the boat, the paragraph runs down the right shoulder on concentric arcs.
// Built as SVG textPath from the dome's real geometry, rebuilt on resize.

const NS = 'http://www.w3.org/2000/svg';
const TITLE = ['A SEA', '~ of ~', 'SMALL LIVES'];
const BODY = 'Look closer. The ocean is not water at all — it is ten thousand small hearts, all swimming the same way home.';

function el(name, attrs = {}, text) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

// Clockwise arc (screen coords) of radius r from angle a0 to a1.
function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  return `M ${p(a0)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${p(a1)}`;
}

// Split words into at most `n` lines of roughly equal length.
function balance(text, n) {
  const target = text.length / n;
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && next.length > target + 3 && lines.length < n - 1) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  lines.push(cur);
  return lines;
}

export class ArcCopy {
  constructor(svg) {
    this.svg = svg;
    this.group = null;
  }

  // Curved only when the hill's shoulders are on screen (landscape).
  layout(w, h, dome, boatAngle) {
    const svg = this.svg;
    svg.replaceChildren();
    this.curved = w >= h * 1.1;
    if (!this.curved) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const { cx, cy, R, boatScale: bs } = dome;
    const top = -Math.PI / 2;
    const titleSize = clamp(R * 0.085, 36, 124);
    const bodySize = clamp(R * 0.027, 17, 32);
    const lineH = bodySize * 1.2;

    const defs = el('defs');
    const g = el('g');
    svg.append(defs, g);
    this.group = g;

    // Title: ends just short of the fishing rod, which reaches back ~75 boat units.
    const titleEnd = boatAngle - (78 * bs + titleSize * 0.3) / R;
    const titleR = R + titleSize * 0.22;
    defs.append(el('path', { id: 'arc-title', d: arcPath(cx, cy, titleR, -Math.PI, titleEnd) }));
    const title = el('text', { class: 'arc-title', 'font-size': titleSize.toFixed(1) });
    const tp = el('textPath', { href: '#arc-title', startOffset: '100%', 'text-anchor': 'end' });
    tp.append(
      el('tspan', {}, `${TITLE[0]} `),
      // Lift the little "of" toward the letters' middle, then drop back to the baseline.
      el('tspan', { class: 'arc-of', 'font-size': (titleSize * 0.36).toFixed(1), dy: (-titleSize * 0.2).toFixed(1) }, ` ${TITLE[1]} `),
      el('tspan', { dy: (titleSize * 0.2).toFixed(1) }, ` ${TITLE[2]}`),
    );
    title.append(tp);
    g.append(title);

    // Paragraph: starts past the lookout's pointing arm, first line on the outermost arc.
    const lines = balance(BODY, 3);
    const start = boatAngle + (70 * bs + bodySize) / R;
    lines.forEach((line, i) => {
      // Clear of the outermost fish (they poke ~half a fish past the rim) and descenders.
      const r = R + bodySize * 1.1 + (lines.length - 1 - i) * lineH;
      const id = `arc-body-${i}`;
      defs.append(el('path', { id, d: arcPath(cx, cy, r, start, top + Math.PI * 0.49) }));
      const text = el('text', { class: 'arc-body', 'font-size': bodySize.toFixed(1) });
      text.append(el('textPath', { href: `#${id}` }, line));
      g.append(text);
    });
  }

  // Follow the hill's scroll zoom so the words stay glued to the rim.
  follow(view) {
    if (this.group) this.group.setAttribute('transform', `matrix(${view.s} 0 0 ${view.s} ${view.x} ${view.y})`);
  }
}
