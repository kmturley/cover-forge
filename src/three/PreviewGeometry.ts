import { ExtrudeGeometry, PlaneGeometry, Shape, ShapeGeometry, type BufferAttribute } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BoxFace, PanelId, PreviewSpec, TemplateConfig } from '../types/template';

/** Models are built in mm and scaled so their largest dimension is this many Three.js units. */
export const TARGET_SIZE_UNITS = 1.6;

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

/** BoxGeometry face (material group) order. */
export const FACE_ORDER: BoxFace[] = ['+x', '-x', '+y', '-y', '+z', '-z'];

export function modelSizeMm(spec: PreviewSpec): [number, number, number] {
  return spec.kind === 'box' ? [spec.widthMm, spec.heightMm, spec.depthMm] : [spec.bodyWidthMm, spec.bodyHeightMm, spec.bodyDepthMm];
}

/** mm → Three.js units, so every template fills the viewport comparably. */
export const previewScale = (spec: PreviewSpec) => TARGET_SIZE_UNITS / Math.max(...modelSizeMm(spec));

const CORNER_SEGMENTS = 4;

/**
 * The rounded body of a case, sleeve or card. The geometry is non-indexed and each face group is a contiguous vertex
 * range whose UVs span 0..1 (including the rounded edges), so each printed face is remapped linearly onto its panel.
 * `printed` maps faces to panels; faces not listed get zeroed UVs (they use the plain body material).
 */
export function createBodyGeometry(t: TemplateConfig, spec: PreviewSpec): RoundedBoxGeometry {
  const [w, h, d] = modelSizeMm(spec);
  const radius = spec.radiusMm;
  const geo = new RoundedBoxGeometry(w, h, d, CORNER_SEGMENTS, radius);
  const printed = printedFaces(spec);
  const uv = geo.getAttribute('uv') as BufferAttribute;

  for (const g of geo.groups) {
    const panel = printed[FACE_ORDER[g.materialIndex ?? 0]];
    const range = panel ? panelUvRange(t, panel) : null;
    for (let i = g.start; i < g.start + g.count; i++) {
      if (!range) {
        uv.setXY(i, 0, 0);
        continue;
      }
      uv.setXY(i, range.u0 + uv.getX(i) * (range.u1 - range.u0), range.v0 + uv.getY(i) * (range.v1 - range.v0));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Which faces carry artwork directly on the body. */
export function printedFaces(spec: PreviewSpec): Partial<Record<BoxFace, PanelId>> {
  if (spec.kind === 'box') return spec.faces;
  return spec.fullFace ? { '+z': spec.panel, ...(spec.backPanel && { '-z': spec.backPanel }) } : {};
}

/** A flat label (e.g. a floppy label) whose UVs cover exactly the panel's trim area. */
export function createLabelGeometry(t: TemplateConfig, id: PanelId): PlaneGeometry {
  const p = t.panels.find((q) => q.id === id)!;
  const range = panelUvRange(t, id);
  const geo = new PlaneGeometry(p.widthMm, p.heightMm);
  const uv = geo.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, range.u0 + uv.getX(i) * (range.u1 - range.u0), range.v0 + uv.getY(i) * (range.v1 - range.v0));
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * A strip of a panel, `fromMm`..`toMm` measured down from the panel's top edge, as a plane of that height. A label that
 * wraps round a disk's edge is cut into slices (front, edge, back) that each show their part of the one flat artwork.
 */
export function createLabelSliceGeometry(t: TemplateConfig, id: PanelId, fromMm: number, toMm: number): PlaneGeometry {
  const p = t.panels.find((q) => q.id === id)!;
  const range = panelUvRange(t, id);
  const vSpan = range.v1 - range.v0;
  const vTop = range.v1 - (fromMm / p.heightMm) * vSpan;
  const vBottom = range.v1 - (toMm / p.heightMm) * vSpan;
  const geo = new PlaneGeometry(p.widthMm, toMm - fromMm);
  const uv = geo.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, range.u0 + uv.getX(i) * (range.u1 - range.u0), vBottom + uv.getY(i) * (vTop - vBottom));
  uv.needsUpdate = true;
  return geo;
}

export interface LabelWrap {
  /** Label height on the front face, from the label's top. */
  frontMm: number;
  /** Portion that turns the bottom edge (the body's thickness). */
  edgeMm: number;
  /** Portion left over on the back; 0 when the label fits on the front. */
  backMm: number;
}

/** How a label of `labelH` starting `topMm` below the body's top splits between front, bottom edge and back. */
export function labelWrap(bodyHeightMm: number, bodyDepthMm: number, labelH: number, topMm: number): LabelWrap {
  const room = bodyHeightMm - topMm;
  if (labelH <= room) return { frontMm: labelH, edgeMm: 0, backMm: 0 };
  const edgeMm = Math.min(bodyDepthMm, labelH - room);
  return { frontMm: room, edgeMm, backMm: Math.max(0, labelH - room - edgeMm) };
}

type Slab = Extract<PreviewSpec, { kind: 'slab' }>;

/** The slab's face outline, centred on the origin: rounded corners (a full circle when the radius is half the size), and an optional cut corner at the top right. */
export function slabOutline(spec: Slab): Shape {
  const w = spec.bodyWidthMm;
  const h = spec.bodyHeightMm;
  const r = Math.min(spec.radiusMm, w / 2, h / 2);
  const c = spec.chamferMm ?? 0;
  const [x0, x1, y0, y1] = [-w / 2, w / 2, -h / 2, h / 2];
  const s = new Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  if (c > 0) {
    s.lineTo(x1, y1 - c);
    s.lineTo(x1 - c, y1);
  } else {
    s.lineTo(x1, y1 - r);
    s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  }
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, (3 * Math.PI) / 2, false);
  return s;
}

/** A card or disk's body: its outline extruded to the body's thickness, centred on the origin. */
export function createSlabBodyGeometry(spec: Slab): ExtrudeGeometry {
  const geo = new ExtrudeGeometry(slabOutline(spec), { depth: spec.bodyDepthMm, bevelEnabled: false, curveSegments: 12 });
  geo.translate(0, 0, -spec.bodyDepthMm / 2);
  return geo;
}

/** A printed face for a slab: the same outline as the body (so rounded corners stay rounded) with the panel's artwork on it. */
export function createSlabFaceGeometry(t: TemplateConfig, spec: Slab, id: PanelId): ShapeGeometry {
  const range = panelUvRange(t, id);
  const geo = new ShapeGeometry(slabOutline(spec), 12);
  const uv = geo.getAttribute('uv') as BufferAttribute;
  const pos = geo.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const u = (pos.getX(i) + spec.bodyWidthMm / 2) / spec.bodyWidthMm;
    const v = (pos.getY(i) + spec.bodyHeightMm / 2) / spec.bodyHeightMm;
    uv.setXY(i, range.u0 + u * (range.u1 - range.u0), range.v0 + v * (range.v1 - range.v0));
  }
  uv.needsUpdate = true;
  return geo;
}
