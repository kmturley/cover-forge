import type { Region, TemplateConfig, TemplateKind, TemplateVariant } from '../types/template';
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

/** Regions a template's variants are tied to (only Blu-ray has them). */
export function regionsOf(kind: TemplateKind): Region[] {
  return [...new Set(getTemplateDef(kind).variants.flatMap((v) => (v.region ? [v.region] : [])))];
}

export function variantsFor(kind: TemplateKind, region?: Region): TemplateVariant[] {
  const all = getTemplateDef(kind).variants;
  return region && regionsOf(kind).length ? all.filter((v) => v.region === region) : all;
}

export function defaultVariantId(kind: TemplateKind, region?: Region): string {
  return (variantsFor(kind, region)[0] ?? getTemplateDef(kind).variants[0]).id;
}

/** Builds a template; an unknown variant falls back to the kind's first. */
export function buildTemplate(kind: TemplateKind, variantId?: string): TemplateConfig {
  const def = getTemplateDef(kind);
  const id = def.variants.some((v) => v.id === variantId) ? variantId! : def.variants[0].id;
  return def.build(id);
}

export function canvasSizePx(t: TemplateConfig): { width: number; height: number } {
  return { width: Math.round(t.totalWidthMm * t.dpiScale), height: Math.round(t.totalHeightMm * t.dpiScale) };
}
