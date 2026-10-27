import type { MediaItem } from '../../types/media';
import type { PanelRect, TemplateConfig } from '../../types/template';
import type { Layer } from '../../types/layers';
import { getMark } from '../../brands';
import { boxRect, type RectMm } from '../box';
import { computeCodePlacement, codeAspect } from '../code';
import { computeLogoPlacement, markAspect } from '../logo';
import { computePlacement, paintRect } from '../placement';
import { canvasPanel, codeSettingsOf, logoSettingsOf, markOptions, svgLayerAspect, transformOf, type ImageLookup } from './draw';
import { layerImageUrl, type Assets } from './images';
import { placementToBox } from './placement';

/** Where a layer is on the canvas, for picking and dragging it. */
export interface Bounds {
  layer: Layer;
  /** The panel (or the printed area) its placement is measured against. */
  panel: PanelRect;
  /** Its box, in canvas mm. */
  rect: RectMm;
  rotationDeg: number;
  /** Its placement is automatic (or an older mm one): the first drag turns it into a custom placement. */
  auto: boolean;
  /** It covers its whole panel: a click on the panel shouldn't pick it. */
  whole: boolean;
  /** False for what can't be dragged (a spine's own title, which is fitted along the spine). */
  movable: boolean;
  /** Width / height of its content, which sizes an auto length and keeps proportions when resized. */
  aspect?: number;
}

export interface BoundsEnv {
  template: TemplateConfig;
  item: MediaItem | null;
  assets: Assets | undefined;
  getImage: ImageLookup;
}

const isAnchored = (l: Layer) => !!l.placement && 'x' in l.placement;

/** The box of one layer, or null when it isn't drawn or can't be picked (hidden, on a flap, nothing to show yet). */
export function layerBounds(layer: Layer, env: BoundsEnv): Bounds | null {
  const { template: t, item } = env;
  if (!layer.visible || layer.type === 'group') return null;
  const panel = layer.target === 'canvas' ? canvasPanel(t) : t.panels.find((p) => p.id === layer.target);
  if (!panel || (layer.target !== 'canvas' && panel.follows)) return null;
  const area = paintRect(t, panel);
  const auto = !isAnchored(layer);
  const base = { layer, panel, rotationDeg: layer.rotationDeg, auto, whole: false, movable: true };

  switch (layer.type) {
    case 'shape':
      return isAnchored(layer) ? { ...base, rect: boxRect(panel, placementToBox(panel, layer.placement as never)) } : { ...base, rect: area, whole: true };
    case 'text':
      if (isAnchored(layer)) return { ...base, rect: boxRect(panel, placementToBox(panel, layer.placement as never)), rotationDeg: layer.rotationDeg + (layer.textRotationDeg ?? 0) };
      return panel.text ? { ...base, rect: area, whole: true, movable: false } : null;
    case 'image': {
      if (layer.source?.kind === 'vector') {
        const mark = getMark(layer.source.id);
        if (!mark || !item) return null;
        const aspect = markAspect(mark, markOptions(layer));
        return { ...base, rect: computeLogoPlacement(t, panel, aspect, logoSettingsOf(layer, panel, mark)).box, aspect };
      }
      const img = env.getImage(layerImageUrl(layer, item, env.assets));
      if (!img) return null;
      const aspect = img.naturalWidth / img.naturalHeight;
      const pl = computePlacement(t, panel, img.naturalWidth, img.naturalHeight, transformOf(layer, panel, aspect));
      return { ...base, rect: pl.box, aspect, whole: layer.placement === null };
    }
    case 'generated': {
      if (layer.generator === 'svg') {
        const aspect = item ? svgLayerAspect(layer, item) : null;
        if (!item || aspect === null) return null;
        return isAnchored(layer) ? { ...base, rect: boxRect(panel, placementToBox(panel, layer.placement as never, aspect)), aspect } : { ...base, rect: area, whole: true, aspect };
      }
      if (!item || layer.params.kind === 'none') return null;
      const pl = computeCodePlacement(t, panel, codeSettingsOf(layer, panel));
      return pl?.fits ? { ...base, rect: pl.box, aspect: codeAspect(layer.params.kind) } : null;
    }
  }
}

/** True when a point (canvas mm) is inside the box, which may be rotated about its centre. */
export function containsPoint(b: Pick<Bounds, 'rect' | 'rotationDeg'>, x: number, y: number): boolean {
  const { rect: r } = b;
  const [cx, cy] = [r.xMm + r.widthMm / 2, r.yMm + r.heightMm / 2];
  const a = (-b.rotationDeg * Math.PI) / 180;
  const [dx, dy] = [x - cx, y - cy];
  const [lx, ly] = [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  return Math.abs(lx) <= r.widthMm / 2 && Math.abs(ly) <= r.heightMm / 2;
}

/**
 * The layer a click lands on: the topmost placed one under the point. Layers that cover their whole panel are left to
 * the panel itself, so clicking art selects the panel as it always did. `layers` run bottom to top.
 */
export function layerAt(layers: readonly Layer[], env: BoundsEnv, x: number, y: number): Bounds | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const b = layerBounds(layers[i], env);
    if (b && !b.whole && containsPoint(b, x, y)) return b;
  }
  return null;
}
