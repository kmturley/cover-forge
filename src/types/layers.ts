import type { PanelBox } from './editor';
import type { ImageRef } from './editor';
import type { PanelId } from './template';
import type { CodeKind } from './editor';

/**
 * The layer model (see layer-system-plan.md). A design is a flat, ordered list of layers, drawn bottom to top; each
 * layer is placed against one panel. Templates supply the default layers; designs and items are diffs over them.
 */

/** One side of a layer's placement, in percent of the panel along that axis (see layer-system-plan.md §2.7). */
export type Size = number | 'auto';

export type Axis =
  /** The start (left/top) edge sits `offset`% in from the start edge. */
  | { anchor: 'start'; offset: number; size: Size }
  /** The centre sits `offset`% along. */
  | { anchor: 'center'; offset: number; size: Size }
  /** The end (right/bottom) edge sits `offset`% in from the end edge. */
  | { anchor: 'end'; offset: number; size: Size }
  /** `start`% in from the start edge and `end`% in from the end edge; what a PanelBox always was. */
  | { anchor: 'stretch'; start: number; end: number };

/** `size: 'auto'` takes its length from the content's aspect ratio, so one axis may be auto (not both). */
export interface Placement {
  x: Axis;
  y: Axis;
}

/**
 * Placement as saves from before boxes stored it: mm from the panel's paint area (and an image zoom). Rendered as
 * before until the layer is next placed. See LegacyPlacement in editor.ts.
 */
export interface LegacyMm {
  kind: 'legacy';
  xMm?: number | null;
  yMm?: number | null;
  /** Image zoom (1 covers the panel). */
  scale?: number;
  /** Logo and code width. */
  widthMm?: number | null;
}

/** `null` = automatic: whatever suits the layer's type (the whole panel for a fill or image). */
export type LayerPlacement = Placement | LegacyMm | null;

export type ImageSource =
  /** An image from the item's library; `auto` is the panel's preferred one (cover on the front, hero on the back). */
  | { kind: 'role'; ref: ImageRef | 'auto' }
  /** A built-in vector mark from src/brands. */
  | { kind: 'vector'; id: string };

export interface LayerBase {
  /** Stable and unique in the list; diffs refer to layers by it. Default layers are named by target, such as `front.image`. */
  id: string;
  name?: string;
  visible: boolean;
  /** The panel the placement is measured against and the layer is clipped to. */
  target: PanelId;
  placement: LayerPlacement;
  rotationDeg: number;
  opacity: number;
  /** Mirror another layer's fill (a dust flap takes its spine's colour). Resolved after the diffs are applied. */
  follows?: string;
}

export interface StrokeSettings {
  color: string;
  widthMm: number;
  /** Gap between the trim edge and the stroke's centreline (a placed shape: between its box and the stroke). */
  insetMm: number;
}

export interface ShapeLayer extends LayerBase {
  type: 'shape';
  shape: 'rect';
  /** `null` = not filled. */
  fill: string | null;
  /** No stroke when its width is 0. */
  stroke: StrokeSettings;
}

export interface ImageLayer extends LayerBase {
  type: 'image';
  /** `null` = no image. */
  source: ImageSource | null;
  fit: 'fill' | 'fit';
  /** Recolours the image (a vector mark's fill). */
  tint: string;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  /** This item's own text (variables allowed); replaces `textTemplate`. */
  text?: string;
  textTemplate?: string;
  fontFamily: string;
  color: string;
  /** Cap height in mm; unset = automatic. */
  textHeightMm?: number;
  /** Extra rotation on top of the panel's own orientation. */
  textRotationDeg?: number;
}

export interface CodeParams {
  kind: CodeKind;
  pattern: string;
  color: string;
  background: string;
}

export interface GeneratedLayer extends LayerBase {
  type: 'generated';
  generator: 'code';
  params: CodeParams;
}

/** The Branded trade dress, drawn whole by drawOfficial until it becomes ordinary layers. Shown when Branded is on. */
export interface OfficialLayer extends LayerBase {
  type: 'official';
}

export type Layer = ShapeLayer | ImageLayer | TextLayer | GeneratedLayer | OfficialLayer;

/** A change to a layer lower down. Fields are merged one by one; `undefined` leaves a field alone, `null` sets it. */
export type LayerPatch = Record<string, unknown>;

/** What a design or an item changes about the layers below it, keyed by layer id (layer-system-plan.md §2.8). */
export interface LayerDiff {
  patch?: Record<string, LayerPatch>;
  /** Layers taken away. */
  hidden?: string[];
  /** New layers, placed above `after` (or on top). */
  added?: { layer: Layer; after?: string }[];
  /** A full ordering of ids; layers it doesn't name keep their place after the ones it does. */
  order?: string[];
}

export type { PanelBox };
