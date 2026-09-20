import type { Region, TemplateConfig } from '../types/template';

export const PX_PER_MM = 300 / 25.4;

const PANEL_WIDTH_MM = 129;
const PANEL_HEIGHT_MM = 149;
const BLEED_MM = 3;

export interface SpineOption {
  mm: number;
  label: string;
}

/** Case thickness (= spine width) options per region. */
export const SPINE_OPTIONS: Record<Region, SpineOption[]> = {
  US: [
    { mm: 11, label: 'Standard' },
    { mm: 12.5, label: 'Elite' },
  ],
  EU: [{ mm: 14, label: 'Standard' }],
};

export const DEFAULT_SPINE: Record<Region, number> = { US: 11, EU: 14 };

export const spineName = (o: SpineOption) => `${o.label} (${o.mm} mm)`;

export function createBlurayTemplate(region: Region, spineMm: number = DEFAULT_SPINE[region]): TemplateConfig {
  const trimWidthMm = PANEL_WIDTH_MM * 2 + spineMm;
  const totalWidthMm = trimWidthMm + BLEED_MM * 2;
  const totalHeightMm = PANEL_HEIGHT_MM + BLEED_MM * 2;
  return {
    id: `bluray-${region.toLowerCase()}-${spineMm}`,
    name: `Blu-ray Keepcase, ${region} ${SPINE_OPTIONS[region].find((o) => o.mm === spineMm)?.label ?? 'Custom'} (${spineMm} mm)`,
    region,
    spineMm,
    trimWidthMm,
    trimHeightMm: PANEL_HEIGHT_MM,
    bleedMm: BLEED_MM,
    totalWidthMm,
    totalHeightMm,
    dpiScale: PX_PER_MM,
    // Wrap layout, left to right: back | spine | front.
    panels: [
      { id: 'back', xMm: BLEED_MM, yMm: BLEED_MM, widthMm: PANEL_WIDTH_MM, heightMm: PANEL_HEIGHT_MM },
      { id: 'spine', xMm: BLEED_MM + PANEL_WIDTH_MM, yMm: BLEED_MM, widthMm: spineMm, heightMm: PANEL_HEIGHT_MM },
      { id: 'front', xMm: BLEED_MM + PANEL_WIDTH_MM + spineMm, yMm: BLEED_MM, widthMm: PANEL_WIDTH_MM, heightMm: PANEL_HEIGHT_MM },
    ],
  };
}
