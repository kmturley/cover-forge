import type { PanelRect, TemplateConfig } from '../types/template';
import type { LogoSettings } from '../types/editor';
import { brandAspect, brandHeight, brandPath2D, brandWidth, type Brand } from '../brands';
import { paintRect } from './placement';

/** Default logo width for front/back; the spine uses a share of its own (narrow) width instead. */
const DEFAULT_WIDTH_MM = 24;
const SPINE_WIDTH_SHARE = 0.7;
const BOTTOM_MARGIN_MM = 8;
const SPINE_BOTTOM_MARGIN_MM = 6;

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
 * trimmed panel and sitting near the bottom (the usual spot for a store or platform mark).
 */
export function computeLogoPlacement(t: TemplateConfig, panel: PanelRect, aspect: number, logo: LogoSettings): LogoPlacement {
  const area = paintRect(t, panel);
  const defaultWidthMm = panel.id === 'spine' ? panel.widthMm * SPINE_WIDTH_SHARE : DEFAULT_WIDTH_MM;
  const widthMm = logo.widthMm ?? defaultWidthMm;
  const heightMm = widthMm / aspect;
  const margin = panel.id === 'spine' ? SPINE_BOTTOM_MARGIN_MM : BOTTOM_MARGIN_MM;
  const centeredX = panel.xMm + (panel.widthMm - widthMm) / 2 - area.xMm;
  const bottomY = panel.yMm + panel.heightMm - margin - heightMm - area.yMm;
  return { widthMm, heightMm, xMm: logo.xMm ?? centeredX, yMm: logo.yMm ?? bottomY, area, defaultWidthMm };
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
