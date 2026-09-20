import type { SpineSettings } from '../types/editor';

export interface SpineBox {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** Titles longer than this are rare (catalogue titles average about 20 characters; roughly 40 covers all but a few). */
export const TYPICAL_LONG_TITLE_CHARS = 40;
/** Average width of a character of bold sans text, in em (mixed case with spaces). */
const AVG_CHAR_EM = 0.6;
const CAP_HEIGHT_EM = 0.72;
/** The largest automatic text height, used wherever a long title fits at this size. */
export const MAX_AUTO_CAP_MM = 4;
const SPINE_MARGIN_MM = 4;

/**
 * The default cap height for a spine: MAX_AUTO_CAP_MM, or smaller when the spine is too short to fit a long title on one
 * line at that size (a CD, cassette or NFC box), and never more than 60% of the spine's thickness.
 */
export function defaultCapHeightMm(
  box: SpineBox,
  orientation: 'vertical' | 'horizontal' = 'vertical',
  inset: { start: number; end: number } = { start: 0, end: 0 },
): number {
  const vertical = orientation === 'vertical';
  const runMm = (vertical ? box.heightMm : box.widthMm) - SPINE_MARGIN_MM * 2 - inset.start - inset.end;
  const thicknessMm = vertical ? box.widthMm : box.heightMm;
  const fit = runMm / ((TYPICAL_LONG_TITLE_CHARS * AVG_CHAR_EM) / CAP_HEIGHT_EM);
  return Math.floor(Math.max(1.5, Math.min(MAX_AUTO_CAP_MM, fit, thicknessMm * 0.6)) * 10) / 10;
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
  const marginMm = SPINE_MARGIN_MM;
  const vertical = orientation === 'vertical';
  const lengthMm = vertical ? box.heightMm : box.widthMm; // the direction the text runs
  const thicknessMm = vertical ? box.widthMm : box.heightMm; // the direction that limits glyph height
  const maxLengthPx = (lengthMm - marginMm * 2 - inset.start - inset.end) * px;
  // Cap height ≈ 0.72 em. Never let the glyphs fill more than 80% of the spine's thickness.
  const capHeightMm = Math.min(s.textHeightMm ?? defaultCapHeightMm(box, orientation, inset), thicknessMm * 0.8);
  let sizePx = (capHeightMm * px) / CAP_HEIGHT_EM;

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
