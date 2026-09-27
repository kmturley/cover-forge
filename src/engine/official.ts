import type { PanelRect, TemplateConfig, TemplateKind } from '../types/template';
import { paintRect } from '../templates/geometry';
import { brandAspect, brandHeight, brandPath2D, brandWidth, getBrand } from '../brands';

/**
 * The "Digital / Official" style: a header banner on the front and a matching cap on the spine, in the manner of
 * commercial releases. Where a brand logo exists it is drawn; otherwise a text label is used.
 */
export interface HeaderSpec {
  /** Banner text on the front (used when no brandId, or as accessible fallback). */
  text: string;
  /** Short label for the spine cap (used when no brandId). */
  short: string;
  bg: string;
  fg: string;
  /** Banner height on the front as a fraction of the panel height (e.g. 0.136 = 13.6%). */
  heightPct: number;
  /** Spine cap length as a fraction of the spine panel height. */
  capPct: number;
  /** Simple Icons brand id to draw instead of text when available. */
  brandId?: string;
  /** Accent line colour under the banner; omit for no accent line. */
  accentColor?: string;
  /** Horizontal alignment of the logo/text in the banner. Default 'left'. */
  logoAlign?: 'left' | 'center' | 'right';
  /** Rotate the spine cap logo/text 90° CW so it reads top-to-bottom along the spine. */
  rotateCap?: boolean;
  /**
   * Skip the filled banner rectangle on the front; draw only the brand logo as a top-left overlay.
   * logoWidthPct controls the logo width as a fraction of panel width (default 0.12).
   */
  overlayOnly?: boolean;
  logoWidthPct?: number;
  /**
   * Brand id for the spine cap when it differs from the front banner (e.g. PS4/PS5 front uses
   * the numbered logo; spine uses the generic PlayStation family emblem).
   */
  spineBrandId?: string;
}

export const OFFICIAL_HEADERS: Record<TemplateKind, HeaderSpec> = {
  bluray: { text: 'Blu-ray Disc', short: 'BD', bg: '#0a4da2', fg: '#ffffff', heightPct: 0.074, capPct: 0.10 },
  dvd:    { text: 'DVD',          short: 'DVD', bg: '#141414', fg: '#ffffff', heightPct: 0.055, capPct: 0.08 },
  vhs:    { text: 'VHS',          short: 'VHS', bg: '#141414', fg: '#ffd200', heightPct: 0.058, capPct: 0.08 },
  cd:     { text: 'COMPACT DISC', short: 'CD',  bg: '#141414', fg: '#ffffff', heightPct: 0.067, capPct: 0.10 },
  cassette:     { text: 'TAPE',   short: 'TAPE',  bg: '#141414', fg: '#ffd200', heightPct: 0.079, capPct: 0.16 },
  floppy:       { text: 'FLOPPY', short: 'FLOPPY', bg: '#22252b', fg: '#ffffff', heightPct: 0.086, capPct: 0 },
  'nfc-card':   { text: 'NFC',    short: 'NFC', bg: '#1a73e8', fg: '#ffffff', heightPct: 0.082, capPct: 0 },
  'nfc-sticker':{ text: 'NFC',    short: 'NFC', bg: '#1a73e8', fg: '#ffffff', heightPct: 0.10,  capPct: 0 },
  'nfc-box':    { text: 'NFC',    short: 'NFC', bg: '#1a73e8', fg: '#ffffff', heightPct: 0.078, capPct: 0.13 },
  vinyl:        { text: 'STEREO • 33⅓ RPM', short: 'VINYL', bg: '#1a1a1a', fg: '#f5e642', heightPct: 0.032, capPct: 0 },
  'game-case':  { text: 'GAME',   short: 'GAME', bg: '#1a1a1a', fg: '#ffffff', heightPct: 0.14,  capPct: 0.14 },
};

