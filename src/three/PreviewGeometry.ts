import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, PlaneGeometry, Shape, ShapeGeometry, type BufferAttribute } from 'three';
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
  const printed = bodyPrintedFaces(t, spec);
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
  // An open-ended sleeve: with no group for the top and bottom, they aren't drawn at all.
  if (spec.kind === 'box' && spec.hollow) geo.groups = geo.groups.filter((g) => FACE_ORDER[g.materialIndex ?? 0] !== '+y' && FACE_ORDER[g.materialIndex ?? 0] !== '-y');
  return geo;
}

/** How much thinner than the sleeve its inside is modelled (card is about this thick), in mm per side. */
export const SLEEVE_WALL_MM = 0.8;

export interface InsetFace {
  face: BoxFace;
  panel: PanelId;
}

/** How much narrower (mm) a panel may be than its face before it counts as an inset. */
const INSET_TOLERANCE_MM = 0.6;

/**
 * Side faces whose panel is narrower or shorter than the face, like an 8 cm slim CD case's 85.7 mm card on its 90 mm hinge.
 * Stretching them over the whole face would distort the art and lift it out of line with the front and back, so they are
 * drawn at true size, centred, with the case showing round them.
 * Fronts and backs always fill their face.
 */
/**
 * Where the printed pieces' centre sits up the face, mm from its middle: from `insertBottomMm` (an insert standing on the
 * case's bottom edge, under a band the case keeps at the top), else centred.
 */
export function insertCenterY(t: TemplateConfig, spec: Extract<PreviewSpec, { kind: 'box' }>, panel: PanelId): number {
  const p = t.panels.find((q) => q.id === panel);
  if (!p || spec.insertBottomMm === undefined) return 0;
  return -spec.heightMm / 2 + spec.insertBottomMm + p.heightMm / 2;
}

export function insetFaces(t: TemplateConfig, spec: PreviewSpec): InsetFace[] {
  if (spec.kind !== 'box') return [];
  const out: InsetFace[] = [];
  for (const [face, id] of Object.entries(spec.faces) as [BoxFace, PanelId][]) {
    const panel = t.panels.find((p) => p.id === id);
    if (!panel || (face !== '+x' && face !== '-x')) continue;
    const narrower = panel.widthMm < spec.depthMm - INSET_TOLERANCE_MM;
    const shorter = panel.heightMm < spec.heightMm - INSET_TOLERANCE_MM;
    if ((narrower || shorter) && panel.heightMm <= spec.heightMm + INSET_TOLERANCE_MM) out.push({ face, panel: id });
  }
  return out;
}

/** The faces printed directly on the body: everything `printedFaces` names except the insets, which are separate pieces. */
export function bodyPrintedFaces(t: TemplateConfig, spec: PreviewSpec): Partial<Record<BoxFace, PanelId>> {
  const insets = new Set(insetFaces(t, spec).map((i) => i.face));
  return Object.fromEntries(Object.entries(printedFaces(spec)).filter(([f]) => !insets.has(f as BoxFace)));
}

/** Where the plane for an inset face sits (just proud of the surface) and how it is turned to face outwards. */
export function insetPlacement(spec: Extract<PreviewSpec, { kind: 'box' }>, face: BoxFace): { position: [number, number, number]; rotation: [number, number, number] } {
  const off = 0.05;
  const z = 0;
  switch (face) {
    case '+x':
      return { position: [spec.widthMm / 2 + off, 0, z], rotation: [0, Math.PI / 2, 0] };
    case '-x':
      return { position: [-spec.widthMm / 2 - off, 0, z], rotation: [0, -Math.PI / 2, 0] };
    case '-z':
      return { position: [0, 0, -spec.depthMm / 2 - off], rotation: [0, Math.PI, 0] };
    default:
      return { position: [0, 0, spec.depthMm / 2 + off], rotation: [0, 0, 0] };
  }
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

/** How much of a panel's height is trimmed off its top and bottom in the preview (as for insets), mm. */
const STRIP_TRIM_MM = 0.15;

/** The UV range of part of a panel, `fromMm`..`toMm` across it (from its left edge), trimmed a hair top and bottom. */
function panelPartUv(t: TemplateConfig, id: PanelId, fromMm: number, toMm: number): UvRange {
  const p = t.panels.find((q) => q.id === id)!;
  const r = panelUvRange(t, id);
  const du = (r.u1 - r.u0) / p.widthMm;
  const dv = ((r.v1 - r.v0) * STRIP_TRIM_MM) / p.heightMm;
  return { u0: r.u0 + fromMm * du, u1: r.u0 + toMm * du, v0: r.v0 + dv, v1: r.v1 - dv };
}

/** A flat plane `size` big showing the strip of a panel `fromMm`..`toMm` across it (stretched to fit). */
export function createPanelStrip(t: TemplateConfig, id: PanelId, fromMm: number, toMm: number, size: [number, number]): PlaneGeometry {
  const range = panelPartUv(t, id, fromMm, toMm);
  const geo = new PlaneGeometry(size[0], size[1]);
  const uv = geo.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, range.u0 + uv.getX(i) * (range.u1 - range.u0), range.v0 + uv.getY(i) * (range.v1 - range.v0));
  uv.needsUpdate = true;
  return geo;
}

