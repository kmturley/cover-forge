import type { PanelId } from './template';

/** The single style setting older saves and links used; 'digital' meant the official banner. */
export type StyleOverlay = 'clean' | 'digital' | 'retro';

/**
 * Where something sits on a panel: a box from a start to an end edge on each axis, in percent of the trimmed panel's
 * width (x) and height (y), measured from its top-left. 0–100 is the trimmed panel; below 0 or above 100 reaches
 * into the bleed (or past it, to crop). Being relative, the same box suits every case size a design is used on.
 * What it holds is sized to the box without distortion (see `fit` for images; logos and codes always fit inside).
 */
export interface PanelBox {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
}

/**
 * Placement fields saves used before boxes: absolute mm from the panel's paint-area top-left (and an image zoom).
 * Still read, so an older save renders exactly as it did, until the placement is next edited and becomes a box.
 */
export interface LegacyPlacement {
  /** @deprecated read only; see LegacyPlacement. */
  xMm?: number | null;
  /** @deprecated read only; see LegacyPlacement. */
  yMm?: number | null;
}

/** How an image is sized to its box: `fill` covers it (cropping the overflow), `fit` shows all of it inside. */
export type ImageFit = 'fill' | 'fit';

/** Placement of an image inside its panel. */
export interface PanelTransform extends LegacyPlacement {
  /** `null` = the whole panel, bleed included. */
  box: PanelBox | null;
  fit: ImageFit;
  /** About the box's centre. */
  rotationDeg: number;
  /** 0 (transparent) to 1 (opaque). */
  opacity: number;
  /** @deprecated read only (1 = covers the panel); see LegacyPlacement. */
  scale?: number;
}

export const DEFAULT_TRANSFORM: PanelTransform = { box: null, fit: 'fill', rotationDeg: 0, opacity: 1 };

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
export interface LogoSettings extends LegacyPlacement {
  /** Brand id (see src/brands); `null` = no logo. */
  brand: string | null;
  /** Fill colour. */
  color: string;
  /** The logo is as large as fits inside it, centred; `null` = automatic (a size and spot that suit the panel). */
  box: PanelBox | null;
  rotationDeg: number;
  opacity: number;
  /** @deprecated read only; see LegacyPlacement. */
  widthMm?: number | null;
}

export const DEFAULT_LOGO: LogoSettings = { brand: null, color: '#ffffff', box: null, rotationDeg: 0, opacity: 1 };

export type CodeKind = 'none' | 'qr' | 'ean13' | 'upca' | 'code128';

/**
 * A scannable identifier (QR code or barcode) drawn on top of a panel. Layered like everything else
 * (default → shared → item). The pattern is filled per item; see codes/pattern.ts for the tokens.
 */
export interface CodeSettings extends LegacyPlacement {
  kind: CodeKind;
  /** Text to encode, with {tokens} filled per item. Barcodes use its digits (or a generated number if it has too few). */
  pattern: string;
  /** Bars / modules colour. */
  color: string;
  /** Quiet-zone and background colour (keep it light for scanners). */
  background: string;
  /**
   * The symbol (quiet zones included) is as large as fits inside it and inside the panel's safe area, centred.
   * `null` = automatic: the kind's standard size in the bottom-right corner.
   */
  box: PanelBox | null;
  rotationDeg: number;
  opacity: number;
  /** @deprecated read only; see LegacyPlacement. */
  widthMm?: number | null;
}

export const DEFAULT_CODE: CodeSettings = {
  kind: 'none',
  pattern: 'steam://run/{appId}',
  color: '#000000',
  background: '#ffffff',
  box: null,
  rotationDeg: 0,
  opacity: 1,
};

/** Spine text styling (per-item `text` only appears in overrides; it defaults to the title). */
export interface SpineSettings {
  /** This item's own spine text (variables allowed); replaces the design's `textTemplate`. Only ever set per item. */
  text?: string;
  /** The spine text for every item using the design, with variables such as `{creator} · {title}` (see spineText). */
  textTemplate?: string;
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
