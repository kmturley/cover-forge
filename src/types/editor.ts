import type { PanelId } from './template';

export type StyleOverlay = 'clean' | 'digital' | 'retro';

/** Placement of an image inside its panel. Pan is in mm relative to the centred cover-fit position (scale 1 = covers the panel). */
export interface PanelTransform {
  panXMm: number;
  panYMm: number;
  scale: number;
  rotationDeg: number;
  /** 0 (transparent) to 1 (opaque). */
  opacity: number;
}

export const DEFAULT_TRANSFORM: PanelTransform = { panXMm: 0, panYMm: 0, scale: 1, rotationDeg: 0, opacity: 1 };

/** A slot in an item's image library: a named asset, or `screenshot:<index>`. */
export type ImageRef = 'cover' | 'hero' | 'logo' | `screenshot:${number}`;

/** Per-panel settings, used for both the shared layer and an item's overrides. Anything unset inherits from the layer below. */
export interface PanelSettings {
  backgroundColor?: string;
  /** Image from the library; `null` means no image, `undefined` means inherit. */
  image?: ImageRef | null;
  /** Field-level, so an item can override just its opacity and still follow the shared position and size. */
  transform?: Partial<PanelTransform>;
}

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 5;

/** Spine text styling (per-item `text` only appears in overrides; it defaults to the title). */
export interface SpineSettings {
  text?: string;
  fontFamily: string;
  /** Cap height of the spine text in mm; the text still shrinks if it's too long for the spine. */
  textHeightMm: number;
  color: string;
}

export type SharedSpine = Omit<SpineSettings, 'text'>;

/**
 * Settings applied to every item in the queue. Each item can override any field
 * (see MediaItem.panels / spineOverride); resolution order is default → shared → item.
 */
export interface SharedSettings {
  panels: Partial<Record<PanelId, PanelSettings>>;
  spine: SharedSpine;
}
