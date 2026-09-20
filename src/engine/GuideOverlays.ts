import type { TemplateConfig } from '../types/template';

const SAFETY_MM = 3;

/** Draws trim, fold and safety guides. `px` converts mm to canvas pixels. */
export function drawGuides(ctx: CanvasRenderingContext2D, t: TemplateConfig, px: number): void {
  const line = Math.max(1, 0.25 * px);
  ctx.save();
  ctx.lineWidth = line;

  // Trim edge (where the case is cut).
  ctx.strokeStyle = '#ff2d95';
  ctx.setLineDash([]);
  ctx.strokeRect(t.bleedMm * px, t.bleedMm * px, t.trimWidthMm * px, t.trimHeightMm * px);

  // Fold lines between panels.
  ctx.strokeStyle = '#22d3ee';
  ctx.setLineDash([2 * px, 1.5 * px]);
  for (const p of t.panels.slice(1)) {
    ctx.beginPath();
    ctx.moveTo(p.xMm * px, 0);
    ctx.lineTo(p.xMm * px, t.totalHeightMm * px);
    ctx.stroke();
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
