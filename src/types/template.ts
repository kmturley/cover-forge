/**
 * Every artwork region a template can have. Settings (shared and per item) are keyed by this id, so the same
 * "front" styling carries across templates; a template just uses the subset it needs.
 */
export type PanelId = 'front' | 'back' | 'spine' | 'spineRight' | 'flap' | 'top' | 'bottom' | 'glue' | 'tuck' | 'bottomTuck' | 'dustTopLeft' | 'dustTopRight' | 'dustBottomLeft' | 'dustBottomRight';

export type SpineOrientation = 'vertical' | 'horizontal';

/** Panel geometry in mm, measured from the top-left of the full canvas (bleed margin included). */
export interface PanelRect {
  id: PanelId;
  label: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** Set on spine-like panels: the panel also carries the item's title, running this way. */
  text?: SpineOrientation;
  /**
   * A part that folds away or is glued shut (a dust flap, glue tab or tuck flap): it isn't seen on the finished piece, so
   * it can't be designed. It is printed in this panel's colour so the paper edge looks continuous.
   */
  follows?: PanelId;
  /** A second spine that starts as a copy of this panel's look (colour, title), until it is edited on its own. */
  mirrors?: PanelId;
  /**
   * Set on the swapped copy of a turned panel (see engine/layers/turn.ts): its size before the swap. The Branded dress uses it
   * to keep its marks and bands the size they are in portrait, rather than a share of the other way round.
   */
  turnedFrom?: { widthMm: number; heightMm: number };
}

/** What is printed for a case: its own insert or label, a sleeve round the case, or a box that holds it. */
export type Piece = 'insert' | 'slipcover' | 'box';

export type TemplateKind = 'bluray' | 'uhd' | 'dvd' | 'vhs' | 'cd' | 'cassette' | 'floppy' | 'nfc-card' | 'nfc-sticker' | 'nfc-box' | 'vinyl' | 'game-case';

/** Which 3D face a panel is mapped onto (BoxGeometry face order). */
export type BoxFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface PreviewMaterial {
  color: string;
  /** 0 = opaque. */
  transmission?: number;
  roughness?: number;
  /** Clear-coat gloss on the printed sleeve (paper under film). */
  glossy?: boolean;
}

/** How the 3D viewport models a template. Sizes are in mm. */
export type PreviewSpec =
  | {
      /** A case or box: printed panels wrap the mapped faces, the rest is casing. */
      kind: 'box';
      widthMm: number;
      heightMm: number;
      depthMm: number;
      faces: Partial<Record<BoxFace, PanelId>>;
      /** A sleeve with open ends (a slipcover): the top and bottom are left out, and the inside shows. */
      hollow?: boolean;
      /** Artwork covering only part of a face (e.g. a cassette's back flap), against one edge of it. */
      decals?: { panel: PanelId; face: '-z'; align: 'min-x' | 'max-x' }[];
      casing: PreviewMaterial;
      /** Whether the printed faces are glossy film (cases) or plain card (sleeves). */
      glossy: boolean;
      radiusMm: number;
    }
  | {
      /** A flat body (card or disk) with the front panel printed on its face, optionally as a smaller label. */
      kind: 'slab';
      bodyWidthMm: number;
      bodyHeightMm: number;
      bodyDepthMm: number;
      body: PreviewMaterial;
      panel: PanelId;
      /** Printed on the other face (a card's back). */
      backPanel?: PanelId;
      /** true: the panel fills the whole face (a card). false: it's a separate label sitting on the body (a disk). */
      fullFace: boolean;
      /**
       * Distance from the body's top edge to the label's top edge (only when !fullFace). A label longer than the room
       * left below that wraps round the bottom edge onto the back.
       */
      labelTopMm?: number;
      /** A metal shutter on the front top edge (a 3.5" diskette). xMm is its centre's offset from the body centre. */
      shutter?: { widthMm: number; heightMm: number; xMm: number };
      /** A metal hub on the back face, centred `yMm` from the body's centre (a diskette's drive hub). */
      hub?: { radiusMm: number; yMm: number };
      /** Size of the cut corner at the top right (a diskette's), replacing that rounded corner. */
      chamferMm?: number;
      radiusMm: number;
    };

/** A non-printing marking on the dieline, shown with the guides (e.g. where an NFC tag goes). Canvas mm. */
export interface TemplateMark {
  label: string;
  /** Centre. */
  xMm: number;
  yMm: number;
  diameterMm: number;
}

export interface TemplateConfig {
  id: string;
  kind: TemplateKind;
  name: string;
  variantId: string;
  bleedMm: number;
  /** Full canvas size, bleed margin included. */
  totalWidthMm: number;
  totalHeightMm: number;
  panels: PanelRect[];
  /** Set on the slipcover and box built for a case; an insert (and a template that already is a box) leaves it out. */
  piece?: Piece;
  /** Guide-only markings (not printed). */
  marks?: TemplateMark[];
  /** Pixels per mm at 300 DPI. */
  dpiScale: number;
  preview: PreviewSpec;
  /**
   * Set on the working copy the layers are laid out against (see engine/layers/view.ts): the platform whose Branded dress to
   * draw instead of the case's own, or `none` for no dress.
   */
  dress?: string;
}

/**
 * What kind of case a template is: an industry-standard one (a DVD or Blu-ray case, a CD jewel case), the one the game
 * originally came in (a Switch case, a DS case, the NES and SNES boxes), or one made since (the DS-size case sold for
 * Game Boy games). All are a "case": the Type (Insert, Slipcover or Box) is chosen separately.
 */
export type CaseOrigin = 'standard' | 'original' | 'aftermarket';

export interface TemplateVariant {
  id: string;
  /** Its name as people know it ("DVD Slim", "PS4", '12" LP'): standard names, not measurements. */
  label: string;
  /** Retired: still built for saves and links that use it, but not offered in the library. */
  hidden?: boolean;
  /** Which kind of case it is, where that isn't just a standard size (see CaseOrigin). */
  origin?: CaseOrigin;
  /** The case's name where it isn't a standard's ("DS case"): templates that share a case share its name, so the Case picker lists it once. */
  caseName?: string;
}
