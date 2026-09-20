import type { SpineSettings } from '../types/editor';

export interface SpineBox {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/**
 * Draws spine text rotated 90° clockwise (reads top-to-bottom, the Blu-ray/DVD convention),
 * shrinking the font until it fits the spine length with a margin. `textHeightMm` is the cap height. Geometry is in mm; `px` scales to pixels.
 */
export function drawSpineText(
  ctx: CanvasRenderingContext2D,
  box: SpineBox,
  text: string,
  s: SpineSettings,
  px: number,
): void {
  if (!text) return;
  const marginMm = 4;
  const maxLengthPx = (box.heightMm - marginMm * 2) * px;
  // Cap height ≈ 0.72 em. Never let the glyphs fill more than 80% of the spine width.
  const capHeightMm = Math.min(s.textHeightMm, box.widthMm * 0.8);
  let sizePx = (capHeightMm * px) / 0.72;

  ctx.save();
  ctx.fillStyle = s.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${sizePx}px ${s.fontFamily}`;
  const w = ctx.measureText(text).width;
  if (w > maxLengthPx) {
    sizePx = (sizePx * maxLengthPx) / w;
    ctx.font = `700 ${sizePx}px ${s.fontFamily}`;
  }
  ctx.translate((box.xMm + box.widthMm / 2) * px, (box.yMm + box.heightMm / 2) * px);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
