import type { PanelRect, TemplateConfig } from '../types/template';
import type { PanelTransform } from '../types/editor';

/** A panel's paint area: the trim rect, extended into the bleed on any edge that touches the canvas edge. */
export function paintRect(t: TemplateConfig, p: PanelRect): PanelRect {
  const left = p.xMm <= t.bleedMm ? t.bleedMm : 0;
  const right = p.xMm + p.widthMm >= t.totalWidthMm - t.bleedMm ? t.bleedMm : 0;
  return {
    ...p,
    xMm: p.xMm - left,
    yMm: p.yMm - t.bleedMm,
    widthMm: p.widthMm + left + right,
    heightMm: p.heightMm + t.bleedMm * 2,
  };
}

export interface Placement {
  /** mm per source pixel. */
  fit: number;
  /** Displayed (unrotated) image size in mm. */
  widthMm: number;
  heightMm: number;
  /**
   * Image top-left relative to the panel's paint area top-left, in mm: the panel's visible corner on the canvas,
   * i.e. including bleed on edges that meet the page edge. Negative = starts left of / above it.
   */
  xMm: number;
  yMm: number;
  /** The panel's paint area (the reference for xMm/yMm). */
  area: PanelRect;
  /** The x/y that would centre the image on the panel's paint area. */
  centeredXMm: number;
  centeredYMm: number;
}

/**
 * Where an image sits in its panel. Scale 1 is "cover" (fills the paint area, bleed included).
 * `xMm`/`yMm` are measured from the paint area's top-left corner; `null` means centred, which is the default.
 */
export function computePlacement(
  t: TemplateConfig,
  panel: PanelRect,
  naturalWidth: number,
  naturalHeight: number,
  tr: PanelTransform,
): Placement {
  const area = paintRect(t, panel);
  const fit = Math.max(area.widthMm / naturalWidth, area.heightMm / naturalHeight) * tr.scale;
  const widthMm = naturalWidth * fit;
  const heightMm = naturalHeight * fit;
  const centeredXMm = (area.widthMm - widthMm) / 2;
  const centeredYMm = (area.heightMm - heightMm) / 2;
  return {
    fit,
    widthMm,
    heightMm,
    area,
    xMm: tr.xMm ?? centeredXMm,
    yMm: tr.yMm ?? centeredYMm,
    centeredXMm,
    centeredYMm,
  };
}
