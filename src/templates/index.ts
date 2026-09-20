import { createBlurayTemplate, DEFAULT_SPINE, SPINE_OPTIONS, spineName } from './bluray';
import type { Region, TemplateConfig } from '../types/template';

export { createBlurayTemplate, DEFAULT_SPINE, SPINE_OPTIONS, spineName };

/** All templates available for a region. v1 ships Blu-ray only. */
export function templatesForRegion(region: Region): TemplateConfig[] {
  return SPINE_OPTIONS[region].map((o) => createBlurayTemplate(region, o.mm));
}

export function canvasSizePx(t: TemplateConfig): { width: number; height: number } {
  return { width: Math.round(t.totalWidthMm * t.dpiScale), height: Math.round(t.totalHeightMm * t.dpiScale) };
}
