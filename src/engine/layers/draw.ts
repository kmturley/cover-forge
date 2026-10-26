import type { MediaItem } from '../../types/media';
import type { PanelRect, TemplateConfig } from '../../types/template';
import type { CodeSettings, LogoSettings, PanelTransform } from '../../types/editor';
import { DEFAULT_CODE, DEFAULT_LOGO, DEFAULT_TRANSFORM } from '../../types/editor';
import type { GeneratedLayer, ImageLayer, Layer, LayerPlacement, LegacyMm, Placement, ShapeLayer, TextLayer } from '../../types/layers';
import { getMark } from '../../brands';
import { layerImageUrl, type Assets } from './images';
import { computePlacement, paintRect } from '../placement';
import { boxRect } from '../box';
import { drawBorder } from '../border';
import { drawLogo } from '../logo';
import { codeAspect, drawCode } from '../code';
import { drawSpineText, spineText } from '../SpineTypography';
import { drawOfficial, spineTitleCase, spineTitleColor, spineTitleScale, spineTitleStartMm } from '../official';
import { placementToBox } from './placement';

export type ImageLookup = (url: string | null | undefined) => HTMLImageElement | null;

/** What drawing a layer needs besides the layer itself. */
export interface DrawEnv {
  ctx: CanvasRenderingContext2D;
  template: TemplateConfig;
  item: MediaItem | null;
  /** Pixels per mm. */
  px: number;
  getImage: ImageLookup;
  /** The session's asset library, for image layers that use one. */
  assets?: Assets;
  /** The Branded toggle: the `official` layer is drawn only while it is on. */
  banner: boolean;
}

const isLegacy = (p: LayerPlacement): p is LegacyMm => !!p && 'kind' in p;
const isAnchored = (p: LayerPlacement): p is Placement => !!p && 'x' in p;

/**
 * The percent box a layer's placement covers, in the shape the placement helpers take: `null` = automatic, `undefined`
 * = an older save's mm fields (those helpers then read the mm fields instead). `aspect` is the content's, for auto sizes.
 */
function boxOf(panel: PanelRect, p: LayerPlacement, aspect?: number) {
  if (p === null) return null;
  if (isLegacy(p)) return undefined;
  return placementToBox(panel, p, aspect);
}

/** An older save's mm fields, without the marker. */
function legacyOf(p: LayerPlacement): Omit<LegacyMm, 'kind'> {
  if (!isLegacy(p)) return {};
  const { kind: _kind, ...fields } = p;
  void _kind;
  return fields;
}

/** Fills a rectangle, snapped outwards to whole pixels so neighbouring panels leave no hairline between them. */
function fillSnapped(ctx: CanvasRenderingContext2D, color: string, area: { xMm: number; yMm: number; widthMm: number; heightMm: number }, px: number) {
  ctx.fillStyle = color;
  const [x0, y0] = [Math.floor(area.xMm * px), Math.floor(area.yMm * px)];
  ctx.fillRect(x0, y0, Math.ceil((area.xMm + area.widthMm) * px) - x0, Math.ceil((area.yMm + area.heightMm) * px) - y0);
}

function drawShape(env: DrawEnv, l: ShapeLayer, panel: PanelRect) {
  const { ctx, template: t, px } = env;
  const area = paintRect(t, panel);
  if (l.placement === null) {
    if (l.fill) fillSnapped(ctx, l.fill, area, px);
    drawBorder(ctx, panel, l.stroke, px);
    return;
  }
  // A placed shape: its box on the panel, clipped to the panel's paint area.
  const box = isAnchored(l.placement) ? boxRect(panel, placementToBox(panel, l.placement)) : area;
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.xMm * px, area.yMm * px, area.widthMm * px, area.heightMm * px);
  ctx.clip();
  ctx.globalAlpha = l.opacity;
  ctx.translate((box.xMm + box.widthMm / 2) * px, (box.yMm + box.heightMm / 2) * px);
  ctx.rotate((l.rotationDeg * Math.PI) / 180);
  if (l.fill) {
    ctx.fillStyle = l.fill;
    ctx.fillRect((-box.widthMm / 2) * px, (-box.heightMm / 2) * px, box.widthMm * px, box.heightMm * px);
  }
  if (l.stroke.widthMm > 0) {
    const inset = l.stroke.insetMm + l.stroke.widthMm / 2;
    const [w, h] = [box.widthMm - inset * 2, box.heightMm - inset * 2];
    if (w > 0 && h > 0) {
      ctx.strokeStyle = l.stroke.color;
      ctx.lineWidth = l.stroke.widthMm * px;
      ctx.strokeRect((-w / 2) * px, (-h / 2) * px, w * px, h * px);
    }
  }
  ctx.restore();
}

