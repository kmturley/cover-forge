import type { PanelRect, TemplateConfig } from '../../types/template';
import type { Fill, GroupLayer, ImageLayer, Layer, LayerPatch, ShapeLayer, TextLayer } from '../../types/layers';
import { brandWidth, type Brand, type Logo } from '../../brands';
import { drawBranding, logoPartGeometry, type Font, type Ink, type LogoPart, type PathOp, type Sink } from '../branding';
import { brandingFor } from '../official';
import { PANEL_IDS } from '../resolve';
import { rectToBox, type RectMm } from '../box';
import { boundsOf, circlePoints, clipPolygon, isRect, quadPoints, remapStops, simplify, type Pt } from './geometry';
import { placementOfBox, placementToBox } from './placement';
import { paintRect } from '../placement';
import { defaultImageRef } from '../imageLibrary';

/**
 * The Branded trade dress as ordinary layers (layer-system-plan.md §2.5). The drawing code in branding.ts describes
 * the dress to a sink; this sink turns that description into layers: rectangles and outlines with their fills,
 * marks, and one-line text, all filed in one "Branded" folder and placed on their panels. Nothing is re-derived by
 * hand, so the layers draw what the dress always drew; a user then edits them like any others.
 */

/** The prefix of the folders the branded layers sit in: one per panel (`branded.front`), so each side switches on its own. */
export const BRANDED_FOLDER = 'branded';

/** The folder holding a panel's branded layers. Its eye is that side's Branded switch. */
export const brandedFolderId = (panel: string): string => `${BRANDED_FOLDER}.${panel}`;

/** Pixels per mm the dress is described at (300 dpi), so its pixel minimums (hairlines) come out as they do in print. */
const GEN_PX = 300 / 25.4;
/** Points of a traced outline within this of a straight run are dropped (mm). */
const SIMPLIFY_MM = 0.015;

type Measure = (text: string, font: string, letterSpacing: string) => number;
let measureText: Measure | undefined;

/** Where text is measured when the dress is laid out. The browser uses a canvas of its own; a test or script supplies one. */
export function setTextMeasurer(m: Measure | undefined): void {
  measureText = m;
  cache.clear();
}

function measureWith(text: string, font: string, spacing: string): number {
  if (!measureText && typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      measureText = (t, f, ls) => {
        ctx.font = f;
        if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = ls;
        return ctx.measureText(t).width;
      };
    }
  }
  // With no canvas to measure on (a test, or rendering on a server), a typical average width stands in.
  return measureText ? measureText(text, font, spacing) : text.length * (parseFloat(font.match(/([\d.]+)px/)?.[1] ?? '10') * 0.6);
}

/** What turning Branded off meant before each side had its own switch: every side's folder hidden. Older saves and links are read through it. */
export function bannerOffDiff(): { patch: Record<string, LayerPatch> } {
  return { patch: Object.fromEntries(PANEL_IDS.map((id) => [brandedFolderId(id), { visible: false }])) };
}

const FONT = 'Helvetica, Arial, sans-serif';
const CAP = 0.72;

interface State {
  /** Rotation (radians) and translation (px) taking local coordinates to the canvas. */
  rot: number;
  tx: number;
  ty: number;
  alpha: number;
  clip: { x0: number; y0: number; x1: number; y1: number } | null;
}

const round = (n: number) => Number(n.toFixed(2));

/** Turns the dress's drawing into layers. */
class LayerSink implements Sink {
  readonly rowStep = 6;
  readonly layers: Layer[] = [];
  private panel!: PanelRect;
  private id = '';
  private name = '';
  private count = 0;
  private stack: State[] = [{ rot: 0, tx: 0, ty: 0, alpha: 1, clip: null }];

  constructor(private readonly px: number) {}

  private get st(): State {
    return this.stack[this.stack.length - 1];
  }

  begin(id: string, name: string, panel: PanelRect) {
    this.id = id;
    this.name = name;
    this.panel = panel;
    this.count = 0;
  }
  save() {
    this.stack.push({ ...this.st });
  }
  restore() {
    if (this.stack.length > 1) this.stack.pop();
  }
  translate(x: number, y: number) {
    const s = this.st;
    s.tx += x * Math.cos(s.rot) - y * Math.sin(s.rot);
    s.ty += x * Math.sin(s.rot) + y * Math.cos(s.rot);
  }
  rotate(radians: number) {
    this.st.rot += radians;
  }
  setAlpha(alpha: number) {
    this.st.alpha = alpha;
  }
  clip(ops: PathOp[]) {
    // The dress only clips to flat rectangles (a flat band); the cut is applied to what is drawn inside.
    const pts = flatten(ops)[0] ?? [];
    if (pts.length > 0) this.st.clip = boundsOf(pts);
  }

