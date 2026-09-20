export type PanelId = 'back' | 'spine' | 'front';

/** Panel geometry in mm, measured from the top-left of the full canvas (bleed included). */
export interface PanelRect {
  id: PanelId;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export type Region = 'US' | 'EU';

export interface TemplateConfig {
  id: string;
  name: string;
  region: Region;
  spineMm: number;
  /** Trim size (excluding bleed). */
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
  /** Full canvas size including bleed. */
  totalWidthMm: number;
  totalHeightMm: number;
  panels: PanelRect[];
  /** Pixels per mm at 300 DPI. */
  dpiScale: number;
}
