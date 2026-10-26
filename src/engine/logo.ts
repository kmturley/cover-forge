import type { PanelRect, TemplateConfig } from '../types/template';
import type { LogoSettings } from '../types/editor';
import { brandHeight, brandPath2D, brandWidth, type Mark } from '../brands';
import { paintLogoLayers } from './logoLayers';
import { paintRect } from './placement';
import { boxRect, fitInside, type RectMm } from './box';
import { defaultCapHeightMm } from './SpineTypography';

/** Default logo width for big panels; spine-like panels use a share of their short side, narrow panels a share of their width. */
const DEFAULT_WIDTH_MM = 24;
const SPINE_SHARE = 0.6;
const MAX_SPINE_LOGO_MM = 10;
/** A spine mark is at most this many times the automatic text height, so it never outweighs the title beside it. */
const SPINE_LOGO_PER_TEXT = 2;
/** Share of a small panel's short side, so a mark on a card or cassette isn't as large as on a keepcase. */
const SMALL_PANEL_SHARE = 0.3;
const TOP_MARGIN_MM = 8;
const SPINE_MARGIN_MM = 6;

export interface LogoPlacement {
  widthMm: number;
  heightMm: number;
  /** Top-left from the panel's paint-area top-left, matching image positions. */
  xMm: number;
  yMm: number;
  area: PanelRect;
  /** The box the logo is fitted into, in canvas mm (for an older save's mm placement: the logo itself). */
  box: RectMm;
}

/**
 * Where a logo sits automatically, in canvas mm, as a rectangle exactly its shape: a width that suits the panel,
 * horizontally centred near the top (on a wide, short spine: at the right end, vertically centred). `widthMm` and
 * `xMm`/`yMm` (from the paint area) override it, for an older save's mm placement.
 */
function defaultLogoRect(area: PanelRect, panel: PanelRect, aspect: number, widthMm?: number | null, xMm?: number | null, yMm?: number | null): RectMm {
  const shortSide = Math.min(panel.widthMm, panel.heightMm);
  const autoWidth = panel.text ? Math.min(MAX_SPINE_LOGO_MM, shortSide * SPINE_SHARE, defaultCapHeightMm(panel, panel.text) * SPINE_LOGO_PER_TEXT) : Math.min(DEFAULT_WIDTH_MM, shortSide * SMALL_PANEL_SHARE);
  const w = widthMm ?? autoWidth;
  const h = w / aspect;
  let x = panel.xMm + (panel.widthMm - w) / 2;
  let y = panel.yMm + (panel.text ? SPINE_MARGIN_MM : TOP_MARGIN_MM);
  if (panel.text === 'horizontal') {
    x = panel.xMm + panel.widthMm - SPINE_MARGIN_MM - w;
    y = panel.yMm + (panel.heightMm - h) / 2;
  }
  return { xMm: xMm != null ? area.xMm + xMm : x, yMm: yMm != null ? area.yMm + yMm : y, widthMm: w, heightMm: h };
}

/** Where a logo sits: as large as fits inside its box, centred, keeping its shape. With no box, a spot that suits the panel. */
export function computeLogoPlacement(t: TemplateConfig, panel: PanelRect, aspect: number, logo: LogoSettings): LogoPlacement {
  const area = paintRect(t, panel);
  const box = logo.box ? boxRect(panel, logo.box) : logo.box === null ? defaultLogoRect(area, panel, aspect) : defaultLogoRect(area, panel, aspect, logo.widthMm, logo.xMm, logo.yMm);
  const r = fitInside(box, aspect);
  return { widthMm: r.widthMm, heightMm: r.heightMm, xMm: r.xMm - area.xMm, yMm: r.yMm - area.yMm, area, box };
}

/** Which part of a mark to draw: some of a logo's layers, a share of its artwork, or all in one colour (see ImageSource). */
export interface MarkOptions {
  only?: number[];
  crop?: [number, number, number, number];
  mono?: boolean;
}

/** The artwork a mark draws, in its own coordinates: its top-left corner and size, and which of a logo's layers. */
export function markGeometry(mark: Mark, o: MarkOptions = {}): { x: number; y: number; w: number; h: number; used: number[]; mono: boolean } {
  if (mark.kind === 'brand') return { x: mark.brand.bbox[0], y: mark.brand.bbox[1], w: brandWidth(mark.brand), h: brandHeight(mark.brand), used: [], mono: true };
  const l = mark.logo;
  const used = l.layers.map((_, i) => i).filter((i) => !o.only || o.only.includes(i));
  // With no choice of layers the logo's own bounds are used, as they always were.
  const [lx0, ly0, lx1, ly1] = o.only && used.length > 0 ? [Math.min(...used.map((i) => l.layers[i].box[0])), Math.min(...used.map((i) => l.layers[i].box[1])), Math.max(...used.map((i) => l.layers[i].box[2])), Math.max(...used.map((i) => l.layers[i].box[3]))] : l.bbox;
  const [c0, c1, c2, c3] = o.crop ?? [0, 0, 1, 1];
  return { x: lx0 + c0 * (lx1 - lx0), y: ly0 + c1 * (ly1 - ly0), w: (c2 - c0) * (lx1 - lx0), h: (c3 - c1) * (ly1 - ly0), used, mono: !!o.mono };
}

/** Width / height of the artwork a mark draws with these options (the mark's own aspect with none). */
export const markAspect = (mark: Mark, o?: MarkOptions): number => (o && (o.only || o.crop) ? (() => { const g = markGeometry(mark, o); return g.w / g.h; })() : mark.aspect);

/** Fills the mark (brand icon or supplied logo), clipped to its panel so it never spills onto a neighbour. `px` is pixels per mm. */
export function drawLogo(ctx: CanvasRenderingContext2D, t: TemplateConfig, panel: PanelRect, mark: Mark, logo: LogoSettings, px: number, o?: MarkOptions): void {
  const g = markGeometry(mark, o);
  const pl = computeLogoPlacement(t, panel, markAspect(mark, o), logo);
  const k = (pl.widthMm * px) / g.w;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pl.area.xMm * px, pl.area.yMm * px, pl.area.widthMm * px, pl.area.heightMm * px);
  ctx.clip();
  ctx.globalAlpha = logo.opacity;
  ctx.fillStyle = logo.color;
  ctx.translate((pl.area.xMm + pl.xMm + pl.widthMm / 2) * px, (pl.area.yMm + pl.yMm + pl.heightMm / 2) * px);
  ctx.rotate((logo.rotationDeg * Math.PI) / 180);
  ctx.scale(k, k);
  // Centre the artwork's tight bounds on the origin so position, size and rotation act on the visible mark.
  ctx.translate(-(g.x + g.w / 2), -(g.y + g.h / 2));
  if (o?.crop) {
    ctx.beginPath();
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.clip();
  }
  if (mark.kind === 'brand') ctx.fill(brandPath2D(mark.brand));
  else paintLogoLayers(ctx, mark.logo, g.used, 0, 0, logo.color, g.mono);
  ctx.restore();
}
