import type { PanelRect, TemplateConfig } from '../types/template';
import type { CodeSettings } from '../types/editor';
import type { MediaItem } from '../types/media';
import { QUIET, encodeBars, encodeQr } from '../codes/encode';
import { barcodeValue, fillPattern } from '../codes/pattern';
import { paintRect } from './placement';
import { boxRect, fitInside, intersect, type RectMm } from './box';

/** Space kept clear of a panel's edge; a code that doesn't fit inside it is not drawn. */
export const CODE_SAFETY_MM = 3;
const DEFAULT_MARGIN_MM = 8;
/** Whitespace round a barcode's quiet zones, so it reads clearly on a busy back cover (mm at the default size). */
const BARCODE_PAD_MM = 1.5;
/**
 * Printed barcodes are shorter than the full GS1 symbol: on retail covers the bars are about 13 mm tall at the standard
 * 37.29 mm width, with the digits below. The symbol is then set in a little white margin.
 */
const BARS_MM = 13;
const SYMBOL_W_MM = 37.29;
const SYMBOL_H_MM = BARS_MM + 3.08; // bars + the row of digits
const BOX_W_MM = SYMBOL_W_MM + BARCODE_PAD_MM * 2;
const BOX_H_MM = SYMBOL_H_MM + BARCODE_PAD_MM * 2;
const DEFAULT_WIDTH_MM = { qr: 30, ean13: BOX_W_MM, upca: BOX_W_MM, code128: 45 } as const;
/** Width / height of the whole symbol including quiet zones, the white margin and (for EAN/UPC) the digits. */
const ASPECT = { qr: 1, ean13: BOX_W_MM / BOX_H_MM, upca: BOX_W_MM / BOX_H_MM, code128: 3 } as const;

type Drawable = Exclude<CodeSettings['kind'], 'none'>;

export interface CodePlacement {
  widthMm: number;
  heightMm: number;
  /** Top-left from the panel's paint-area top-left, like images and logos. */
  xMm: number;
  yMm: number;
  area: PanelRect;
  /** false = too small to scan inside the panel's safe area (under MIN_CODE_MM for its kind), so it is omitted. */
  fits: boolean;
  /** The box the symbol is fitted into, in canvas mm (for an older save's mm placement: the symbol itself). */
  box: RectMm;
}

/** Below this width (quiet zones included) a code is left off rather than printed too small for a phone or scanner to read. */
export const MIN_CODE_MM: Record<Drawable, number> = { qr: 8, ean13: 20, upca: 20, code128: 20 };

export function defaultCodeWidth(kind: Drawable): number {
  return DEFAULT_WIDTH_MM[kind];
}

/** The panel inside its safety margin: a code never reaches the trim, where a cut through it would stop it scanning. */
const safeArea = (panel: PanelRect): RectMm => ({
  xMm: panel.xMm + CODE_SAFETY_MM,
  yMm: panel.yMm + CODE_SAFETY_MM,
  widthMm: panel.widthMm - CODE_SAFETY_MM * 2,
  heightMm: panel.heightMm - CODE_SAFETY_MM * 2,
});

/**
 * Placement and whether it prints. The symbol (quiet zones included) is as large as fits inside its box and the
 * panel's safe area, centred, keeping its proportions. With no box, the kind's standard size in the bottom-right corner.
 */
export function computeCodePlacement(t: TemplateConfig, panel: PanelRect, code: CodeSettings): CodePlacement | null {
  if (code.kind === 'none') return null;
  const area = paintRect(t, panel);
  const aspect = ASPECT[code.kind];
  if (code.box === undefined) return legacyCodePlacement(area, panel, code, aspect);
  const box = code.box ? boxRect(panel, code.box) : defaultCodeRect(panel, DEFAULT_WIDTH_MM[code.kind], aspect);
  const room = intersect(box, safeArea(panel));
  const r = fitInside(room, aspect);
  const fits = room.widthMm > 0 && room.heightMm > 0 && r.widthMm >= MIN_CODE_MM[code.kind];
  return { widthMm: r.widthMm, heightMm: r.heightMm, xMm: r.xMm - area.xMm, yMm: r.yMm - area.yMm, area, fits, box };
}

