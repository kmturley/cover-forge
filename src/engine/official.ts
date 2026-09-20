import type { PanelRect, TemplateConfig, TemplateKind } from '../types/template';
import { paintRect } from '../templates/geometry';

/**
 * The "Digital / Official" style: a header banner on the front and a matching cap on the spine, in the manner of
 * commercial releases. Text banners only; no manufacturer logos are reproduced (use the Brand logo layer for those).
 */
export interface HeaderSpec {
  /** Banner text on the front. */
  text: string;
  /** Short label for the spine cap. */
  short: string;
  bg: string;
  fg: string;
  /** Banner height on the front (trim area, mm). */
  heightMm: number;
  /** Length of the spine cap along the spine (mm). */
  capMm: number;
}

export const OFFICIAL_HEADERS: Record<TemplateKind, HeaderSpec> = {
  bluray: { text: 'Blu-ray Disc', short: 'BD', bg: '#0a4da2', fg: '#ffffff', heightMm: 11, capMm: 15 },
  dvd: { text: 'DVD', short: 'DVD', bg: '#141414', fg: '#ffffff', heightMm: 10, capMm: 15 },
  vhs: { text: 'VHS', short: 'VHS', bg: '#141414', fg: '#ffd200', heightMm: 11, capMm: 16 },
  cd: { text: 'COMPACT DISC', short: 'CD', bg: '#141414', fg: '#ffffff', heightMm: 8, capMm: 12 },
  cassette: { text: 'TAPE', short: 'TAPE', bg: '#141414', fg: '#ffd200', heightMm: 8, capMm: 16 },
  floppy: { text: 'FLOPPY', short: 'FLOPPY', bg: '#22252b', fg: '#ffffff', heightMm: 6, capMm: 0 },
  'nfc-card': { text: 'NFC', short: 'NFC', bg: '#1a73e8', fg: '#ffffff', heightMm: 7, capMm: 0 },
  'nfc-sticker': { text: 'NFC', short: 'NFC', bg: '#1a73e8', fg: '#ffffff', heightMm: 5, capMm: 0 },
  'nfc-box': { text: 'NFC', short: 'NFC', bg: '#1a73e8', fg: '#ffffff', heightMm: 7, capMm: 12 },
};

/** Room to leave at the start of a spine's text for the cap (0 when the style adds none). */
export function spineCapMm(kind: TemplateKind, digital: boolean): number {
  return digital ? OFFICIAL_HEADERS[kind].capMm : 0;
}

const FONT = 'Helvetica, Arial, sans-serif';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number, sizePx: number): number {
  ctx.font = `700 ${sizePx}px ${FONT}`;
  const w = ctx.measureText(text).width;
  return w > maxWidthPx ? (sizePx * maxWidthPx) / w : sizePx;
}

/** Draws the front banner and the spine caps. `px` is pixels per mm. */
export function drawOfficial(ctx: CanvasRenderingContext2D, t: TemplateConfig, px: number): void {
  const spec = OFFICIAL_HEADERS[t.kind];
  ctx.save();
  ctx.textBaseline = 'middle';

  const front = t.panels.find((p) => p.id === 'front');
  if (front) drawBanner(ctx, t, front, spec, px);
  if (spec.capMm > 0) for (const p of t.panels) if (p.text) drawCap(ctx, t, p, spec, px);
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, t: TemplateConfig, p: PanelRect, spec: HeaderSpec, px: number): void {
  const area = paintRect(t, p);
  // Covers the top bleed too, so there is no sliver of artwork above the banner.
  const bottom = p.yMm + spec.heightMm;
  ctx.fillStyle = spec.bg;
  ctx.fillRect(area.xMm * px, area.yMm * px, area.widthMm * px, (bottom - area.yMm) * px);
  // A thin accent line under the banner.
  ctx.fillStyle = spec.fg;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(area.xMm * px, bottom * px, area.widthMm * px, 0.5 * px);
  ctx.globalAlpha = 1;

  const pad = Math.min(5, p.widthMm * 0.05);
  const size = fitText(ctx, spec.text, (p.widthMm - pad * 2) * px, spec.heightMm * 0.5 * px);
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillStyle = spec.fg;
  ctx.textAlign = 'left';
  ctx.fillText(spec.text, (p.xMm + pad) * px, (p.yMm + spec.heightMm / 2) * px);
}

function drawCap(ctx: CanvasRenderingContext2D, t: TemplateConfig, p: PanelRect, spec: HeaderSpec, px: number): void {
  const area = paintRect(t, p);
  const vertical = p.text === 'vertical';
  // The cap starts at the spine's first end (top of a tall spine, left of a wide one), bleed included.
  const rect = vertical
    ? { x: area.xMm, y: area.yMm, w: area.widthMm, h: p.yMm + spec.capMm - area.yMm }
    : { x: area.xMm, y: area.yMm, w: p.xMm + spec.capMm - area.xMm, h: area.heightMm };
  ctx.fillStyle = spec.bg;
  ctx.fillRect(rect.x * px, rect.y * px, rect.w * px, rect.h * px);

  const cx = vertical ? p.xMm + p.widthMm / 2 : p.xMm + spec.capMm / 2;
  const cy = vertical ? p.yMm + spec.capMm / 2 : p.yMm + p.heightMm / 2;
  const room = (vertical ? p.widthMm : spec.capMm) * 0.85;
  ctx.fillStyle = spec.fg;
  ctx.textAlign = 'center';
  const size = fitText(ctx, spec.short, room * px, Math.min(p.widthMm, p.heightMm) * 0.55 * px);
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillText(spec.short, cx * px, cy * px);
}
