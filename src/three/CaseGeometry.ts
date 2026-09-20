import type { BufferAttribute } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { PanelId, TemplateConfig } from '../types/template';

/** Case size in Three.js units (1 unit = 100 mm). Case thickness equals the spine width. */
export const UNITS_PER_MM = 0.01;

export interface UvRange {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** UV rectangle of a panel's trim area within the flat texture (bleed excluded). v is bottom-up. */
export function panelUvRange(t: TemplateConfig, id: PanelId): UvRange {
  const p = t.panels.find((q) => q.id === id);
  if (!p) throw new Error(`Template has no ${id} panel`);
  return {
    u0: p.xMm / t.totalWidthMm,
    u1: (p.xMm + p.widthMm) / t.totalWidthMm,
    v0: 1 - (p.yMm + p.heightMm) / t.totalHeightMm,
    v1: 1 - p.yMm / t.totalHeightMm,
  };
}

/** BoxGeometry face order: +X (open edge), -X (spine), +Y (top), -Y (bottom), +Z (front), -Z (back). */
const FACE_PANELS: (PanelId | null)[] = [null, 'spine', null, null, 'front', 'back'];

/** Corner/edge radius in Three.js units (2.5 mm), close to a real keepcase. */
export const CASE_RADIUS = 0.025;
const CORNER_SEGMENTS = 4;

export function createCaseGeometry(t: TemplateConfig): RoundedBoxGeometry {
  const front = t.panels.find((p) => p.id === 'front')!;
  const geo = new RoundedBoxGeometry(
    front.widthMm * UNITS_PER_MM,
    front.heightMm * UNITS_PER_MM,
    t.spineMm * UNITS_PER_MM,
    CORNER_SEGMENTS,
    CASE_RADIUS,
  );
  const uv = geo.getAttribute('uv') as BufferAttribute;

  // The geometry is non-indexed and each face group is a contiguous vertex range whose UVs span 0..1
  // (including the rounded edges), so each group is remapped linearly onto its panel's trim area.
  for (const g of geo.groups) {
    const panel = FACE_PANELS[g.materialIndex ?? 0];
    const range = panel ? panelUvRange(t, panel) : null;
    for (let i = g.start; i < g.start + g.count; i++) {
      if (!range) {
        uv.setXY(i, 0, 0); // non-artwork faces use the casing material and never sample the map
        continue;
      }
      uv.setXY(i, range.u0 + uv.getX(i) * (range.u1 - range.u0), range.v0 + uv.getY(i) * (range.v1 - range.v0));
    }
  }
  uv.needsUpdate = true;
  return geo;
}