/** The kind's standard size, in the panel's bottom-right corner (canvas mm). */
function defaultCodeRect(panel: PanelRect, widthMm: number, aspect: number): RectMm {
  const heightMm = widthMm / aspect;
  return { xMm: panel.xMm + panel.widthMm - DEFAULT_MARGIN_MM - widthMm, yMm: panel.yMm + panel.heightMm - DEFAULT_MARGIN_MM - heightMm, widthMm, heightMm };
}

/**
 * An older save's mm placement (see LegacyPlacement): its width, at its position from the paint area, kept whole
 * inside the safe area. Omitted when that width doesn't fit the safe area at all.
 */
function legacyCodePlacement(area: PanelRect, panel: PanelRect, code: CodeSettings, aspect: number): CodePlacement {
  const kind = code.kind as Drawable;
  const widthMm = code.widthMm ?? DEFAULT_WIDTH_MM[kind];
  const heightMm = widthMm / aspect;
  const safe = safeArea(panel);
  const fits = widthMm <= safe.widthMm && heightMm <= safe.heightMm;
  const auto = defaultCodeRect(panel, widthMm, aspect);
  const clamp = (v: number, lo: number, hi: number) => (fits ? Math.min(hi, Math.max(lo, v)) : v);
  const x = clamp(code.xMm != null ? area.xMm + code.xMm : auto.xMm, safe.xMm, safe.xMm + safe.widthMm - widthMm);
  const y = clamp(code.yMm != null ? area.yMm + code.yMm : auto.yMm, safe.yMm, safe.yMm + safe.heightMm - heightMm);
  return { widthMm, heightMm, xMm: x - area.xMm, yMm: y - area.yMm, area, fits, box: { xMm: x, yMm: y, widthMm, heightMm } };
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

function drawBarcode(ctx: CanvasRenderingContext2D, kind: 'ean13' | 'upca' | 'code128', value: string, boxW: number, boxH: number, px: number): void {
  let [w, h] = [boxW, boxH];
  const bars = encodeBars(kind, value);
  if (!bars) return;
  const [ql, qr] = QUIET[kind];
  const withDigits = kind !== 'code128';
  // Barcodes sit in a margin of white; everything below is laid out inside it.
  const pad = withDigits ? (w * BARCODE_PAD_MM) / BOX_W_MM : w * 0.03;
  ctx.translate(pad * px, pad * px);
  [w, h] = [w - pad * 2, h - pad * 2];
  const total = bars.modules.length + ql + qr;
  const m = w / total;
  // The digits take 3.08 mm of the 37.29 mm width; the guard bars reach 1.65 mm down into that row. The bars fill the rest.
  const digitsH = withDigits ? w * (3.08 / SYMBOL_W_MM) : 0;
  const barH = h - digitsH;
  const guardExtra = withDigits ? w * (1.65 / SYMBOL_W_MM) : 0;
  const top = 0;

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
    // Each digit sits centred in its own 7-module slot (six per half, exactly between the guard bars), so the
    // spacing is even; the glyphs are stretched to fill the slot rather than looking narrow.
    const fontModules = 13;
    const glyph = 0.6 * fontModules; // a monospace glyph's advance, in modules
    ctx.font = `${m * fontModules * px}px "OCR B", "Courier New", monospace`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    const baseline = h * 0.985 * px;
    const digit = (ch: string, centreModule: number) => {
      ctx.save();
      ctx.translate((ql + centreModule) * m * px, baseline);
      ctx.scale(6.4 / glyph, 1);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    };
    const group = (chars: string, startModule: number) => [...chars].forEach((ch, i) => digit(ch, startModule + 3.5 + 7 * i));
    if (kind === 'ean13') {
      digit(digits[0], -5.5);
      group(digits.slice(1, 7), 3);
      group(digits.slice(7), 50);
    } else {
      digit(digits[0], -5.5);
      group(digits.slice(1, 6), 10);
      group(digits.slice(6, 11), 50);
      digit(digits[11], bars.modules.length + 5.5);
    }
  }
}
