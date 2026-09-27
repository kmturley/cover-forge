import type { TemplateConfig, TemplateKind, TemplateVariant } from '../types/template';
import { TEMPLATE_DEFS, type TemplateDef } from './definitions';

export { TEMPLATE_DEFS, type TemplateDef };
export { PX_PER_MM } from './definitions';
export { edgeSegments, neighbour, paintRect } from './geometry';

export const DEFAULT_KIND: TemplateKind = 'dvd';

export function getTemplateDef(kind: TemplateKind): TemplateDef {
  return TEMPLATE_DEFS.find((d) => d.kind === kind) ?? TEMPLATE_DEFS[0];
}

export function isTemplateKind(v: unknown): v is TemplateKind {
  return TEMPLATE_DEFS.some((d) => d.kind === v);
}

export function variantsFor(kind: TemplateKind): TemplateVariant[] {
  return getTemplateDef(kind).variants;
}

export function defaultVariantId(kind: TemplateKind): string {
  return variantsFor(kind)[0].id;
}

/** Builds a template; an unknown variant falls back to the kind's first. */
export function buildTemplate(kind: TemplateKind, variantId?: string): TemplateConfig {
  const def = getTemplateDef(kind);
  const id = def.variants.some((v) => v.id === variantId) ? variantId! : def.variants[0].id;
  return def.build(id);
}

/** The template opened with an empty queue. */
export const DEFAULT_TEMPLATE_ID = 'dvd-std-14';

const built = new Map<string, TemplateConfig>();
/** Builds a template from its library id (`${kind}-${variantId}`), once; an unknown id gets the default template. */
export function buildTemplateById(id: string): TemplateConfig {
  let t = built.get(id);
  if (!t) {
    const def = TEMPLATE_DEFS.find((d) => d.variants.some((v) => `${d.kind}-${v.id}` === id));
    const variant = def?.variants.find((v) => `${def.kind}-${v.id}` === id);
    if (!def || !variant) return id === DEFAULT_TEMPLATE_ID ? buildTemplate(DEFAULT_KIND) : buildTemplateById(DEFAULT_TEMPLATE_ID);
    built.set(id, (t = def.build(variant.id)));
  }
  return t;
}

export function canvasSizePx(t: TemplateConfig): { width: number; height: number } {
  return { width: Math.round(t.totalWidthMm * t.dpiScale), height: Math.round(t.totalHeightMm * t.dpiScale) };
}