/**
 * Part of a rounded corner, an open arc of a cylinder (axis vertical, centred on the origin), showing the strip of a panel
 * `fromMm`..`toMm` across it: `fromMm` at `thetaStart`, `toMm` at the arc's other end (angles as three's CylinderGeometry:
 * 0 faces +z, π/2 faces +x).
 */
export function createCornerArc(t: TemplateConfig, id: PanelId, fromMm: number, toMm: number, radius: number, height: number, thetaStart: number, thetaLength: number): CylinderGeometry {
  const range = panelPartUv(t, id, fromMm, toMm);
  const geo = new CylinderGeometry(radius, radius, height, 6, 1, true, thetaStart, thetaLength);
  const uv = geo.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, range.u0 + uv.getX(i) * (range.u1 - range.u0), range.v0 + uv.getY(i) * (range.v1 - range.v0));
  uv.needsUpdate = true;
  return geo;
}

/** How close (mm) a printed piece's edge must come to the flat's end of its face to be wrapped round the rounded edge. */
const WRAP_TOLERANCE_MM = 0.05;

/**
 * One axis of a piece on a box face: where each point of its artwork lands on the face, unrolled. The flat of the face runs
 * from -(half - r) to half - r; past it the surface turns round the rounded edge. A piece that reaches the end of the flat
 * carries on round that edge for half its arc, as the body's own printed faces do (three's RoundedBoxGeometry gives each face
 * half of each edge's arc), so it meets the next face's artwork with no gap and never stands proud of the curve. Its artwork
 * is spread evenly over the length it covers.
 */
function wrapAxis(from: number, to: number, half: number, r: number): number[] {
  const flat = half - r;
  const halfArc = (Math.PI * r) / 4;
  const lo = from <= -flat + WRAP_TOLERANCE_MM ? -flat - halfArc : from;
  const hi = to >= flat - WRAP_TOLERANCE_MM ? flat + halfArc : to;
  // Sample the flat ends and every arc finely, the flat in between in one step.
  const marks = new Set<number>([lo, hi]);
  const arcSteps = 6;
  for (let i = 0; i <= arcSteps; i++) {
    for (const s of [-flat - (halfArc * i) / arcSteps, flat + (halfArc * i) / arcSteps]) if (s > lo && s < hi) marks.add(s);
  }
  for (const s of [-flat, flat]) if (s > lo && s < hi) marks.add(s);
  return [...marks].sort((a, b) => a - b);
}

/** A point `s` along an unrolled face axis: how far along the face it is, and how far it has turned back round the edge. */
function unroll(s: number, half: number, r: number): { along: number; angle: number } {
  const flat = half - r;
  if (r <= 0 || Math.abs(s) <= flat) return { along: s, angle: 0 };
  const angle = (Math.abs(s) - flat) / r;
  return { along: Math.sign(s) * (flat + r * Math.sin(angle)), angle };
}

/**
 * A panel printed on part of a box face (a decal or an inset), drawn at its own size centred at (`centerX`, `centerY`) on a
 * face `faceW` × `faceH`, in the face's own frame (facing +z, the face's surface at z = 0). Edges that reach the end of the face's
 * flat wrap round the rounded edge (see `wrapAxis`), so the piece meets the neighbouring face's artwork and follows the curve
 * instead of overhanging it. Trimmed a hair all round, like the insets, so texture filtering never picks up the next panel.
 */
export function createWrappedPanelGeometry(t: TemplateConfig, id: PanelId, faceW: number, faceH: number, radius: number, centerX = 0, centerY = 0): BufferGeometry {
  const p = t.panels.find((q) => q.id === id);
  if (!p) throw new Error(`Template has no ${id} panel`);
  const r = Math.min(radius, faceW / 2, faceH / 2);
  const xs = wrapAxis(centerX - p.widthMm / 2, centerX + p.widthMm / 2, faceW / 2, r);
  const ys = wrapAxis(centerY - p.heightMm / 2, centerY + p.heightMm / 2, faceH / 2, r);
  const range = panelUvRange(t, id);
  const trim = 0.15;
  const du = ((range.u1 - range.u0) * trim) / p.widthMm;
  const dv = ((range.v1 - range.v0) * trim) / p.heightMm;
  const [u0, u1, v0, v1] = [range.u0 + du, range.u1 - du, range.v0 + dv, range.v1 - dv];
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const sy of ys) {
    for (const sx of xs) {
      const x = unroll(sx, faceW / 2, r);
      const y = unroll(sy, faceH / 2, r);
      // Turned back round the edge: back by r(1 − cos) on each axis it has turned on (a corner turns on both).
      const z = -r * (1 - Math.cos(x.angle)) - r * (1 - Math.cos(y.angle));
      positions.push(x.along, y.along, z);
      uvs.push(u0 + ((sx - xs[0]) / (xs[xs.length - 1] - xs[0])) * (u1 - u0), v0 + ((sy - ys[0]) / (ys[ys.length - 1] - ys[0])) * (v1 - v0));
    }
  }
  const index: number[] = [];
  const n = xs.length;
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      index.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
