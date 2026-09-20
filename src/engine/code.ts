import type { PanelRect, TemplateConfig } from '../types/template';
import type { CodeSettings } from '../types/editor';
import type { MediaItem } from '../types/media';
import { QUIET, encodeBars, encodeQr } from '../codes/encode';
import { barcodeValue, fillPattern } from '../codes/pattern';
import { paintRect } from './placement';

/** Space kept clear of a panel's edge; a code that doesn't fit inside it is not drawn. */
export const CODE_SAFETY_MM = 3;
const DEFAULT_MARGIN_MM = 8;
const DEFAULT_WIDTH_MM = { qr: 30, ean13: 37.3, upca: 37.3, code128: 45 } as const;
/** Width / height of the whole symbol including quiet zones and (for EAN/UPC) the digits. */
const ASPECT = { qr: 1, ean13: 37.29 / 25.93, upca: 37.29 / 25.93, code128: 3 } as const;

type Drawable = Exclude<CodeSettings['kind'], 'none'>;

export interface CodePlacement {
  widthMm: number;
  heightMm: number;
  /** Top-left from the panel's paint-area top-left, like images and logos. */
  xMm: number;
  yMm: number;
  area: PanelRect;
  /** false = it doesn't fit inside the panel's safe area, so it is omitted. */
  fits: boolean;
}

export function defaultCodeWidth(kind: Drawable): number {
  return DEFAULT_WIDTH_MM[kind];
}

/** Placement and whether it fits. Default position: bottom-right, inside the safety margin. */
export function computeCodePlacement(t: TemplateConfig, panel: PanelRect, code: CodeSettings): CodePlacement | null {
  if (code.kind === 'none') return null;
  const area = paintRect(t, panel);
  const widthMm = code.widthMm ?? DEFAULT_WIDTH_MM[code.kind];
  const heightMm = widthMm / ASPECT[code.kind];
  const fits = widthMm + CODE_SAFETY_MM * 2 <= panel.widthMm && heightMm + CODE_SAFETY_MM * 2 <= panel.heightMm;
  const defaultX = panel.xMm + panel.widthMm - DEFAULT_MARGIN_MM - widthMm - area.xMm;
  const defaultY = panel.yMm + panel.heightMm - DEFAULT_MARGIN_MM - heightMm - area.yMm;
  return { widthMm, heightMm, xMm: code.xMm ?? defaultX, yMm: code.yMm ?? defaultY, area, fits };
}

/**
 * Draws the QR code or barcode for an item, if it fits and encodes. Everything is in a local 0..W × 0..H mm box so
 * position, rotation and opacity act on the whole symbol. `px` is pixels per mm.
 */
export function drawCode(ctx: CanvasRenderingContext2D, t: TemplateConfig, panel: PanelRect, code: CodeSettings, item: MediaItem, px: number): void {
  const pl = computeCodePlacement(t, panel, code);
  if (!pl || !pl.fits || code.kind === 'none') return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pl.area.xMm * px, pl.area.yMm * px, pl.area.widthMm * px, pl.area.heightMm * px);
  ctx.clip();
  ctx.globalAlpha = code.opacity;
  ctx.translate((pl.area.xMm + pl.xMm + pl.widthMm / 2) * px, (pl.area.yMm + pl.yMm + pl.heightMm / 2) * px);
  ctx.rotate((code.rotationDeg * Math.PI) / 180);
  ctx.translate((-pl.widthMm / 2) * px, (-pl.heightMm / 2) * px);
  ctx.fillStyle = code.background;
  ctx.fillRect(0, 0, pl.widthMm * px, pl.heightMm * px);
  ctx.fillStyle = code.color;

  if (code.kind === 'qr') drawQr(ctx, fillPattern(code.pattern, item), pl.widthMm, pl.heightMm, px);
  else drawBarcode(ctx, code.kind, barcodeValue(code.kind, code.pattern, item).value, pl.widthMm, pl.heightMm, px);
  ctx.restore();
}

function drawQr(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, px: number): void {
  const qr = encodeQr(text);
  if (!qr) return;
  const quiet = 4; // modules, as the QR spec requires
  const m = Math.min(w, h) / (qr.size + quiet * 2);
  const ox = (w - m * (qr.size + quiet * 2)) / 2 + quiet * m;
  const oy = (h - m * (qr.size + quiet * 2)) / 2 + quiet * m;
  ctx.beginPath(); // one path: adjacent modules fuse without hairline seams
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.get(r, c)) ctx.rect((ox + c * m) * px, (oy + r * m) * px, m * px, m * px);
  ctx.fill();
}

function drawBarcode(ctx: CanvasRenderingContext2D, kind: 'ean13' | 'upca' | 'code128', value: string, w: number, h: number, px: number): void {
  const bars = encodeBars(kind, value);
  if (!bars) return;
  const [ql, qr] = QUIET[kind];
  const total = bars.modules.length + ql + qr;
  const m = w / total;
  const withDigits = kind !== 'code128';
  // Vertical layout: a little top padding, the bars, then (EAN/UPC only) a strip for the digits.
  const top = h * 0.06;
  const textH = withDigits ? h * 0.2 : 0;
  const barH = h - top - textH - h * 0.04;
  const guardExtra = withDigits ? textH * 0.55 : 0; // guard bars reach down into the digit strip

  // Group consecutive dark modules into single bars.
  const isGuard = (i: number) => withDigits && (i < 3 || (i >= 45 && i < 50) || i >= bars.modules.length - 3);
  ctx.beginPath();
  for (let i = 0; i < bars.modules.length; ) {
    if (bars.modules[i] !== '1') {
      i++;
      continue;
    }
    let j = i;
    while (j < bars.modules.length && bars.modules[j] === '1' && isGuard(j) === isGuard(i)) j++;
    ctx.rect((ql + i) * m * px, top * px, (j - i) * m * px, (barH + (isGuard(i) ? guardExtra : 0)) * px);
    i = j;
  }
  ctx.fill();

  if (withDigits) {
    const digits = bars.text;
    // A digit is about 7 modules wide, so the six-digit groups fit exactly between the guard bars (no extra spacing).
    ctx.font = `${m * 11 * px}px "OCR B", "Courier New", monospace`;
    ctx.textBaseline = 'alphabetic';
    const baseline = (top + barH + textH * 0.8) * px;
    const at = (module: number) => (ql + module) * m * px;
    ctx.textAlign = 'right';
    ctx.fillText(digits[0], (ql - 1) * m * px, baseline);
    ctx.textAlign = 'center';
    if (kind === 'ean13') {
      ctx.fillText(digits.slice(1, 7), (at(3) + at(45)) / 2, baseline);
      ctx.fillText(digits.slice(7), (at(50) + at(92)) / 2, baseline);
    } else {
      ctx.fillText(digits.slice(1, 6), (at(10) + at(45)) / 2, baseline);
      ctx.fillText(digits.slice(6, 11), (at(50) + at(85)) / 2, baseline);
      ctx.textAlign = 'left';
      ctx.fillText(digits[11], (ql + bars.modules.length + 1) * m * px, baseline);
    }
  }
}
