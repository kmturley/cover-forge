import type { PanelId } from './template';

export type StyleOverlay = 'clean' | 'digital' | 'retro';

/**
 * Placement of an image inside its panel. Scale 1 = covers the panel. `xMm`/`yMm` are the image's top-left
 * corner in mm from the panel's top-left; `null` means centred (the default), whatever the image or scale.
 */
export interface PanelTransform {
  xMm: number | null;
  yMm: number | null;
  scale: number;
  rotationDeg: number;
  /** 0 (transparent) to 1 (opaque). */
  opacity: number;
}

export const DEFAULT_TRANSFORM: PanelTransform = { xMm: null, yMm: null, scale: 1, rotationDeg: 0, opacity: 1 };

/** A decorative frame drawn just inside the panel's trim edge. `widthMm: 0` (the default) means none. */
export interface BorderSettings {
  color: string;
  widthMm: number;
  /** Gap between the trim edge and the stroke's centreline. */
  insetMm: number;
}

export const DEFAULT_BORDER: BorderSettings = { color: '#ffffff', widthMm: 0, insetMm: 3 };

/** A slot in an item's image library: a named asset, or `screenshot:<index>`. */
export type ImageRef = 'cover' | 'hero' | 'logo' | `screenshot:${number}`;

/** Per-panel settings, used for both the shared layer and an item's overrides. Anything unset inherits from the layer below. */
export interface PanelSettings {
  backgroundColor?: string;
  /** Image from the library; `null` means no image, `undefined` means inherit. */
  image?: ImageRef | null;
  /** Field-level, so an item can override just its opacity and still follow the shared position and size. */
  transform?: Partial<PanelTransform>;
  /** Brand logo layer, drawn above the image and (for the spine) the text. */
  logo?: Partial<LogoSettings>;
  /** QR code or barcode layer, drawn above the image and logo. */
  code?: Partial<CodeSettings>;
  /** Accent border layer, drawn on top of everything else in the panel. */
  border?: Partial<BorderSettings>;
}

/** A store / console brand mark drawn on top of a panel's image and text. Every field is layered like the rest (default → shared → item). */
export interface LogoSettings {
  /** Brand id (see src/brands); `null` = no logo. */
  brand: string | null;
  /** Fill colour. */
  color: string;
  /** Logo width in mm; `null` = automatic (sized for the panel). */
  widthMm: number | null;
  /** Top-left from the panel's top-left (bleed included), like images; `null` = default (centred, near the bottom). */
  xMm: number | null;
  yMm: number | null;
  rotationDeg: number;
  opacity: number;
}

export const DEFAULT_LOGO: LogoSettings = { brand: null, color: '#ffffff', widthMm: null, xMm: null, yMm: null, rotationDeg: 0, opacity: 1 };

export type CodeKind = 'none' | 'qr' | 'ean13' | 'upca' | 'code128';

/**
 * A scannable identifier (QR code or barcode) drawn on top of a panel. Layered like everything else
 * (default → shared → item). The pattern is filled per item; see codes/pattern.ts for the tokens.
 */
export interface CodeSettings {
  kind: CodeKind;
  /** Text to encode, with {tokens} filled per item. Barcodes use its digits (or a generated number if it has too few). */
  pattern: string;
  /** Bars / modules colour. */
  color: string;
  /** Quiet-zone and background colour (keep it light for scanners). */
  background: string;
  /** Overall width in mm including the quiet zone; `null` = automatic for the kind. */
  widthMm: number | null;
  /** Top-left from the panel's top-left (bleed included); `null` = default (bottom-right corner). */
  xMm: number | null;
  yMm: number | null;
  rotationDeg: number;
  opacity: number;
}

export const DEFAULT_CODE: CodeSettings = {
  kind: 'none',
  pattern: 'steam://run/{appId}',
  color: '#000000',
  background: '#ffffff',
  widthMm: null,
  xMm: null,
  yMm: null,
  rotationDeg: 0,
  opacity: 1,
};

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 5;

/** Spine text styling (per-item `text` only appears in overrides; it defaults to the title). */
export interface SpineSettings {
  text?: string;
  fontFamily: string;
  /** Cap height of the spine text in mm; the text still shrinks if it's too long for the spine. */
  /** Cap height. Unset = automatic: as large as still lets a typical long title fit on one line (see SpineTypography). */
  textHeightMm?: number;
  color: string;
  /** Extra rotation on top of the template's own orientation; e.g. 180° reads bottom-to-top on a vertical spine. */
  rotationDeg?: number;
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

/**
 * A named set of panel settings that items can use. The built-in Default design (`SharedSettings`) applies to every
 * item; any other design sits on top of it and only stores what it changes. An item's own overrides sit on top of both.
 */
export interface Design {
  id: string;
  name: string;
  panels: Partial<Record<PanelId, PanelSettings>>;
  spine: Partial<SharedSpine>;
}