/** Per-platform branding for the game-case kind, keyed by variantId. All percentages are of the panel height. */
export const GAME_CASE_HEADERS: Record<string, HeaderSpec> = {
  // PS1 PAL: black left strip (approximated as top banner), PlayStation logo centred.
  'ps1-pal':   { text: 'PlayStation',      short: 'PS1',  bg: '#000000', fg: '#000000', heightPct: 0.125, capPct: 0.125, brandId: 'playstation', spineBrandId: 'playstation', logoAlign: 'center' },
  // PS2: black banner, PS2 logo centred, height 12.5%.
  'ps2':       { text: 'PlayStation 2',    short: 'PS2',  bg: '#000000', fg: '#ffffff', heightPct: 0.125, capPct: 0.125, brandId: 'playstation2', spineBrandId: 'playstation', logoAlign: 'center' },
  // PS3: black banner, red accent, PS3 logo centred, height 15%.
  'ps3':       { text: 'PlayStation 3',    short: 'PS3',  bg: '#000000', fg: '#ffffff', accentColor: '#e00000', heightPct: 0.15, capPct: 0.15, brandId: 'playstation3', spineBrandId: 'playstation', logoAlign: 'center', rotateCap: true },
  // PS4: blue #003791, no border, PS4 logo left 5%, height 14%.
  'ps4':       { text: 'PlayStation 4',    short: 'PS4',  bg: '#003791', fg: '#ffffff', heightPct: 0.14, capPct: 0.14, brandId: 'playstation4', spineBrandId: 'playstation' },
  // PS5: white, blue accent #00439c, PS5 logo left 5%, height 13.6%. Spine: PS emblem centred.
  'ps5':       { text: 'PlayStation 5',    short: 'PS5',  bg: '#ffffff', fg: '#003087', accentColor: '#00439c', heightPct: 0.136, capPct: 0.136, brandId: 'playstation5', spineBrandId: 'playstation' },
  // PS Vita: blue #003791, PS Vita logo left 4%, height 13%.
  'ps-vita':   { text: 'PS Vita',          short: 'VITA', bg: '#003791', fg: '#ffffff', heightPct: 0.13, capPct: 0.13, brandId: 'playstationvita', spineBrandId: 'playstationvita' },
  // Switch: full-bleed front, logo overlay 12% width top-left 3.5%. Spine: red #e60012, 15% cap.
  'switch':    { text: 'Nintendo Switch',  short: 'NSW',  bg: '#e60012', fg: '#ffffff', heightPct: 0.15, capPct: 0.15, overlayOnly: true, logoWidthPct: 0.12 },
  // Switch 2: full-bleed front, logo overlay 14% width top-left 3.5%. Spine: red #e60012, 15% cap.
  'switch2':   { text: 'Nintendo Switch 2', short: 'NSW2', bg: '#e60012', fg: '#ffffff', heightPct: 0.15, capPct: 0.15, overlayOnly: true, logoWidthPct: 0.14 },
  // Wii U: blue #0096d6, white accent, Wii U logo centred, height 13.5%.
  'wii-u':     { text: 'Wii U',            short: 'WIIU', bg: '#0096d6', fg: '#ffffff', accentColor: '#ffffff', heightPct: 0.135, capPct: 0.135, logoAlign: 'center' },
  // Wii: white, grey accent #e6e6e6, Wii logo right 5%, height 12%.
  'wii':       { text: 'Wii',              short: 'WII',  bg: '#ffffff', fg: '#888888', accentColor: '#e6e6e6', heightPct: 0.12, capPct: 0.12, logoAlign: 'right' },
  // GameCube: black, purple accent #5a189a, NINTENDO GAMECUBE text left 4%, height 14%.
  'gamecube':  { text: 'NINTENDO GAMECUBE', short: 'GCN', bg: '#000000', fg: '#ffffff', accentColor: '#5a189a', heightPct: 0.14, capPct: 0.14 },
  // Xbox (original): black, green accent #107c10, logo centred, height 15%.
  'xbox':      { text: 'XBOX',             short: 'XBOX', bg: '#000000', fg: '#107c10', accentColor: '#107c10', heightPct: 0.15, capPct: 0.15, logoAlign: 'center' },
  // Xbox 360: white, green accent #a4c639, logo centred, height 15%.
  'xbox-360':  { text: 'XBOX 360',         short: 'X360', bg: '#ffffff', fg: '#52a43a', accentColor: '#a4c639', heightPct: 0.15, capPct: 0.15, logoAlign: 'center' },
  // Xbox One: green #107c10, no border, text left 4%, height 14%. Spine: green, no rotation.
  'xbox-one':  { text: 'XBOX ONE',         short: 'XBOX ONE', bg: '#107c10', fg: '#ffffff', heightPct: 0.14, capPct: 0.14 },
  // Xbox Series X: white, no border, text left 4%, height 12.5%. Spine: green #107c10.
  'xbox-series': { text: 'XBOX SERIES X|S', short: 'XBOX SERIES', bg: '#ffffff', fg: '#107c10', heightPct: 0.125, capPct: 0.125 },
};