function drawImage(env: DrawEnv, l: ImageLayer, panel: PanelRect) {
  const { ctx, template: t, px, item } = env;
  if (l.source?.kind === 'vector') {
    const mark = getMark(l.source.id);
    if (!mark || !item) return;
    const logo: LogoSettings = { ...DEFAULT_LOGO, ...legacyOf(l.placement), color: l.tint, box: boxOf(panel, l.placement, mark.aspect) as LogoSettings['box'], rotationDeg: l.rotationDeg, opacity: l.opacity };
    drawLogo(ctx, t, panel, mark, logo, px);
    return;
  }
  const img = env.getImage(layerImageUrl(l, item, env.assets));
  if (!img) return;
  const tr: PanelTransform = { ...DEFAULT_TRANSFORM, ...legacyOf(l.placement), box: boxOf(panel, l.placement, img.naturalWidth / img.naturalHeight) as PanelTransform['box'], fit: l.fit, rotationDeg: l.rotationDeg, opacity: l.opacity };
  // Sized to its box (filling or fitting it) and clipped to it when filling; rotation is about the image centre.
  const pl = computePlacement(t, panel, img.naturalWidth, img.naturalHeight, tr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(pl.clip.xMm * px, pl.clip.yMm * px, pl.clip.widthMm * px, pl.clip.heightMm * px);
  ctx.clip();
  ctx.globalAlpha = tr.opacity ?? 1;
  ctx.translate((pl.area.xMm + pl.xMm + pl.widthMm / 2) * px, (pl.area.yMm + pl.yMm + pl.heightMm / 2) * px);
  ctx.rotate((tr.rotationDeg * Math.PI) / 180);
  ctx.scale(pl.fit * px, pl.fit * px);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
}

function drawGenerated(env: DrawEnv, l: GeneratedLayer, panel: PanelRect) {
  const { item } = env;
  const kind = l.params.kind;
  if (!item || kind === 'none') return;
  const code: CodeSettings = { ...DEFAULT_CODE, ...l.params, ...legacyOf(l.placement), box: boxOf(panel, l.placement, codeAspect(kind)) as CodeSettings['box'], rotationDeg: l.rotationDeg, opacity: l.opacity };
  drawCode(env.ctx, env.template, panel, code, item, env.px);
}

/** The spine's own settings, as the text helpers take them, with the Branded dress's say over colour, case and clearance. */
function drawText(env: DrawEnv, l: TextLayer, panel: PanelRect) {
  const { item, template: t, banner } = env;
  if (!item || !panel.text) return;
  const chosen = { fontFamily: l.fontFamily, color: l.color, textHeightMm: l.textHeightMm, rotationDeg: l.textRotationDeg, text: l.text, textTemplate: l.textTemplate };
  const settings = { ...chosen, color: spineTitleColor(t.kind, t.variantId, banner, chosen.color) };
  const length = panel.text === 'vertical' ? panel.heightMm : panel.widthMm;
  drawSpineText(env.ctx, panel, spineTitleCase(t.kind, t.variantId, banner, spineText(item, settings)), settings, env.px, panel.text, { start: spineTitleStartMm(t.kind, t.variantId, banner, length), end: 0 }, spineTitleScale(t.kind, t.variantId, banner));
}

/** Draws the layers bottom to top. Each is placed against its panel and, but for the Branded dress, clipped to it. */
export function drawLayers(env: DrawEnv, layers: readonly Layer[]): void {
  const panels = new Map(env.template.panels.map((p) => [p.id, p]));
  for (const l of layers) {
    if (!l.visible) continue;
    if (l.type === 'official') {
      if (env.banner) drawOfficial(env.ctx, env.template, env.px);
      continue;
    }
    const panel = panels.get(l.target);
    if (!panel) continue;
    switch (l.type) {
      case 'shape':
        drawShape(env, l, panel);
        break;
      case 'image':
        drawImage(env, l, panel);
        break;
      case 'generated':
        drawGenerated(env, l, panel);
        break;
      case 'text':
        drawText(env, l, panel);
        break;
    }
  }
}
