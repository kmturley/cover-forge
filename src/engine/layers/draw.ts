import type { MediaItem } from '../../types/media';
import type { PanelId, PanelRect, TemplateConfig } from '../../types/template';
import type { CodeSettings, LogoSettings, PanelTransform } from '../../types/editor';
import { DEFAULT_CODE, DEFAULT_LOGO, DEFAULT_TRANSFORM } from '../../types/editor';
import type { GeneratedLayer, ImageLayer, Layer, LayerPlacement, LegacyMm, Placement, ShapeLayer, TextLayer } from '../../types/layers';
import { getMark, type Mark } from '../../brands';
import { layerImageUrl, type Assets } from './images';
import { computePlacement, paintRect } from '../placement';
import { boxRect } from '../box';
import { drawBorder } from '../border';
import { drawLogo } from '../logo';
import { codeAspect, drawCode } from '../code';
import { drawSpineText, spineText } from '../SpineTypography';
import type { PanelBox } from '../../types/editor';
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
  if (l.placement === null && l.shape === 'rect') {
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
  const [hw, hh] = [(box.widthMm / 2) * px, (box.heightMm / 2) * px];
  if (l.fill) {
    ctx.fillStyle = l.fill;
    if (l.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
  }
  if (l.stroke.widthMm > 0) {
    const inset = l.stroke.insetMm + l.stroke.widthMm / 2;
    const [w, h] = [box.widthMm - inset * 2, box.heightMm - inset * 2];
    if (w > 0 && h > 0) {
      ctx.strokeStyle = l.stroke.color;
      ctx.lineWidth = l.stroke.widthMm * px;
      if (l.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(0, 0, (w / 2) * px, (h / 2) * px, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else ctx.strokeRect((-w / 2) * px, (-h / 2) * px, w * px, h * px);
    }
  }
  ctx.restore();
}

/** An image layer's placement in the shape the image placement helpers take. `aspect` is the image's width / height. */
export function transformOf(l: ImageLayer, panel: PanelRect, aspect: number): PanelTransform {
  return { ...DEFAULT_TRANSFORM, ...legacyOf(l.placement), box: boxOf(panel, l.placement, aspect) as PanelTransform['box'], fit: l.fit, focus: l.focus, rotationDeg: l.rotationDeg, opacity: l.opacity };
}

/** A mark layer's placement and look in the shape the logo helpers take. */
export function logoSettingsOf(l: ImageLayer, panel: PanelRect, mark: Mark): LogoSettings {
  return { ...DEFAULT_LOGO, ...legacyOf(l.placement), color: l.tint, box: boxOf(panel, l.placement, mark.aspect) as LogoSettings['box'], rotationDeg: l.rotationDeg, opacity: l.opacity };
}

/** A code layer's placement and look in the shape the code helpers take. */
export function codeSettingsOf(l: GeneratedLayer, panel: PanelRect): CodeSettings {
  const kind = l.params.kind;
  return { ...DEFAULT_CODE, ...l.params, ...legacyOf(l.placement), box: boxOf(panel, l.placement, kind === 'none' ? undefined : codeAspect(kind)) as CodeSettings['box'], rotationDeg: l.rotationDeg, opacity: l.opacity };
}

function drawImage(env: DrawEnv, l: ImageLayer, panel: PanelRect) {
  const { ctx, template: t, px, item } = env;
  if (l.source?.kind === 'vector') {
    const mark = getMark(l.source.id);
    if (!mark || !item) return;
    drawLogo(ctx, t, panel, mark, logoSettingsOf(l, panel, mark), px);
    return;
  }
  const img = env.getImage(layerImageUrl(l, item, env.assets));
  if (!img) return;
  const tr = transformOf(l, panel, img.naturalWidth / img.naturalHeight);
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
  if (!item || l.params.kind === 'none') return;
  drawCode(env.ctx, env.template, panel, codeSettingsOf(l, panel), item, env.px);
}

/** Cap height as a share of the font size, for sizing text by its cap height as spine text is. */
const CAP_EM = 0.72;
const LINE_HEIGHT = 1.2;
const MIN_TEXT_MM = 1.2;
/** Where text goes on a panel that has no spine orientation when it has no placement of its own. */
const DEFAULT_TEXT_BOX: PanelBox = { xStart: 8, xEnd: 92, yStart: 8, yEnd: 22 };

/** Letter spacing where the browser supports it on the canvas (Chrome, Edge and recent Firefox and Safari); elsewhere text is set without it. */
function setSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}

/** The text split into lines no wider than `maxPx` (a word longer than a line is kept whole). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxPx: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxPx) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Text in a box: wrapped to its width, as large as fits it unless a height is set, aligned, rotated about the box's centre. */
function drawTextBox(env: DrawEnv, l: TextLayer, panel: PanelRect) {
  const { ctx, item, px } = env;
  if (!item) return;
  const text = spineText(item, { text: l.text, textTemplate: l.textTemplate });
  if (!text) return;
  const box = boxRect(panel, isAnchored(l.placement) ? placementToBox(panel, l.placement) : DEFAULT_TEXT_BOX);
  if (box.widthMm <= 0 || box.heightMm <= 0) return;
  const font = (mm: number) => `${l.italic ? 'italic ' : ''}${l.weight} ${mm * px}px ${l.fontFamily}`;
  const spacing = `${l.letterSpacing / 1000}em`;
  const layout = (mm: number) => {
    ctx.font = font(mm);
    setSpacing(ctx, spacing);
    const lines = wrap(ctx, text, box.widthMm * px);
    const widest = Math.max(...lines.map((s) => ctx.measureText(s).width));
    return { lines, fits: widest <= box.widthMm * px + 0.5 && lines.length * mm * LINE_HEIGHT <= box.heightMm };
  };
  let mm = l.textHeightMm !== undefined ? l.textHeightMm / CAP_EM : box.heightMm;
  if (l.textHeightMm === undefined) {
    // The largest size at which the wrapped text still fits the box.
    let [lo, hi] = [MIN_TEXT_MM, box.heightMm];
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (layout(mid).fits) lo = mid;
      else hi = mid;
    }
    mm = lo;
  }
  const { lines } = layout(mm);
  const area = paintRect(env.template, panel);
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.xMm * px, area.yMm * px, area.widthMm * px, area.heightMm * px);
  ctx.clip();
  ctx.globalAlpha = l.opacity;
  ctx.translate((box.xMm + box.widthMm / 2) * px, (box.yMm + box.heightMm / 2) * px);
  ctx.rotate(((l.rotationDeg + (l.textRotationDeg ?? 0)) * Math.PI) / 180);
  ctx.font = font(mm);
  setSpacing(ctx, spacing);
  ctx.fillStyle = l.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = l.align;
  const x = l.align === 'left' ? (-box.widthMm / 2) * px : l.align === 'right' ? (box.widthMm / 2) * px : 0;
  const lineMm = mm * LINE_HEIGHT;
  const hasStroke = l.textStroke.widthMm > 0;
  const { blurMm, xMm, yMm } = l.shadow;
  if (blurMm > 0 || xMm !== 0 || yMm !== 0) {
    ctx.shadowColor = l.shadow.color;
    ctx.shadowBlur = blurMm * px;
    ctx.shadowOffsetX = xMm * px;
    ctx.shadowOffsetY = yMm * px;
  }
  if (hasStroke) {
    ctx.strokeStyle = l.textStroke.color;
    ctx.lineWidth = l.textStroke.widthMm * px;
    ctx.lineJoin = 'round';
  }
  lines.forEach((line, i) => {
    const y = ((i - (lines.length - 1) / 2) * lineMm) * px;
    // The outline goes under the fill, so it only shows outside the letters.
    if (hasStroke) ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });
  ctx.restore();
}