/** Resolves the correct HeaderSpec for a template, using the variantId for game-case. */
export function resolveHeader(kind: TemplateKind, variantId: string): HeaderSpec {
  return kind === 'game-case' ? (GAME_CASE_HEADERS[variantId] ?? OFFICIAL_HEADERS['game-case']) : OFFICIAL_HEADERS[kind];
}

/** Banner height in mm for a given panel. */
export function bannerHeightMm(spec: HeaderSpec, panelHeightMm: number): number {
  return spec.heightPct * panelHeightMm;
}

/** Spine cap length in mm for a given spine panel. */
export function capLengthMm(spec: HeaderSpec, spineHeightMm: number): number {
  return spec.capPct * spineHeightMm;
}

/** Room to leave at the start of a spine's text for the cap (0 when the style adds none). */
export function spineCapMm(kind: TemplateKind, digital: boolean, variantId = '', spineHeightMm = 170): number {
  if (!digital) return 0;
  const spec = resolveHeader(kind, variantId);
  return capLengthMm(spec, spineHeightMm);
}

const FONT = 'Helvetica, Arial, sans-serif';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number, sizePx: number): number {
  ctx.font = `700 ${sizePx}px ${FONT}`;
  const w = ctx.measureText(text).width;
  return w > maxWidthPx ? (sizePx * maxWidthPx) / w : sizePx;
}

/** Draws the front banner and the spine caps. `px` is pixels per mm. */
export function drawOfficial(ctx: CanvasRenderingContext2D, t: TemplateConfig, px: number): void {
  const spec = resolveHeader(t.kind, t.variantId);
  ctx.save();
  ctx.textBaseline = 'middle';

  const front = t.panels.find((p) => p.id === 'front');
  if (front) {
    if (spec.overlayOnly) drawOverlay(ctx, front, spec, px);
    else drawBanner(ctx, t, front, spec, px);
  }
  for (const p of t.panels) {
    if (!p.text) continue;
    const cap = capLengthMm(spec, p.heightMm);
    if (cap > 0) drawCap(ctx, t, p, spec, cap, px);
  }
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, t: TemplateConfig, p: PanelRect, spec: HeaderSpec, px: number): void {
  const area = paintRect(t, p);
  const heightMm = bannerHeightMm(spec, p.heightMm);
  const bottom = p.yMm + heightMm;
  ctx.fillStyle = spec.bg;
  ctx.fillRect(area.xMm * px, area.yMm * px, area.widthMm * px, (bottom - area.yMm) * px);
  if (spec.accentColor) {
    ctx.fillStyle = spec.accentColor;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(area.xMm * px, bottom * px, area.widthMm * px, 0.5 * px);
    ctx.globalAlpha = 1;
  }

  const pad = p.widthMm * 0.05;
  const brand = getBrand(spec.brandId);
  const align = spec.logoAlign ?? 'left';
  if (brand) {
    const logoH = heightMm * 0.4;
    const logoW = logoH * brandAspect(brand);
    const k = (logoH * px) / brandHeight(brand);
    const cx = align === 'right'
      ? (p.xMm + p.widthMm - pad - logoW / 2) * px
      : align === 'center'
        ? (p.xMm + p.widthMm / 2) * px
        : (p.xMm + pad + logoW / 2) * px;
    const cy = (p.yMm + heightMm / 2) * px;
    ctx.save();
    ctx.fillStyle = spec.fg;
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate(-(brand.bbox[0] + brandWidth(brand) / 2), -(brand.bbox[1] + brandHeight(brand) / 2));
    ctx.fill(brandPath2D(brand));
    ctx.restore();
  } else {
    const maxW = (p.widthMm - pad * 2) * px;
    const size = fitText(ctx, spec.text, maxW, heightMm * 0.5 * px);
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillStyle = spec.fg;
    if (align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(spec.text, (p.xMm + p.widthMm / 2) * px, (p.yMm + heightMm / 2) * px);
    } else if (align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(spec.text, (p.xMm + p.widthMm - pad) * px, (p.yMm + heightMm / 2) * px);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(spec.text, (p.xMm + pad) * px, (p.yMm + heightMm / 2) * px);
    }
  }
  void t;
}