  /** A point from local to canvas coordinates (px). */
  private at(x: number, y: number): Pt {
    const s = this.st;
    return [s.tx + x * Math.cos(s.rot) - y * Math.sin(s.rot), s.ty + x * Math.sin(s.rot) + y * Math.cos(s.rot)];
  }

  /** The rectangle (local px) as a canvas box in mm: unrotated, or its centre with the rotation that turns it. */
  private rectBox(x: number, y: number, w: number, h: number): { rect: RectMm; rotationDeg: number } {
    const [cx, cy] = this.at(x + w / 2, y + h / 2);
    const mm = this.px;
    return { rect: { xMm: (cx - w / 2) / mm, yMm: (cy - h / 2) / mm, widthMm: w / mm, heightMm: h / mm }, rotationDeg: round((this.st.rot * 180) / Math.PI) };
  }

  /** A canvas rectangle (px) as a placement on the current panel. */
  private placement(rect: RectMm) {
    return placementOfBox(rectToBox(this.panel, rect));
  }

  /** A suffix that tells a piece's layers apart when it makes several. */
  private nextId(): { id: string; name: string } {
    const n = ++this.count;
    return { id: `${BRANDED_FOLDER}.${this.id}${n > 1 ? `-${n}` : ''}`, name: n > 1 ? `${this.name} (${n})` : this.name };
  }

  private base(rect: RectMm, rotationDeg = 0) {
    const { id, name } = this.nextId();
    return { id, name, visible: true, target: this.panel.id, parent: brandedFolderId(this.panel.id), placement: this.placement(rect), rotationDeg, opacity: round(this.st.alpha) };
  }

  /** An ink over a box (px, canvas coordinates), as a fill that works on a layer's box. */
  private fill(i: Ink, box: { x0: number; y0: number; x1: number; y1: number }): Fill {
    if (typeof i === 'string') return i;
    const [w, h] = [box.x1 - box.x0, box.y1 - box.y0];
    if ('radial' in i) return { axis: 'radial', cx: round((i.radial.cx - box.x0) / w), cy: round((i.radial.cy - box.y0) / h), r: Number((i.radial.r / w).toFixed(4)), stops: i.stops };
    const [x1, y1, x2, y2] = i.line;
    return y1 === y2 ? { axis: 'x', stops: remapStops(i.stops, x1, x2, box.x0, box.x1) } : { axis: 'y', stops: remapStops(i.stops, y1, y2, box.y0, box.y1) };
  }

  private rectLayer(x: number, y: number, w: number, h: number, i: Ink | null, stroke?: { color: string; widthMm: number }) {
    const s = this.st;
    let [rx, ry, rw, rh] = [x, y, w, h];
    let box = { x0: 0, y0: 0, x1: 0, y1: 0 };
    if (s.rot === 0) {
      [rx, ry] = this.at(x, y);
      if (s.clip) {
        const [x0, y0, x1, y1] = [Math.max(rx, s.clip.x0), Math.max(ry, s.clip.y0), Math.min(rx + rw, s.clip.x1), Math.min(ry + rh, s.clip.y1)];
        if (x1 <= x0 || y1 <= y0) return;
        [rx, ry, rw, rh] = [x0, y0, x1 - x0, y1 - y0];
      }
      box = { x0: rx, y0: ry, x1: rx + rw, y1: ry + rh };
    }
    const { rect, rotationDeg } = s.rot === 0 ? { rect: { xMm: rx / this.px, yMm: ry / this.px, widthMm: rw / this.px, heightMm: rh / this.px }, rotationDeg: 0 } : this.rectBox(x, y, w, h);
    if (s.rot !== 0) {
      const [cx, cy] = this.at(x + w / 2, y + h / 2);
      box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    }
    const layer: ShapeLayer = {
      ...this.base(rect, rotationDeg),
      type: 'shape',
      shape: 'rect',
      fill: i === null ? null : this.fill(i, box),
      stroke: stroke ? { color: stroke.color, widthMm: stroke.widthMm, insetMm: stroke.widthMm / 2 } : { color: '#ffffff', widthMm: 0, insetMm: 3 },
    };
    this.layers.push(layer);
  }

  fillRect(x: number, y: number, w: number, h: number, i: Ink) {
    this.rectLayer(x, y, w, h, i);
  }

  strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth: number) {
    // A canvas strokes along the edge, half in and half out; the layer's box is the outer edge of the line.
    const half = lineWidth / 2;
    this.rectLayer(x - half, y - half, w + lineWidth, h + lineWidth, null, { color, widthMm: lineWidth / this.px });
  }

  /** A polygon (canvas px) as a layer: a rectangle when that is all it is, else an outline stretched over its bounds. */
  private polygonLayer(pts: Pt[], i: Ink | null, stroke?: { color: string; widthMm: number }, closed = true) {
    if (pts.length < 2) return;
    const eps = SIMPLIFY_MM * this.px;
    const simple = simplify(pts, eps);
    const b = boundsOf(simple);
    const [bw, bh] = [b.x1 - b.x0, b.y1 - b.y0];
    if (closed && !stroke && isRect(simple, eps)) return this.rectLayer(b.x0, b.y0, bw, bh, i, undefined);
    if (bw <= 0 || bh <= 0) return;
    const rect = { xMm: b.x0 / this.px, yMm: b.y0 / this.px, widthMm: bw / this.px, heightMm: bh / this.px };
    const d = simple.map(([x, y], n) => `${n ? 'L' : 'M'}${round(((x - b.x0) / bw) * 100)} ${round(((y - b.y0) / bh) * 100)}`).join('') + (closed ? 'Z' : '');
    const layer: ShapeLayer = {
      ...this.base(rect),
      type: 'shape',
      shape: 'path',
      path: d,
      fill: i === null ? null : this.fill(i, b),
      stroke: stroke ? { color: stroke.color, widthMm: stroke.widthMm, insetMm: 0 } : { color: '#ffffff', widthMm: 0, insetMm: 3 },
    };
    this.layers.push(layer);
  }

  fillPath(ops: PathOp[], i: Ink) {
    const [ring] = flatten(ops);
    if (!ring) return;
    let pts = ring.map(([x, y]) => this.at(x, y));
    if (this.st.clip) pts = clipPolygon(pts, this.st.clip);
    if (pts.length >= 3) this.polygonLayer(pts, i);
  }

  strokePath(ops: PathOp[], color: string, lineWidth: number) {
    const [line] = flatten(ops);
    if (line) this.polygonLayer(line.map(([x, y]) => this.at(x, y)), null, { color, widthMm: lineWidth / this.px }, false);
  }

  fillCircle(cx: number, cy: number, r: number, i: Ink) {
    const [ccx, ccy] = this.at(cx, cy);
    const c = this.st.clip;
    const inside = !c || (ccx - r >= c.x0 && ccx + r <= c.x1 && ccy - r >= c.y0 && ccy + r <= c.y1);
    if (inside) {
      const rect = { xMm: (ccx - r) / this.px, yMm: (ccy - r) / this.px, widthMm: (2 * r) / this.px, heightMm: (2 * r) / this.px };
      const box = { x0: ccx - r, y0: ccy - r, x1: ccx + r, y1: ccy + r };
      this.layers.push({ ...this.base(rect), type: 'shape', shape: 'ellipse', fill: this.fill(i, box), stroke: { color: '#ffffff', widthMm: 0, insetMm: 3 } });
      return;
    }
    // Cut by the band: what is left is an outline of its own.
    const pts = clipPolygon(circlePoints(ccx, ccy, r), c!);
    if (pts.length >= 3) this.polygonLayer(pts, i);
  }

  text(text: string, x: number, y: number, capPx: number, font: Font, color: string) {
    const w = this.measure(text, capPx, font);
    const { rect, rotationDeg } = this.rectBox(x, y, w + 1, capPx);
    const layer: TextLayer = {
      ...this.base(rect, rotationDeg),
      type: 'text',
      text,
      singleLine: true,
      fontFamily: FONT,
      color,
      textHeightMm: Number((capPx / this.px).toFixed(3)),
      align: 'left',
      weight: font.weight ?? 700,
      italic: !!font.italic,
      letterSpacing: Math.round((font.spacing ?? 0) * 1000),
      textStroke: { color: '#000000', widthMm: 0 },
      shadow: { color: '#000000', blurMm: 0, xMm: 0, yMm: 0 },
    };
    this.layers.push(layer);
  }

  measure(text: string, capPx: number, font: Font): number {
    const size = capPx / CAP;
    return measureWith(text, `${font.italic ? 'italic ' : ''}${font.weight ?? 700} ${size}px ${FONT}`, `${(font.spacing ?? 0) * size}px`);
  }

  private mark(id: string, w: number, h: number, x: number, y: number, color: string, part: LogoPart) {
    const { rect, rotationDeg } = this.rectBox(x, y, w, h);
    const layer: ImageLayer = {
      ...this.base(rect, rotationDeg),
      type: 'image',
      source: { kind: 'vector', id, ...(part.only && { only: part.only }), ...(part.crop && { crop: part.crop }), ...(part.mono && { mono: true }) },
      fit: 'fit',
      focus: { x: 50, y: 50 },
      tint: color,
    };
    this.layers.push(layer);
  }

  brand(b: Brand, x: number, y: number, heightPx: number, color: string) {
    this.mark(b.id, brandWidth(b) * (heightPx / (b.bbox[3] - b.bbox[1])), heightPx, x, y, color, {});
  }

  logo(l: Logo, part: LogoPart, x: number, y: number, heightPx: number, color: string) {
    const g = logoPartGeometry(l, part);
    this.mark(l.id, g.bw * (heightPx / g.bh), heightPx, x, y, color, part);
  }
}

