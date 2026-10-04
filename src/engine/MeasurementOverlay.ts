import type { TemplateConfig } from '../types/template';
import { neighbour } from '../templates/geometry';

export const MEASURE_COLOR = '#ffffff';
const COLOR = MEASURE_COLOR;
/** Panels shorter than this (mm) get no height: there's no room for the label along the line. (Widths always show: a narrow spine's label simply overhangs it.) */
const MIN_HEIGHT_MM = 14;
/** Space (mm) the dimensions need around the cover on the top and left. */
export const MEASURE_MARGIN_MM = 14;
/** Distance of the dimensions from the cover edge (mm). */
const PANEL_ROW_MM = 7;
/** The panels that make up the cover itself; flaps, tucks and the like aren't measured. */
const COVER_PANELS = new Set(['front', 'back', 'spine', 'spineRight']);

/** `12.5` → "12.5 mm", `12` → "12 mm". */
export const formatMm = (mm: number): string => `${Number(mm.toFixed(1))} mm`;

/**
 * One dimension: extension lines at both ends of the measured span, a dimension line between them with arrowheads,
 * and the value centred on it. `(x1,y1)`–`(x2,y2)` is the span (axis-aligned), `off` how far (mm) the dimension line
 * sits from it, perpendicular to the span.
 */
function dimension(ctx: CanvasRenderingContext2D, px: number, x1: number, y1: number, x2: number, y2: number, off: number): void {
  const horizontal = y1 === y2;
  const sign = Math.sign(off) || 1;
  const gap = 0.8 * sign; // extension lines stop just short of the measured edge, and overshoot the dimension line
  const over = 1.2 * sign;
  const a = horizontal ? { x: x1, y: y1 + off } : { x: x1 + off, y: y1 };
  const b = horizontal ? { x: x2, y: y2 + off } : { x: x2 + off, y: y2 };
  const P = (v: number) => v * px;

  ctx.lineWidth = Math.max(1, 0.2 * px);
  ctx.setLineDash([]);
  ctx.beginPath();
  // Extension lines.
  for (const [sx, sy, e] of [[x1, y1, a], [x2, y2, b]] as const) {
    if (horizontal) {
      ctx.moveTo(P(sx), P(sy + gap));
      ctx.lineTo(P(e.x), P(e.y + over));
    } else {
      ctx.moveTo(P(sx + gap), P(sy));
      ctx.lineTo(P(e.x + over), P(e.y));
    }
  }
  // Dimension line.
  ctx.moveTo(P(a.x), P(a.y));
  ctx.lineTo(P(b.x), P(b.y));
  ctx.stroke();

  // Arrowheads, pointing outward at each end.
  const len = horizontal ? x2 - x1 : y2 - y1;
  const dir = Math.sign(len) || 1;
  const head = Math.min(1.8, Math.abs(len) / 4);
  const wing = head * 0.4;
  for (const [pt, d] of [[a, dir], [b, -dir]] as const) {
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(P(pt.x), P(pt.y));
      ctx.lineTo(P(pt.x + d * head), P(pt.y - wing));
      ctx.lineTo(P(pt.x + d * head), P(pt.y + wing));
    } else {
      ctx.moveTo(P(pt.x), P(pt.y));
      ctx.lineTo(P(pt.x - wing), P(pt.y + d * head));
      ctx.lineTo(P(pt.x + wing), P(pt.y + d * head));
    }
    ctx.closePath();
    ctx.fill();
  }

  // The value, on a dark pill so it reads over any artwork.
  const text = formatMm(Math.abs(len));
  const size = 2.8 * px;
  ctx.font = `700 ${size}px Helvetica, Arial, sans-serif`;
  const cx = P((a.x + b.x) / 2);
  const cy = P((a.y + b.y) / 2);
  const w = ctx.measureText(text).width + size * 0.8;
  const h = size * 1.4;
  ctx.save();
  ctx.translate(cx, cy);
  if (!horizontal) ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Draws the dimensions outside the cover, so they never cover the artwork. Each front, back and spine panel's width goes
 * below its own bottom edge, and its height beside its own right edge (only where no panel continues to the right, so a
 * row of panels shows one height at its end). Measuring each panel at its own edge keeps pieces of different sizes, like
 * a jewel case's 118 mm tray card and 120 mm booklet, from landing on the same line. The origin is the cover's
 * top-left, so the caller translates by the margin. `px` converts mm to canvas pixels.
 */
export function drawMeasurements(ctx: CanvasRenderingContext2D, t: TemplateConfig, px: number): void {
  ctx.save();
  ctx.strokeStyle = COLOR;
  ctx.fillStyle = COLOR;
  const panels = t.panels.filter((q) => COVER_PANELS.has(q.id));
  // Under a panel with something attached below it (a flap), the width hangs from the cover's lowest edge instead.
  const lowest = Math.max(...panels.map((p) => p.yMm + p.heightMm));
  for (const p of panels) {
    const y = neighbour(t.panels, p, 'bottom') ? lowest : p.yMm + p.heightMm;
    dimension(ctx, px, p.xMm, y, p.xMm + p.widthMm, y, PANEL_ROW_MM);
    if (p.heightMm >= MIN_HEIGHT_MM && !neighbour(t.panels, p, 'right')) {
      const x = p.xMm + p.widthMm;
      dimension(ctx, px, x, p.yMm, x, p.yMm + p.heightMm, PANEL_ROW_MM);
    }
  }
  ctx.restore();
}
