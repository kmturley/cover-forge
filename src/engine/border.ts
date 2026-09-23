import type { PanelRect } from '../types/template';
import type { BorderSettings } from '../types/editor';

/** Draws an accent border just inside the panel's trim edge, entirely within the safe area (never in the bleed). */
export function drawBorder(ctx: CanvasRenderingContext2D, panel: PanelRect, border: BorderSettings, px: number): void {
  if (border.widthMm <= 0) return;
  // The inset is to the stroke's centreline, so the whole line width stays inside `insetMm` of the trim edge.
  const inset = border.insetMm + border.widthMm / 2;
  const w = panel.widthMm - inset * 2;
  const h = panel.heightMm - inset * 2;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.strokeStyle = border.color;
  ctx.lineWidth = border.widthMm * px;
  ctx.strokeRect((panel.xMm + inset) * px, (panel.yMm + inset) * px, w * px, h * px);
  ctx.restore();
}