/** No banner rectangle: draws the brand logo as a small top-left overlay directly on the artwork. */
function drawOverlay(ctx: CanvasRenderingContext2D, p: PanelRect, spec: HeaderSpec, px: number): void {
  const brand = getBrand(spec.brandId);
  if (!brand) return;
  const inset = p.widthMm * 0.035;
  const logoW = p.widthMm * (spec.logoWidthPct ?? 0.12);
  const logoH = logoW / brandAspect(brand);
  const k = (logoW * px) / brandWidth(brand);
  const cx = (p.xMm + inset + logoW / 2) * px;
  const cy = (p.yMm + inset + logoH / 2) * px;
  ctx.save();
  ctx.fillStyle = spec.fg;
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.translate(-(brand.bbox[0] + brandWidth(brand) / 2), -(brand.bbox[1] + brandHeight(brand) / 2));
  ctx.fill(brandPath2D(brand));
  ctx.restore();
}

function drawCap(ctx: CanvasRenderingContext2D, t: TemplateConfig, p: PanelRect, spec: HeaderSpec, capMm: number, px: number): void {
  const area = paintRect(t, p);
  const vertical = p.text === 'vertical';
  const rect = vertical
    ? { x: area.xMm, y: area.yMm, w: area.widthMm, h: p.yMm + capMm - area.yMm }
    : { x: area.xMm, y: area.yMm, w: p.xMm + capMm - area.xMm, h: area.heightMm };
  ctx.fillStyle = spec.bg;
  ctx.fillRect(rect.x * px, rect.y * px, rect.w * px, rect.h * px);

  const cx = vertical ? p.xMm + p.widthMm / 2 : p.xMm + capMm / 2;
  const cy = vertical ? p.yMm + capMm / 2 : p.yMm + p.heightMm / 2;
  const room = (vertical ? p.widthMm : capMm) * 0.85;
  ctx.fillStyle = spec.fg;
  ctx.textAlign = 'center';

  const brand = getBrand(spec.spineBrandId ?? spec.brandId);
  if (brand) {
    const capShort = vertical ? p.widthMm : capMm;
    const logoW = Math.min(room, capShort * 0.65);
    const logoH = logoW / brandAspect(brand);
    const k = spec.rotateCap ? (logoW * px) / brandHeight(brand) : (logoW * px) / brandWidth(brand);
    ctx.save();
    ctx.fillStyle = spec.fg;
    ctx.translate(cx * px, cy * px);
    if (spec.rotateCap) ctx.rotate(Math.PI / 2);
    ctx.scale(k, k);
    ctx.translate(-(brand.bbox[0] + brandWidth(brand) / 2), -(brand.bbox[1] + brandHeight(brand) / 2));
    ctx.fill(brandPath2D(brand));
    ctx.restore();
    void logoH;
  } else {
    const size = fitText(ctx, spec.short, room * px, Math.min(p.widthMm, capMm) * 0.55 * px);
    ctx.font = `700 ${size}px ${FONT}`;
    if (spec.rotateCap) {
      ctx.save();
      ctx.translate(cx * px, cy * px);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(spec.short, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(spec.short, cx * px, cy * px);
    }
  }
  void t;
}