/** A path as rings of points: each move starts a new one; curves are sampled. */
function flatten(ops: PathOp[]): Pt[][] {
  const rings: Pt[][] = [];
  let cur: Pt[] = [];
  for (const op of ops) {
    if (op[0] === 'M') {
      if (cur.length) rings.push(cur);
      cur = [[op[1], op[2]]];
    } else if (op[0] === 'L') cur.push([op[1], op[2]]);
    else if (op[0] === 'Q') cur.push(...quadPoints(cur[cur.length - 1] ?? [op[3], op[4]], [op[1], op[2]], [op[3], op[4]]));
  }
  if (cur.length) rings.push(cur);
  return rings;
}

export interface Branded {
  /** The panels' folders, then the layers in drawing order. */
  layers: Layer[];
  /** Changes the dress makes to layers that are not its own (a spine title is fitted round it), applied while the folder of the panel they are on is shown. */
  patches: Record<string, LayerPatch>;
}

const cache = new Map<string, Branded>();

/** The dress's layers and patches for a case. Cached by case. */
export function brandedLayers(t: TemplateConfig): Branded {
  const hit = cache.get(t.id);
  if (hit) return hit;
  const sink = new LayerSink(GEN_PX);
  drawBranding(sink, t, GEN_PX);

  const folders: GroupLayer[] = [...new Set(sink.layers.map((l) => l.target))].map((panel) => ({ id: brandedFolderId(panel), type: 'group', name: 'Branded', visible: true, target: panel, placement: null, rotationDeg: 0, opacity: 1 }));
  const patches: Record<string, LayerPatch> = {};
  const spine = brandingFor(t.kind, t.variantId).spine;
  if (spine) {
    for (const p of t.panels) {
      if (!p.text) continue;
      const length = p.text === 'vertical' ? p.heightMm : p.widthMm;
      const end = spine.titleFrom ?? Math.max(spine.cap?.length ?? 0, ...spine.marks.map((m) => m.to)) + 0.02;
      patches[`${p.id}.text`] = {
        spineFit: { startMm: Number((end * length).toFixed(2)), scale: spine.titleScale ?? 1, ...(spine.titleColor && typeof spine.fill === 'string' && { contrast: { on: spine.fill, color: spine.titleColor } }) },
        ...(spine.titleCase === 'upper' && { textCase: 'upper' }),
      };
    }
  }
  // A band along an edge of a side (a header across the top, a strip down the side) would hide that edge of its picture,
  // now that the dress sits above it: the picture starts where the band ends (while the dress is shown).
  for (const p of t.panels) {
    if (p.follows || !defaultImageRef(p.id)) continue;
    const area = rectToBox(p, paintRect(t, p));
    const box = { ...area };
    for (const l of sink.layers) {
      if (l.target !== p.id || l.type !== 'shape' || !l.placement || !('x' in l.placement)) continue;
      const b = placementToBox(p, l.placement as never);
      const [wide, tall] = [b.xStart <= 2 && b.xEnd >= 98, b.yStart <= 2 && b.yEnd >= 98];
      // No deeper than a header or strip, so a shape that fills the side isn't taken for one.
      if (wide && b.yStart <= 1 && b.yEnd <= 40) box.yStart = Math.max(box.yStart, b.yEnd);
      else if (wide && b.yEnd >= 99 && b.yStart >= 60) box.yEnd = Math.min(box.yEnd, b.yStart);
      else if (tall && b.xStart <= 1 && b.xEnd <= 40) box.xStart = Math.max(box.xStart, b.xEnd);
      else if (tall && b.xEnd >= 99 && b.xStart >= 60) box.xEnd = Math.min(box.xEnd, b.xStart);
    }
    if (box.xStart !== area.xStart || box.xEnd !== area.xEnd || box.yStart !== area.yStart || box.yEnd !== area.yEnd) patches[`${p.id}.image`] = { placement: placementOfBox(box) };
  }
  const out: Branded = { layers: [...folders, ...sink.layers], patches };
  cache.set(t.id, out);
  return out;
}

