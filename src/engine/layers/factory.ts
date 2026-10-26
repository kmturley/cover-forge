import type { PanelId } from '../../types/template';
import type { CodeParams, GeneratedLayer, ImageLayer, ImageSource, LayerBase, Placement, ShapeLayer, TextLayer } from '../../types/layers';
import { DEFAULT_BORDER, DEFAULT_CODE, DEFAULT_LOGO } from '../../types/editor';
import { DEFAULT_SPINE_COLOR, DEFAULT_SPINE_FONT } from './defaults';

const base = (id: string, target: PanelId, placement: LayerBase['placement']): LayerBase => ({ id, target, visible: true, placement, rotationDeg: 0, opacity: 1 });

/** A block `width`% wide and `height`% tall, centred on the panel. */
export const centred = (width: number, height: number | 'auto' = 'auto'): Placement => ({
  x: { anchor: 'center', offset: 50, size: width },
  y: { anchor: 'center', offset: 50, size: height },
});

const NO_STROKE = { color: DEFAULT_BORDER.color, widthMm: 0, insetMm: DEFAULT_BORDER.insetMm };

/** A fresh layer of each type with sensible values; callers change what they need. Placed layers start centred. */
export const newShape = (id: string, target: PanelId, o: Partial<ShapeLayer> = {}): ShapeLayer => ({
  ...base(id, target, centred(50, 30)), type: 'shape', shape: 'rect', fill: '#808080', stroke: NO_STROKE, ...o,
});

export const newImage = (id: string, target: PanelId, source: ImageSource | null, o: Partial<ImageLayer> = {}): ImageLayer => ({
  ...base(id, target, centred(40)), type: 'image', source, fit: 'fit', tint: DEFAULT_LOGO.color, ...o,
});

export const newText = (id: string, target: PanelId, o: Partial<TextLayer> = {}): TextLayer => ({
  ...base(id, target, { x: { anchor: 'center', offset: 50, size: 80 }, y: { anchor: 'start', offset: 8, size: 14 } }),
  type: 'text', text: '{title}', fontFamily: DEFAULT_SPINE_FONT, color: DEFAULT_SPINE_COLOR, ...o,
});

export const newCode = (id: string, target: PanelId, params: Partial<CodeParams> = {}, o: Partial<GeneratedLayer> = {}): GeneratedLayer => ({
  ...base(id, target, null), type: 'generated', generator: 'code',
  params: { kind: 'qr', pattern: DEFAULT_CODE.pattern, color: DEFAULT_CODE.color, background: DEFAULT_CODE.background, ...params }, ...o,
});

/** An id no layer in the list has, such as `image-3`. */
export function freshId(type: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let n = 1; ; n++) if (!used.has(`${type}-${n}`)) return `${type}-${n}`;
}
