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
  /** 'vertical' reads top-to-bottom (rotated 90° CW) along a tall spine; 'horizontal' runs along a wide, short one (J-card). */
  orientation: 'vertical' | 'horizontal' = 'vertical',
  /** Space to leave clear at the start (top / left) and end of the spine, e.g. for a cap. */
  inset: { start: number; end: number } = { start: 0, end: 0 },
): void {
  if (!text) return;
  const marginMm = 4;
  const vertical = orientation === 'vertical';
  const lengthMm = vertical ? box.heightMm : box.widthMm; // the direction the text runs
  const thicknessMm = vertical ? box.widthMm : box.heightMm; // the direction that limits glyph height
  const maxLengthPx = (lengthMm - marginMm * 2 - inset.start - inset.end) * px;
  // Cap height ≈ 0.72 em. Never let the glyphs fill more than 80% of the spine's thickness.
  const capHeightMm = Math.min(s.textHeightMm, thicknessMm * 0.8);
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
  // Shift the text's centre along its run so it sits in the space left after the insets.
  const shift = (inset.start - inset.end) / 2;
  ctx.translate((box.xMm + box.widthMm / 2 + (vertical ? 0 : shift)) * px, (box.yMm + box.heightMm / 2 + (vertical ? shift : 0)) * px);
  if (vertical) ctx.rotate(Math.PI / 2);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