/** A spine's own text, as the text helpers take it, with the Branded dress's say over colour, case and clearance. */
function drawSpineLayer(env: DrawEnv, l: TextLayer, panel: PanelRect) {
  const { item, template: t, banner } = env;
  if (!item || !panel.text) return;
  const chosen = { fontFamily: l.fontFamily, color: l.color, textHeightMm: l.textHeightMm, rotationDeg: l.textRotationDeg, text: l.text, textTemplate: l.textTemplate };
  const settings = { ...chosen, color: spineTitleColor(t.kind, t.variantId, banner, chosen.color) };
  const length = panel.text === 'vertical' ? panel.heightMm : panel.widthMm;
  drawSpineText(env.ctx, panel, spineTitleCase(t.kind, t.variantId, banner, spineText(item, settings)), settings, env.px, panel.text, { start: spineTitleStartMm(t.kind, t.variantId, banner, length), end: 0 }, spineTitleScale(t.kind, t.variantId, banner));
}

/** Text on a spine with no placement of its own is the spine title; any other text is set in its box. */
function drawText(env: DrawEnv, l: TextLayer, panel: PanelRect) {
  if (panel.text && l.placement === null) drawSpineLayer(env, l, panel);
  else drawTextBox(env, l, panel);
}

/**
 * The part of the canvas that carries art: the bounding rectangle of the panels that can be designed, which is what a
 * layer on the `canvas` target is placed against (assembly flaps are left out; see layer-system-plan.md §2.10).
 */
export function canvasPanel(t: TemplateConfig): PanelRect {
  const own = t.panels.filter((p) => !p.follows);
  const list = own.length > 0 ? own : t.panels;
  const [x0, y0] = [Math.min(...list.map((p) => p.xMm)), Math.min(...list.map((p) => p.yMm))];
  const [x1, y1] = [Math.max(...list.map((p) => p.xMm + p.widthMm)), Math.max(...list.map((p) => p.yMm + p.heightMm))];
  return { id: 'front', label: 'Canvas', xMm: x0, yMm: y0, widthMm: x1 - x0, heightMm: y1 - y0 };
}

/** Clips to the panels that carry art, with their bleed, so a layer across the canvas never paints on a flap or in a gap. */
function clipToArt(ctx: CanvasRenderingContext2D, t: TemplateConfig, px: number) {
  ctx.beginPath();
  for (const p of t.panels) {
    if (p.follows) continue;
    const a = paintRect(t, p);
    ctx.rect(a.xMm * px, a.yMm * px, a.widthMm * px, a.heightMm * px);
  }
  ctx.clip();
}

/** Draws the layers bottom to top. Each is placed against its panel and, but for the Branded dress, clipped to it. */
export function drawLayers(env: DrawEnv, layers: readonly Layer[]): void {
  const panels = new Map(env.template.panels.map((p) => [p.id, p]));
  const canvas = layers.some((l) => l.target === 'canvas') ? canvasPanel(env.template) : null;
  for (const l of layers) {
    if (!l.visible) continue;
    if (l.type === 'official') {
      if (env.banner) drawOfficial(env.ctx, env.template, env.px);
      continue;
    }
    const onCanvas = l.target === 'canvas';
    const panel = onCanvas ? canvas : panels.get(l.target as PanelId);
    if (!panel) continue;
    // Flaps and tabs that fold away only carry their panel's colour; nothing else is drawn on them.
    if (!onCanvas && panel.follows && !l.follows) continue;
    if (onCanvas) {
      env.ctx.save();
      clipToArt(env.ctx, env.template, env.px);
    }
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
    if (onCanvas) env.ctx.restore();
  }
}
