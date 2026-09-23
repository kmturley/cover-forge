import type { PanelRect, TemplateConfig } from '../types/template';
import type { LogoSettings } from '../types/editor';
import { brandAspect, brandHeight, brandPath2D, brandWidth, type Brand } from '../brands';
import { paintRect } from './placement';
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
  defaultWidthMm: number;
}

/**
 * Where a logo sits. Width defaults to something sensible per panel; x/y default to horizontally centred on the
 * trimmed panel and sitting near the top.
 */
export function computeLogoPlacement(t: TemplateConfig, panel: PanelRect, aspect: number, logo: LogoSettings): LogoPlacement {
  const area = paintRect(t, panel);
  const shortSide = Math.min(panel.widthMm, panel.heightMm);
  const defaultWidthMm = panel.text ? Math.min(MAX_SPINE_LOGO_MM, shortSide * SPINE_SHARE, defaultCapHeightMm(panel, panel.text) * SPINE_LOGO_PER_TEXT) : Math.min(DEFAULT_WIDTH_MM, shortSide * SMALL_PANEL_SHARE);
  const widthMm = logo.widthMm ?? defaultWidthMm;
  const heightMm = widthMm / aspect;
  let centeredX = panel.xMm + (panel.widthMm - widthMm) / 2 - area.xMm;
  let topY = panel.yMm + (panel.text ? SPINE_MARGIN_MM : TOP_MARGIN_MM) - area.yMm;
  if (panel.text === 'horizontal') {
    // A wide, short spine (J-card): the mark sits at the right end, vertically centred.
    centeredX = panel.xMm + panel.widthMm - SPINE_MARGIN_MM - widthMm - area.xMm;
    topY = panel.yMm + (panel.heightMm - heightMm) / 2 - area.yMm;
  }
  return { widthMm, heightMm, xMm: logo.xMm ?? centeredX, yMm: logo.yMm ?? topY, area, defaultWidthMm };
}

/** Fills the brand mark, clipped to its panel so it never spills onto a neighbour. `px` is pixels per mm. */
export function drawLogo(ctx: CanvasRenderingContext2D, t: TemplateConfig, panel: PanelRect, brand: Brand, logo: LogoSettings, px: number): void {
  const pl = computeLogoPlacement(t, panel, brandAspect(brand), logo);
  const k = (pl.widthMm * px) / brandWidth(brand);
  ctx.save();
  ctx.beginPath();
  ctx.rect(pl.area.xMm * px, pl.area.yMm * px, pl.area.widthMm * px, pl.area.heightMm * px);
  ctx.clip();
  ctx.globalAlpha = logo.opacity;
  ctx.fillStyle = logo.color;
  ctx.translate((pl.area.xMm + pl.xMm + pl.widthMm / 2) * px, (pl.area.yMm + pl.yMm + pl.heightMm / 2) * px);
  ctx.rotate((logo.rotationDeg * Math.PI) / 180);
  ctx.scale(k, k);
  // Centre the path's tight bounds on the origin so position, size and rotation act on the visible mark.
  ctx.translate(-(brand.bbox[0] + brandWidth(brand) / 2), -(brand.bbox[1] + brandHeight(brand) / 2));
  ctx.fill(brandPath2D(brand));
  ctx.restore();
}
