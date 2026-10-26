import type { PanelId } from '../../types/template';
import type { Axis, CodeLayer, CodeParams, GroupLayer, ImageLayer, ImageSource, Layer, LayerBase, Placement, ShapeLayer, SvgLayer, TextLayer } from '../../types/layers';
import { DEFAULT_BORDER, DEFAULT_CODE, DEFAULT_LOGO } from '../../types/editor';
import { DEFAULT_SPINE_COLOR, DEFAULT_SPINE_FONT, TEXT_EFFECTS } from './defaults';

const base = (id: string, target: PanelId | 'canvas', placement: LayerBase['placement']): LayerBase => ({ id, target, visible: true, placement, rotationDeg: 0, opacity: 1 });

/** A block `width`% wide and `height`% tall, centred on the panel. */
export const centred = (width: number, height: number | 'auto' = 'auto'): Placement => ({
  x: { anchor: 'center', offset: 50, size: width },
  y: { anchor: 'center', offset: 50, size: height },
});

const NO_STROKE = { color: DEFAULT_BORDER.color, widthMm: 0, insetMm: DEFAULT_BORDER.insetMm };

/** A fresh layer of each type with sensible values; callers change what they need. Placed layers start centred. */
export const newShape = (id: string, target: PanelId | 'canvas', o: Partial<ShapeLayer> = {}): ShapeLayer => ({
  ...base(id, target, centred(50, 30)), type: 'shape', shape: 'rect', fill: '#808080', stroke: NO_STROKE, ...o,
});

export const newImage = (id: string, target: PanelId | 'canvas', source: ImageSource | null, o: Partial<ImageLayer> = {}): ImageLayer => ({
  ...base(id, target, centred(40)), type: 'image', source, fit: 'fit', focus: { x: 50, y: 50 }, tint: DEFAULT_LOGO.color, ...o,
});

export const newText = (id: string, target: PanelId | 'canvas', o: Partial<TextLayer> = {}): TextLayer => ({
  ...base(id, target, { x: { anchor: 'center', offset: 50, size: 80 }, y: { anchor: 'start', offset: 8, size: 14 } }),
  type: 'text', text: '{title}', fontFamily: DEFAULT_SPINE_FONT, color: DEFAULT_SPINE_COLOR, align: 'center', weight: 700, italic: false, ...structuredClone(TEXT_EFFECTS), ...o,
});

export const newCode = (id: string, target: PanelId | 'canvas', params: Partial<CodeParams> = {}, o: Partial<CodeLayer> = {}): CodeLayer => ({
  ...base(id, target, null), type: 'generated', generator: 'code',
  params: { kind: 'qr', pattern: DEFAULT_CODE.pattern, color: DEFAULT_CODE.color, background: DEFAULT_CODE.background, ...params }, ...o,
});

/** A folder. It has no placement or look of its own (its target is only a place to file it). */
export const newGroup = (id: string, o: Partial<GroupLayer> = {}): GroupLayer => ({ ...base(id, 'front', null), type: 'group', ...o });

export const newSvg = (id: string, target: PanelId | 'canvas', svg: string, o: Partial<SvgLayer> = {}): SvgLayer => ({
  ...base(id, target, centred(50)), type: 'generated', generator: 'svg', params: { svg }, ...o,
});

/**
 * An id for a layer a user adds, such as `image-k3f9x2`. It is random, not a counter, because ids are shared by every
 * design and item: two levels that each added "image-1" would collide.
 */
export function freshId(type: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  for (;;) {
    const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
    if (!used.has(id)) return id;
  }
}

/**
 * A copy of a layer to put next to it: a new id, a name that says so, and moved a little so it can be told from the
 * original. A layer that mirrors another (a flap's colour) is copied as a plain one.
 */
export function duplicateLayer(layer: Layer, taken: Iterable<string> = []): Layer {
  const copy = structuredClone(layer) as Layer;
  copy.id = freshId(layer.type === 'generated' ? 'code' : layer.type, taken);
  copy.name = `${layer.name ?? ''}`.trim() ? `${layer.name} copy` : undefined;
  delete copy.follows;
  const p = copy.placement;
  if (p && 'x' in p) {
    const shift = (a: Axis): Axis => (a.anchor === 'stretch' ? { ...a, start: a.start + 2, end: a.end - 2 } : { ...a, offset: a.offset + 2 });
    copy.placement = { x: shift(p.x), y: shift(p.y) };
  }
  return copy;
}
