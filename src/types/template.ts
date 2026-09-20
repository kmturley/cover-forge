/**
 * Every artwork region a template can have. Settings (shared and per item) are keyed by this id, so the same
 * "front" styling carries across templates; a template just uses the subset it needs.
 */
export type PanelId = 'front' | 'back' | 'spine' | 'spineRight' | 'flap' | 'top' | 'bottom' | 'glue' | 'tuck' | 'bottomTuck';

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
}

export type Region = 'US' | 'EU';

export type TemplateKind = 'bluray' | 'dvd' | 'vhs' | 'cd' | 'cassette' | 'floppy' | 'nfc-card' | 'nfc-box';

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
      /** true: the panel fills the whole face (a card). false: it's a separate label sitting on the body (a disk). */
      fullFace: boolean;
      /**
       * Distance from the body's top edge to the label's top edge (only when !fullFace). A label longer than the room
       * left below that wraps round the bottom edge onto the back.
       */
      labelTopMm?: number;
      /** A metal shutter on the front top edge (a 3.5" diskette). xMm is its centre's offset from the body centre. */
      shutter?: { widthMm: number; heightMm: number; xMm: number };
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
  region?: Region;
  variantId: string;
  bleedMm: number;
  /** Full canvas size, bleed margin included. */
  totalWidthMm: number;
  totalHeightMm: number;
  panels: PanelRect[];
  /** Guide-only markings (not printed). */
  marks?: TemplateMark[];
  /** Pixels per mm at 300 DPI. */
  dpiScale: number;
  preview: PreviewSpec;
}

export interface TemplateVariant {
  id: string;
  label: string;
  region?: Region;
}
