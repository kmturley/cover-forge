import type { TemplateConfig } from '../types/template';
import { edgeSegments, paintRect } from '../templates/geometry';

const SAFETY_MM = 3;

/** Draws cut (solid pink), fold (dashed cyan) and safety (dotted green) guides. `px` converts mm to canvas pixels. */
export function drawGuides(ctx: CanvasRenderingContext2D, t: TemplateConfig, px: number): void {
  const line = Math.max(1, 0.25 * px);
  ctx.save();
  ctx.lineWidth = line;

  for (const s of edgeSegments(t)) {
    ctx.strokeStyle = s.kind === 'cut' ? '#ff2d95' : '#22d3ee';
    ctx.setLineDash(s.kind === 'cut' ? [] : [2 * px, 1.5 * px]);
    ctx.beginPath();
    ctx.moveTo(s.x1 * px, s.y1 * px);
    ctx.lineTo(s.x2 * px, s.y2 * px);
    ctx.stroke();
  }

  // Non-printing marks, e.g. where an NFC tag goes.
  ctx.strokeStyle = '#f59e0b';
  ctx.fillStyle = '#f59e0b';
  ctx.setLineDash([1.5 * px, 1 * px]);
  for (const m of t.marks ?? []) {
    ctx.beginPath();
    ctx.arc(m.xMm * px, m.yMm * px, (m.diameterMm / 2) * px, 0, Math.PI * 2);
    // A dark halo first so the amber ring stays readable over any artwork.
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = line * 3;
    ctx.stroke();
    ctx.restore();
    ctx.stroke();
    ctx.font = `700 ${2.6 * px}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.label, m.xMm * px, m.yMm * px);
  }

  // Safety margin inside each panel.
  ctx.strokeStyle = '#4ade80';
  ctx.setLineDash([0.8 * px, 1.2 * px]);
  for (const p of t.panels) {
    ctx.strokeRect(
      (p.xMm + SAFETY_MM) * px,
      (p.yMm + SAFETY_MM) * px,
      Math.max(0, p.widthMm - SAFETY_MM * 2) * px,
      Math.max(0, p.heightMm - SAFETY_MM * 2) * px,
    );
  }
  ctx.restore();
}

/**
 * Shades the parts that fold away or are glued shut (dust flaps, glue and tuck tabs), which can't be designed because
 * they aren't seen on the finished piece. A preview aid for the 2D editor only; it is never part of an export.
 */
export function drawAssemblyHatch(ctx: CanvasRenderingContext2D, t: TemplateConfig, px: number): void {
  for (const p of t.panels) {
    if (!p.follows) continue;
    const a = paintRect(t, p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.xMm * px, a.yMm * px, a.widthMm * px, a.heightMm * px);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(a.xMm * px, a.yMm * px, a.widthMm * px, a.heightMm * px);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, 0.3 * px);
    const step = 2.5 * px;
    const [x0, y0, w, h] = [a.xMm * px, a.yMm * px, a.widthMm * px, a.heightMm * px];
    ctx.beginPath();
    for (let d = -h; d < w; d += step) {
      ctx.moveTo(x0 + d, y0 + h);
      ctx.lineTo(x0 + d + h, y0);
    }
    ctx.stroke();
    if (p.widthMm >= 18 && p.heightMm >= 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `600 ${Math.min(2.6, p.widthMm / 9) * px}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Folds away', (p.xMm + p.widthMm / 2) * px, (p.yMm + p.heightMm / 2) * px);
    }
    ctx.restore();
  }
}
