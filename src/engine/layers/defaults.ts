import type { TemplateConfig } from '../../types/template';
import type { Layer } from '../../types/layers';
import { DEFAULT_BORDER, DEFAULT_CODE, DEFAULT_LOGO } from '../../types/editor';
import { defaultCodeKind } from '../resolve';

const NO_STROKE = { color: DEFAULT_BORDER.color, widthMm: DEFAULT_BORDER.widthMm, insetMm: DEFAULT_BORDER.insetMm };

/** What spine text starts as; the Default design's spine settings (always set in the app) patch over it. */
export const DEFAULT_SPINE_FONT = 'Helvetica, Arial, sans-serif';
export const DEFAULT_SPINE_COLOR = '#ffffff';

const CENTRE = { x: 50, y: 50 };

/** Text starts with no letter spacing, outline or shadow. */
export const TEXT_EFFECTS = { letterSpacing: 0, textStroke: { color: '#000000', widthMm: 0 }, shadow: { color: '#000000', blurMm: 0, xMm: 0, yMm: 0 } } as const;

const base = { visible: true, placement: null, rotationDeg: 0, opacity: 1 } as const;

const cache = new WeakMap<TemplateConfig, Layer[]>();

/**
 * The layers a case starts with, bottom to top, before any design or item changes them. Ids are named by target
 * (`front.image`, `spine.text`) and are a public format: every saved diff refers to them, so they never change once
 * released (layer-system-plan.md §2.6). The order reproduces the slot renderer's passes, panel by panel (fill, image,
 * border), then the Branded dress, spine text, logos, and codes on top.
 */
export function defaultLayers(t: TemplateConfig): Layer[] {
  const hit = cache.get(t);
  if (hit) return hit;
  const out: Layer[] = [];
  for (const p of t.panels) {
    // A dust flap is plain: it only mirrors its panel's colour.
    out.push({ ...base, id: `${p.id}.fill`, type: 'shape', shape: 'rect', target: p.id, fill: null, stroke: NO_STROKE, ...(p.follows && { follows: `${p.follows}.fill` }) });
    if (p.follows) continue;
    out.push({ ...base, id: `${p.id}.image`, type: 'image', target: p.id, source: { kind: 'role', ref: 'auto' }, fit: 'fill', focus: CENTRE, tint: DEFAULT_LOGO.color });
    out.push({ ...base, id: `${p.id}.border`, type: 'shape', shape: 'rect', target: p.id, fill: null, stroke: NO_STROKE });
  }
  const first = t.panels[0]?.id;
  if (first) out.push({ ...base, id: 'official', type: 'official', target: first });
  for (const p of t.panels) {
    if (p.text) out.push({ ...base, id: `${p.id}.text`, type: 'text', target: p.id, fontFamily: DEFAULT_SPINE_FONT, color: DEFAULT_SPINE_COLOR, align: 'center', weight: 700, italic: false, ...TEXT_EFFECTS });
  }
  for (const p of t.panels) {
    if (!p.follows) out.push({ ...base, id: `${p.id}.logo`, type: 'image', target: p.id, source: null, fit: 'fit', focus: CENTRE, tint: DEFAULT_LOGO.color });
  }
  for (const p of t.panels) {
    if (!p.follows) {
      const kind = defaultCodeKind(t.kind, p.id);
      out.push({ ...base, id: `${p.id}.code`, type: 'generated', generator: 'code', target: p.id, params: { kind, pattern: DEFAULT_CODE.pattern, color: DEFAULT_CODE.color, background: DEFAULT_CODE.background } });
    }
  }
  cache.set(t, out);
  return out;
}
