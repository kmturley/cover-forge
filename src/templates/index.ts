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

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const built = new Map<string, TemplateConfig>();
/**
 * Builds a template from its library id (`${kind}-${variantId}`), once. An unknown id gets its kind's first template
 * (or the default template when the kind is unknown too). The result is shared by every caller, so it is frozen.
 */
export function buildTemplateById(id: string): TemplateConfig {
  const hit = built.get(id);
  if (hit) return hit;
  const def = TEMPLATE_DEFS.find((d) => d.variants.some((v) => `${d.kind}-${v.id}` === id));
  const variant = def?.variants.find((v) => `${def.kind}-${v.id}` === id);
  if (!def || !variant) {
    // Longest kind first, so `nfc-card-…` isn't taken for some shorter kind that is its prefix.
    const byKind = [...TEMPLATE_DEFS].sort((a, b) => b.kind.length - a.kind.length).find((d) => id.startsWith(`${d.kind}-`));
    if (byKind) return buildTemplateById(`${byKind.kind}-${byKind.variants[0].id}`);
    return id === DEFAULT_TEMPLATE_ID ? deepFreeze(buildTemplate(DEFAULT_KIND)) : buildTemplateById(DEFAULT_TEMPLATE_ID);
  }
  const t = deepFreeze(def.build(variant.id));
  built.set(id, t);
  return t;
}

export function canvasSizePx(t: TemplateConfig): { width: number; height: number } {
  return { width: Math.round(t.totalWidthMm * t.dpiScale), height: Math.round(t.totalHeightMm * t.dpiScale) };
}
