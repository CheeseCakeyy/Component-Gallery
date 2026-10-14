import { theme } from '../theme.js';

// The little red boat, drawn in local units: waterline at y = 0, hull ~120 long,
// bow to the right. Caller sets the transform; `lw` is the ink width in local units.

function shape(ctx, pts, fill, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.stroke();
}

function head(ctx, x, y, r, lw) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.head;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.stroke();
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export function drawBoat(ctx, t, lw, opts = {}) {
  const wind = Math.sin(t * 1.3) * 1.2 + (opts.wind || 0);
  const point = Math.sin(t * 0.8) * 0.8;
  const tug = opts.tug || 0;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = lw;

  // Fishing rod over the stern, line dropping into the fish.
  const tipX = -66;
  const tipY = -54 + tug * 4;
  line(ctx, -36, -24, tipX, tipY);
  ctx.lineWidth = lw * 0.55;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo(-74 + wind, -24, -72 + wind * 1.6, 8 + tug * 3);
  ctx.stroke();
  ctx.lineWidth = lw;

  // Stern: someone fishing, hair caught by the wind.
  shape(ctx, [-39, -15, -29, -15, -30.5, -29, -37, -29], '#2f6cb8', lw);
  line(ctx, -31, -26, -37, -24);
  head(ctx, -33.5, -34.5, 3.8, lw);
  ctx.beginPath();
  ctx.moveTo(-30, -36.5);
  ctx.quadraticCurveTo(-33, -40.2, -37, -36.5);
  ctx.quadraticCurveTo(-43 - wind * 1.4, -34, -48 - wind * 2.2, -27.5);
  ctx.quadraticCurveTo(-42, -30, -36.6, -31.5);
  ctx.closePath();
  ctx.fillStyle = '#1d3a6b';
  ctx.fill();
  ctx.stroke();

  // Middle: a small passenger peeking over the side.
  shape(ctx, [-3, -15, 5, -15, 4, -23, -2, -23], '#45b0a5', lw);
  head(ctx, 1, -26.6, 3.2, lw);

  // Bow: the lookout, pointing the way.
  line(ctx, 22, -15, 23, -28);
  line(ctx, 27, -15, 26, -28);
  shape(ctx, [20.5, -27, 28.5, -27, 27.5, -42, 21.5, -42], '#253f7c', lw);
  line(ctx, 22, -39, 20.5, -31);
  line(ctx, 27, -39.5, 39, -43 + point);
  head(ctx, 24.5, -46.5, 4, lw);
  ctx.beginPath();
  ctx.arc(24.5, -47.2, 4.1, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.fillStyle = '#1d2838'; // the lookout's cap stays dark in both themes
  ctx.fill();

  // Hull.
  ctx.beginPath();
  ctx.moveTo(-56, -15);
  ctx.lineTo(64, -21);
  ctx.quadraticCurveTo(58, -4, 44, 0);
  ctx.lineTo(-46, 0);
  ctx.quadraticCurveTo(-54, -4, -56, -15);
  ctx.closePath();
  ctx.fillStyle = '#b8323f';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#8a2232';
  ctx.beginPath();
  ctx.moveTo(-60, -15.2);
  ctx.lineTo(66, -21.3);
  ctx.lineTo(66, -16.5);
  ctx.lineTo(-60, -11);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = lw * 0.7;
  line(ctx, -52, -6, 56, -9.5);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-56, -15);
  ctx.lineTo(64, -21);
  ctx.quadraticCurveTo(58, -4, 44, 0);
  ctx.lineTo(-46, 0);
  ctx.quadraticCurveTo(-54, -4, -56, -15);
  ctx.closePath();
  ctx.lineWidth = lw;
  ctx.stroke();
}

// Rough hit area in local units, for clicks.
export const BOAT_CENTER_Y = -22;
export const BOAT_RADIUS = 62;
