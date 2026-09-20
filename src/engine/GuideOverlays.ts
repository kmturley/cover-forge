import type { TemplateConfig } from '../types/template';
import { edgeSegments } from '../templates/geometry';

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
