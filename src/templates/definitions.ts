import type { CaseOrigin, PanelId, PanelRect, PlasticPart, PreviewMaterial, PreviewSpec, SpineOrientation, TemplateConfig, TemplateKind, TemplateMark, TemplateVariant } from '../types/template';
import { XBOX_GREEN } from '../engine/official';
import { BETAMAX_SLEEVE, BLURAY_INSERT, BLURAY_SHELL, DVD_SHELL, BLURAY_SPINES, CARD_BOX, CASSETTE_JCARD, CR80, DVD_INSERT, DVD_SPINES, FLOPPY, GAME_CASES, JEWEL_CASE, MINI_CD_SLIM, MINIDISC_ALBUM, MINIDISC_JCARD, NFC_BOXES, NFC_STICKERS, UHD_SPINES, VHS_SLEEVE, VINYL_SLEEVES } from './cases';

export const PX_PER_MM = 300 / 25.4;

/** A panel before it has a position: just its size. */
interface Spec {
  id: PanelId;
  label: string;
  w: number;
  h: number;
  text?: SpineOrientation;
  follows?: PanelId;
  mirrors?: PanelId;
}

/** Panels laid out edge to edge: a row (left→right, folds are vertical) or a column (top→bottom). */
interface Piece {
  dir: 'row' | 'col';
  specs: Spec[];
}

/** A piece whose panels sit at explicit offsets (a cross-shaped box net). Offsets are from the piece's top-left, in mm. */
interface FreePiece {
  dir: 'free';
  specs: (Spec & { x: number; y: number })[];
}

export interface Build {
  kind: TemplateKind;
  name: string;
  variantId: string;
  bleedMm: number;
  pieces: (Piece | FreePiece)[];
  preview: PreviewSpec;
  /** Given the piece origins, guide marks in canvas mm. Called once panel positions are known. */
  marks?: (panels: PanelRect[]) => TemplateMark[];
}

/** Separate pieces (e.g. a CD booklet and its tray card) sit side by side with room for both bleeds plus a little slack. */
const pieceGap = (bleed: number) => bleed * 2 + 2;

export function assemble(b: Build): TemplateConfig {
  const panels: PanelRect[] = [];
  let cursorX = b.bleedMm;
  let tallest = 0;
  for (const piece of b.pieces) {
    let x = cursorX;
    let y = b.bleedMm;
    let width = 0;
    let height = 0;
    for (const s of piece.specs) {
      if (piece.dir === 'free') {
        const f = s as FreePiece['specs'][number];
        panels.push({ id: f.id, label: f.label, xMm: cursorX + f.x, yMm: y + f.y, widthMm: f.w, heightMm: f.h, text: f.text, follows: f.follows, ...(f.mirrors && { mirrors: f.mirrors }) });
        width = Math.max(width, f.x + f.w);
        height = Math.max(height, f.y + f.h);
        continue;
      }
      panels.push({ id: s.id, label: s.label, xMm: x, yMm: y, widthMm: s.w, heightMm: s.h, text: s.text, follows: s.follows, ...(s.mirrors && { mirrors: s.mirrors }) });
      if (piece.dir === 'row') {
        x += s.w;
        width += s.w;
        height = Math.max(height, s.h);
      } else {
        y += s.h;
        height += s.h;
        width = Math.max(width, s.w);
      }
    }
    cursorX += width + pieceGap(b.bleedMm);
    tallest = Math.max(tallest, height);
  }
  return {
    id: `${b.kind}-${b.variantId}`,
    kind: b.kind,
    name: b.name,
    variantId: b.variantId,
    bleedMm: b.bleedMm,
    totalWidthMm: cursorX - pieceGap(b.bleedMm) + b.bleedMm,
    totalHeightMm: tallest + b.bleedMm * 2,
    panels,
    marks: b.marks?.(panels),
    dpiScale: PX_PER_MM,
    preview: b.preview,
  };
}

export interface TemplateDef {
  kind: TemplateKind;
  name: string;
  group: 'Cases' | 'Boxes' | 'Labels & cards' | 'Game cases';
  variants: TemplateVariant[];
  build(variantId: string): TemplateConfig;
}

/** Back | spine | front, the layout shared by keepcases and slipcases. `w`/`h` are the front panel's size. */
function wrap(kind: TemplateKind, name: string, variantId: string, w: number, h: number, spine: number, preview: PreviewSpec, bleed = 3): TemplateConfig {
  return assemble({
    kind,
    name,
    variantId,
    bleedMm: bleed,
    pieces: [
      {
        dir: 'row',
        specs: [
          { id: 'back', label: 'Back', w, h },
          { id: 'spine', label: 'Spine', w: spine, h, text: 'vertical' },
          { id: 'front', label: 'Front', w, h },
        ],
      },
    ],
    preview,
  });
}

const wrapPreview = (w: number, h: number, depth: number, casing: PreviewMaterial, glossy: boolean, radius: number): PreviewSpec => ({
  kind: 'box',
  widthMm: w,
  heightMm: h,
  depthMm: depth,
  faces: { '-x': 'spine', '+z': 'front', '-z': 'back' },
  casing,
  glossy,
  radiusMm: radius,
});

/**
 * A keepcase at its real outside size (`shell`, from cases.ts), with the printed insert at its own size under the clear
 * sleeve: the front and back from the spine edge (wrapping round its rounded corner), the spine centred down its edge. The
 * plastic shows round the rest, as on a real case: about 5.5 mm at the opening edge and 3.5 mm above and below. With
 * `insertBottomMm` the insert stands that far above the bottom edge instead of centred, under a band the case keeps at the top.
 */
const keepcasePreview = (shell: { w: number; h: number }, depth: number, casing: PreviewMaterial, radius: number, band?: { insertBottomMm: number; emboss?: Extract<PreviewSpec, { kind: 'box' }>['emboss'] }): PreviewSpec => ({
  kind: 'box',
  widthMm: shell.w,
  heightMm: shell.h,
  depthMm: depth,
  ...(band && { insertBottomMm: band.insertBottomMm }),
  ...(band?.emboss && { emboss: band.emboss }),
  faces: { '-x': 'spine' },
  decals: [
    { panel: 'front', face: '+z', align: 'min-x' },
    { panel: 'back', face: '-z', align: 'min-x' },
  ],
  casing,
  glossy: true,
  radiusMm: radius,
});

/**
 * Blu-ray cases. The US standard and slim cases are offered; the others are hidden but still built, so a save or link that
 * uses one keeps printing at the size it was designed for. An id's physical size must never change (see templates.test.ts).
 */
const BLURAY: Record<string, { label: string; hidden?: boolean }> = {
  'us-11': { label: 'Blu-ray' },
  'slim-7': { label: 'Blu-ray slim' },
  'us-12.5': { label: 'Blu-ray Elite', hidden: true },
  'eu-14': { label: 'Blu-ray (EU)', hidden: true },
};

/** Blu-ray 4K UHD cases: the Blu-ray case in black; the front panel is the same size in every one (spines in cases.ts). */
const UHD: Record<string, { label: string }> = {
  'us-11': { label: 'Blu-ray 4K UHD' },
  'elite-12.5': { label: 'Blu-ray 4K UHD (Elite)' },
  'multi4-15': { label: 'Blu-ray 4K UHD (4-disc)' },
};

const DVD: Record<string, { label: string; hidden?: boolean }> = {
  'std-14': { label: 'DVD' },
  'slim-7': { label: 'DVD Slim' },
  // The 9 mm slim case offered before the 7 mm one: hidden, but saves that use it still print at 9 mm.
  'slim-9': { label: 'DVD Slim (9 mm)', hidden: true },
};

/** Boxes that hold an NFC item (sizes in cases.ts). */
const NFC_BOX: Record<keyof typeof NFC_BOXES & ('card' | 'small'), { label: string; hidden?: boolean }> = {
  card: { label: 'NFC Card Box' },
  small: { label: 'NFC Small Box', hidden: true },
};
const NFC_STICKER_MM = NFC_STICKERS;
const NFC_STICKER_NAME: Record<string, string> = { '25': 'NFC Sticker Small', '30': 'NFC Sticker Medium', '35': 'NFC Sticker Large' };

export interface TuckBox {
  kind: TemplateKind;
  name: string;
  variantId: string;
  /** Front/back size and the depth of the sides, mm. The spine (a side) runs along the long edge when h > w. */
  w: number;
  h: number;
  d: number;
  casing: PreviewMaterial;
  radiusMm: number;
  marks?: (panels: PanelRect[]) => TemplateMark[];
  /** The box built for a case: the right side carries the title too, and it and the lid and bottom start in the left side's colour. By default none do. */
  mirrorSpine?: boolean;
}

/**
 * A straight-tuck-end box net. A strip [ back | left side | front | right side | glue tab ] folds into a tube and only
 * the glue tab needs sticking (double-sided tape works). The lid above the front and the bottom below it each carry
 * a tuck flap that slots inside the box, so the ends close with a fold and a tuck and no glue.
 */
export function tuckBox(b: TuckBox): TemplateConfig {
  const { w, h, d } = b;
  const glue = 10;
  const tuck = Math.max(12, Math.round(d * 0.85 * 10) / 10); // long enough to hold, even on a slim box
  const stripY = tuck + d;
  // Dust flaps fold in from the side panels' ends to close the corner gaps. They stop a millimetre short of the lid
  // and bottom so those edges stay cut lines (panels that touch would read as folds), and are as long as the sides are deep.
  const gap = 0.8;
  const dust = d - 1;
  return assemble({
    kind: b.kind,
    name: b.name,
    variantId: b.variantId,
    bleedMm: 3,
    pieces: [
      {
        dir: 'free',
        specs: [
          { id: 'back', label: 'Back', w, h, x: 0, y: stripY },
          { id: 'spine', label: 'Side (spine)', w: d, h, x: w, y: stripY, text: 'vertical' },
          { id: 'front', label: 'Front', w, h, x: w + d, y: stripY },
          { id: 'spineRight', label: 'Side (right)', w: d, h, x: 2 * w + d, y: stripY, ...(b.mirrorSpine && { text: 'vertical' as const, mirrors: 'spine' as const }) },
          { id: 'glue', label: 'Glue tab', w: glue, h, x: 2 * w + 2 * d, y: stripY, follows: 'spineRight' },
          { id: 'tuck', label: 'Top tuck flap', w, h: tuck, x: w + d, y: 0, follows: 'top' },
          { id: 'top', label: 'Top (lid)', w, h: d, x: w + d, y: tuck, ...(b.mirrorSpine && { mirrors: 'spine' as const }) },
          { id: 'bottom', label: 'Bottom', w, h: d, x: w + d, y: stripY + h, ...(b.mirrorSpine && { mirrors: 'spine' as const }) },
          { id: 'bottomTuck', label: 'Bottom tuck flap', w, h: tuck, x: w + d, y: stripY + h + d, follows: 'bottom' },
          { id: 'dustTopLeft', label: 'Dust flap', w: d - gap, h: dust, x: w, y: stripY - dust, follows: 'spine' },
          { id: 'dustBottomLeft', label: 'Dust flap', w: d - gap, h: dust, x: w, y: stripY + h, follows: 'spine' },
          { id: 'dustTopRight', label: 'Dust flap', w: d - gap, h: dust, x: 2 * w + d + gap, y: stripY - dust, follows: 'spineRight' },
          { id: 'dustBottomRight', label: 'Dust flap', w: d - gap, h: dust, x: 2 * w + d + gap, y: stripY + h, follows: 'spineRight' },
        ],
      },
    ],
    marks: b.marks,
    preview: {
      kind: 'box',
      widthMm: w,
      heightMm: h,
      depthMm: d,
      faces: { '+z': 'front', '-z': 'back', '-x': 'spine', '+x': 'spineRight', '+y': 'top', '-y': 'bottom' },
      casing: b.casing,
      glossy: false,
      radiusMm: b.radiusMm,
    },
  });
}

/**
 * A slip-cover wallet with no spine: one strip [ back | front | glue tab ] folded once between back and front (front on
 * the right, like every other template). The
 * tab is stuck inside the far edge, leaving a flat pocket open at the top for the card.
 */
function wallet(name: string, w: number, h: number, marks: (panels: PanelRect[]) => TemplateMark[]): TemplateConfig {
  return assemble({
    kind: 'nfc-box',
    name,
    variantId: 'wallet',
    bleedMm: 3,
    pieces: [
      {
        dir: 'row',
        specs: [
          { id: 'back', label: 'Back', w, h },
          { id: 'front', label: 'Front', w, h },
          { id: 'glue', label: 'Glue tab', w: 8, h, follows: 'front' },
        ],
      },
    ],
    marks,
    preview: {
      kind: 'box',
      widthMm: w,
      heightMm: h,
      depthMm: 2,
      faces: { '+z': 'front', '-z': 'back' },
      casing: { color: '#e9e4d8', roughness: 0.85 },
      glossy: false,
      radiusMm: 0.8,
    },
  });
}

/**
 * The 3D body a tray card wraps exactly, as the 2D shows it: the back across the flat of the back and half of each rounded
 * back corner, each flap across the rest of that corner, the flat of its side and half the front corner, with nothing
 * stretched. Used by the cases built round a tray card (CD jewel, MiniDisc album), whose real outside is larger than the
 * print could cover.
 */
function trayCardBody(back: number, flap: number, r: number): { widthMm: number; depthMm: number } {
  const halfCorner = (Math.PI * r) / 4;
  return { widthMm: back + 2 * r - 2 * halfCorner, depthMm: flap + 2 * r - 2 * halfCorner };
}

/** Corner radius of the CD jewel case's shell, mm. */
const JEWEL_RADIUS = 1.5;

/**
 * A jewel case's plastics. The lid and base are always clear polystyrene, polished. The disc tray inside is the same moulding
 * either way: clear and polished on most music CDs (photo of OK Computer in its original packaging), black satin on
 * PlayStation games.
 */
const CLEAR_SHELL: PlasticPart = { color: '#f4f7fa', clear: true, finish: 'glossy' };
const JEWEL_TRAYS = {
  clear: { color: '#f4f7fa', clear: true, finish: 'glossy' },
  black: { color: '#26272a', clear: false, finish: 'satin' },
} as const satisfies Record<string, PlasticPart>;

/**
 * A CD jewel case: the rear tray card [opening-side spine | back | hinge-side spine], whose two flaps both carry the title,
 * then the front booklet — front last/rightmost, same convention as every other case (`wrap()`'s
 * back | spine | front). Music CDs and PS1 games both use it.
 *
 * The tray card is genuinely 2 mm shorter than the front booklet (118 mm vs 120 mm) — this isn't a rounding
 * difference to fix, it's how real jewel cases are built: the front cover sits flat behind the clear front
 * panel with nothing else in the way, while the tray card wraps around the rotating disc-tray mechanism,
 * whose hinge/teeth along the top edge trims the card's usable height. See case-research.md's CD section
 * for the sources.
 *
 * The 3D preview models the case from its parts at its real 142 × 125 × 10 mm (see CaseConstruction): a clear shell, the
 * disc tray inside the base with the tray card behind it (its 137 mm back fills the inside between the 2.5 mm side walls,
 * its flaps folded round the tray's ends), and the booklet behind the lid, 3 mm in from the opening edge.
 */
function jewelCase(kind: TemplateKind, name: string, variantId: string, tray: keyof typeof JEWEL_TRAYS): TemplateConfig {
  const { trayCard, booklet } = JEWEL_CASE;
  const { back, flap } = trayCard;
  const outside = JEWEL_CASE.outside;
  return assemble({
    kind,
    name,
    variantId,
    bleedMm: 3,
    pieces: [
      {
        dir: 'row',
        specs: [
          // The opening-side flap first: seen from behind, the sheet's left flap folds round to the opening side, so the
          // primary spine, the one on the hinge side that faces out on a shelf, is the sheet's right flap.
          { id: 'spineRight', label: 'Spine (opening side)', w: flap, h: trayCard.h, text: 'vertical' },
          { id: 'back', label: 'Back (tray card)', w: back, h: trayCard.h },
          { id: 'spine', label: 'Spine (hinge side)', w: flap, h: trayCard.h, text: 'vertical' },
        ],
      },
      { dir: 'row', specs: [{ id: 'front', label: 'Front (booklet)', w: booklet.w, h: booklet.h }] },
    ],
    preview: {
      kind: 'box',
      widthMm: outside.w,
      heightMm: outside.h,
      depthMm: outside.d,
      // The tray card's flaps on the sides they fold to: the primary spine on the hinge side (-x), like every other case.
      faces: { '-x': 'spine', '+x': 'spineRight' },
      construction: { kind: 'jewel', shell: CLEAR_SHELL, tray: JEWEL_TRAYS[tray], wallMm: JEWEL_CASE.wallMm, sideWallMm: (outside.w - back) / 2, bookletMarginMm: booklet.fromOpeningEdgeMm },
      casing: { color: CLEAR_SHELL.color, transmission: 1, roughness: 0.04 },
      glossy: true,
      radiusMm: JEWEL_RADIUS,
    },
  });
}

/**
 * MiniDisc cases (case-research.md §22; sizes in cases.ts). Two different cases, so two templates:
 * - the standard case blank and home-recorded discs come in, printed with a J-card: one strip, 73 mm tall, folded into a
 *   68 mm front, a 5.5 mm spine and an 11 mm tab that tucks behind the disc (like a cassette's, smaller);
 * - the full-size album case pre-recorded MiniDiscs were sold in, 110 × 90 × 14 mm, built like a CD jewel case: a rear tray
 *   card (106 × 101.5 mm: a 9.3 mm spine flap, an 87.4 mm back, a 9.3 mm spine flap) and a 73 × 105 mm booklet front behind
 *   the lid. The tray card's folds and the booklet's panels are measured from the case seller's printable templates.
 */
/** Corner radius of the album case's 3D body, mm. */
const MINIDISC_ALBUM_RADIUS = 1.5;

function miniDiscCase(): TemplateConfig {
  const { front, spine, tab, h } = MINIDISC_JCARD;
  return assemble({
    kind: 'minidisc',
    name: 'MiniDisc',
    variantId: 'std',
    bleedMm: 3,
    pieces: [
      {
        dir: 'row',
        specs: [
          { id: 'back', label: 'Back (tucks in)', w: tab, h },
          { id: 'spine', label: 'Spine', w: spine, h, text: 'vertical' },
          { id: 'front', label: 'Front', w: front, h },
        ],
      },
    ],
    preview: {
      kind: 'box',
      widthMm: front,
      heightMm: h,
      depthMm: spine,
      faces: { '+z': 'front', '-x': 'spine' },
      decals: [{ panel: 'back', face: '-z', align: 'min-x' }],
      casing: { color: '#d9dde2', transmission: 0.8, roughness: 0.15 },
      glossy: true,
      radiusMm: 1,
    },
  });
}

/**
 * The full-size MiniDisc album case. The tray card's 106 mm is the back plus a spine flap each side, folded at 9.3 mm in
 * from each end. The front is the cover panel of the roll-fold booklet (up to six panels, 73.1 mm then a little narrower
 * each, 105 mm tall): only the cover is printed. The 3D preview follows a photo of a real case: the booklet 4.6 mm in from
 * the opening edge, the lid's dark hinge bar on the spine side, and the spine cards at the back, behind the lid.
 */
function miniDiscAlbumCase(): TemplateConfig {
  const { tray, booklet } = MINIDISC_ALBUM;
  const flap = tray.spine;
  const back = tray.w - 2 * flap;
  // The 3D body is sized so the tray card wraps it exactly, as the 2D shows it: the back across the flat of the back and half
  // of each rounded back corner, each flap across the rest of that corner, the flat of its side and half the front corner,
  // with nothing stretched. Height is the booklet's, the tallest part, plus the rounded top and bottom edges, which are left as
  // clear rim so everything printed sits on the flat and lines up. (The real case is 90 × 110 × 14 mm; drawn at that size the
  // print could only cover part of it.)
  const r = MINIDISC_ALBUM_RADIUS;
  return assemble({
    kind: 'minidisc',
    name: 'MiniDisc Album',
    variantId: 'album',
    bleedMm: 3,
    pieces: [
      {
        dir: 'row',
        specs: [
          // The opening-side flap first: seen from behind, the sheet's left flap folds round to the opening side, so the
          // primary spine, the one on the hinge side that faces out on a shelf, is the sheet's right flap.
          { id: 'spineRight', label: 'Spine (opening side)', w: flap, h: tray.h, text: 'vertical' },
          { id: 'back', label: 'Back (tray card)', w: tray.w - 2 * flap, h: tray.h },
          { id: 'spine', label: 'Spine (hinge side)', w: flap, h: tray.h, text: 'vertical' },
        ],
      },
      { dir: 'row', specs: [{ id: 'front', label: 'Front (booklet)', w: booklet.w, h: booklet.h }] },
    ],
    preview: {
      kind: 'box',
      ...trayCardBody(back, flap, r),
      heightMm: booklet.h + 2 * r,
      // The tray card's flaps on the sides they fold to: the primary spine on the hinge side (-x), like every other case.
      faces: { '-x': 'spine', '+x': 'spineRight' },
      // Placed as on a real album case (case-research.md §22): the booklet at its own size, about 3.6 mm in from the opening
      // edge (the photo's 4.6 mm less the clear rim this body leaves off), and the spare width, about 11.4 mm, on the hinge side.
      decals: [{ panel: 'front', face: '+z', align: 'max-x', marginMm: 3.6 }],
      // The tray card is one sheet folded round the back corners: drawn as one wrap, with no gap at the folds.
      wrapTray: true,
      // As in photos of printed cases: inside a thin clear rim, everything round the booklet and the back card is the black inner
      // tray, with the lid's black hinge down the spine side of the front, so the artwork looks a tight fit.
      hinge: { widthMm: 5.3, color: '#08090a' },
      tray: { color: '#111214', rimMm: 0.5 },
      casing: { color: '#d9dde2', transmission: 0.8, roughness: 0.15 },
      glossy: true,
      radiusMm: r,
    },
  });
}

/**
 * The slim 8 cm case for Mini CDs and Mini DVDs (case-research.md §25): 93 × 90 × 5.2 mm, a one-piece tray with a clear lid
 * that holds a 82.6 × 85.7 mm (3¼ × 3⅜ in) card. Printed as one strip folded round the hinge, like a slim CD case's wrap:
 * the front under the lid, a spine as wide as the case is deep, and a back across the whole back of the case (its width
 * less a 1 mm frame each side). The case is one moulded piece with no separate tray, so there is no tray card and no
 * second spine (the 7.5 mm 8 cm case with a tray has those, but its sizes are not known).
 */
function miniCdSlimCase(): TemplateConfig {
  const { card, frame } = MINI_CD_SLIM;
  const { w, h, d } = MINI_CD_SLIM.outside;
  return assemble({
    kind: 'cd',
    name: 'Mini CD',
    variantId: 'mini-slim',
    bleedMm: 3,
    pieces: [
      {
        dir: 'row',
        specs: [
          { id: 'back', label: 'Back', w: w - 2 * frame, h: card.h },
          { id: 'spine', label: 'Spine (hinge)', w: d, h: card.h, text: 'vertical' },
          { id: 'front', label: 'Front (under the lid)', w: card.w, h: card.h },
        ],
      },
    ],
    preview: {
      kind: 'box',
      widthMm: w,
      heightMm: h,
      depthMm: d,
      faces: { '-x': 'spine' },
      // The front sits under the lid beside the hinge, just inside the lid's frame; the back fills the back of the case.
      decals: [
        { panel: 'front', face: '+z', align: 'max-x', marginMm: 2 },
        { panel: 'back', face: '-z', align: 'min-x', marginMm: frame },
      ],
      casing: { color: '#16181c', transmission: 0.35, roughness: 0.12 },
      glossy: true,
      radiusMm: 1,
    },
  });
}

/** Vinyl record sleeves: a square jacket, front | spine | back in a row (sizes in cases.ts). */
const VINYL: Record<string, { label: string }> = {
  '12inch': { label: 'Vinyl 12"' },
  '10inch': { label: 'Vinyl 10"' },
  '7inch': { label: 'Vinyl 7"' },
};

/**
 * Which kind of case each platform's template is (see CaseOrigin). The standard ones are the industry's own cases; the Switch,
 * Vita, DS and 3DS cases and the NES and SNES boxes are what those games came in; the Game Boy family came in boxes of an
 * unknown size, so its template is the DS-size case sold for them since.
 */
const GAME_CASE_ORIGIN: Record<string, CaseOrigin> = {
  pc: 'standard', ps1: 'standard', ps2: 'standard', ps3: 'standard', ps4: 'standard', ps5: 'standard',
  wii: 'standard', 'wii-u': 'standard', gamecube: 'standard', xbox: 'standard', 'xbox-360': 'standard', 'xbox-one': 'standard',
  'ps-vita': 'original', 'xbox-series': 'original', ds: 'original', '3ds': 'original', switch: 'original', switch2: 'original', nes: 'original', snes: 'original',
  gb: 'aftermarket', gbc: 'aftermarket', gba: 'aftermarket',
};

/**
 * What each non-standard case is called, for the Case picker. Platforms that share one case share its name: the Game Boy family
 * uses the DS-size case (sold for them since; the DS's own is the original), and the Switch and Switch 2 share a case size.
 */
const GAME_CASE_NAME: Record<string, string> = {
  ds: 'DS case', gb: 'DS case', gbc: 'DS case', gba: 'DS case', '3ds': '3DS case',
  switch: 'Switch case', switch2: 'Switch case', 'ps-vita': 'PS Vita case', nes: 'NES case', snes: 'SNES case',
  'xbox-series': 'Xbox Series case',
};

/**
 * Cases whose insert is much shorter than the case (PS3, Blu-ray and 4K UHD: 149 of 171 mm; Xbox One: 149 of 170) stand it on the
 * bottom, leaving a band of the case at the top with a logo on it: the Blu-ray logo moulded at the top right of the clear
 * PS3 case, the Xbox One logo printed on the Xbox One's green top (photos of retail cases; on the Xbox One's own case the
 * insert leaves out its printed header for it, see `headerOnCase` in official.ts). The
 * bottom margin is the DVD keepcase's, (190 − 183) / 2; each logo is centred in the band, sized by eye from photos.
 */
const INSERT_BOTTOM_MM = 3.5;
const bandMiddle = (shellH: number, insertH: number) => (shellH - INSERT_BOTTOM_MM - insertH) / 2;
const UNDER_BAND: Record<string, { logo: string; heightMm: number; rightMm?: number; printed?: boolean }[]> = {
  ps3: [{ logo: 'blu-ray', heightMm: 8, rightMm: 7 }],
  // Printed white across the green top, 47 mm wide (photo of a retail case); the logo is 941 × 185 units.
  'xbox-one': [{ logo: 'xbox-one', heightMm: (47 * 185) / 941, printed: true }],
};

/**
 * Game case variants: the platform's name and the case colour for the 3D view. Sizes (the printed insert, US releases)
 * are in cases.ts's GAME_CASES. PS1 is `jewel`: a CD jewel case, not a keepcase.
 */
const GAME_CASE: Record<string, { label: string; color: string; jewel?: boolean; clear?: boolean }> = {
  pc: { label: 'PC', color: '#16191f' },
  ps1: { label: 'PS1', color: '#16181c', jewel: true },
  ps2: { label: 'PS2', color: '#000000' },
  ps3: { label: 'PS3', color: '#eef2f5', clear: true },
  ps4: { label: 'PS4', color: '#003791' },
  ps5: { label: 'PS5', color: '#ffffff' },
  'ps-vita': { label: 'PS Vita', color: '#003791' },
  gb: { label: 'Game Boy', color: '#c9ccd1' },
  gbc: { label: 'Game Boy Color', color: '#e4eaee' },
  gba: { label: 'Game Boy Advance', color: '#b4bcc1' },
  nes: { label: 'NES', color: '#26262a' },
  snes: { label: 'SNES', color: '#26262a' },
  ds: { label: 'DS', color: '#b9bcc2' },
  '3ds': { label: '3DS', color: '#1a1a1a' },
  switch: { label: 'Switch', color: '#e60012' },
  switch2: { label: 'Switch 2', color: '#e60012' },
  'wii-u': { label: 'Wii U', color: '#0096d6' },
  wii: { label: 'Wii', color: '#ffffff' },
  gamecube: { label: 'GameCube', color: '#000000' },
  xbox: { label: 'Xbox', color: '#000000' },
  'xbox-360': { label: 'Xbox 360', color: '#ffffff' },
  'xbox-one': { label: 'Xbox One', color: XBOX_GREEN },
  'xbox-series': { label: 'Xbox Series X|S', color: XBOX_GREEN },
};

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    kind: 'dvd',
    name: 'DVD',
    group: 'Cases',
    variants: Object.entries(DVD).map(([id, v]) => ({ id, label: v.label, hidden: v.hidden })),
    build: (id) => {
      const variantId = DVD[id] ? id : 'std-14';
      const { w, h } = DVD_INSERT;
      const spine = DVD_SPINES[variantId];
      return wrap('dvd', DVD[variantId].label, variantId, w, h, spine, keepcasePreview(DVD_SHELL, spine, { color: '#16191f', roughness: 0.35 }, 2.5));
    },
  },
  {
    kind: 'bluray',
    name: 'Blu-ray',
    group: 'Cases',
    variants: Object.entries(BLURAY).map(([id, v]) => ({ id, label: v.label, hidden: v.hidden })),
    build: (id) => {
      const variantId = BLURAY[id] ? id : 'us-11';
      const { w, h } = BLURAY_INSERT;
      const spine = BLURAY_SPINES[variantId];
      return wrap('bluray', BLURAY[variantId].label, variantId, w, h, spine,
        keepcasePreview(BLURAY_SHELL, spine, { color: '#0a4da2', transmission: 0.8, roughness: 0.2 }, 2.5, { insertBottomMm: INSERT_BOTTOM_MM, emboss: [{ logo: 'blu-ray', heightMm: 9, topMm: bandMiddle(BLURAY_SHELL.h, h) }] }));
    },
  },
  {
    kind: 'uhd',
    name: 'Blu-ray 4K UHD',
    group: 'Cases',
    variants: Object.entries(UHD).map(([id, v]) => ({ id, label: v.label })),
    build: (id) => {
      const variantId = UHD[id] ? id : 'us-11';
      const { w, h } = BLURAY_INSERT;
      const spine = UHD_SPINES[variantId];
      return wrap('uhd', UHD[variantId].label, variantId, w, h, spine,
        keepcasePreview(BLURAY_SHELL, spine, { color: '#111111', roughness: 0.3 }, 2.5, { insertBottomMm: INSERT_BOTTOM_MM, emboss: [{ logo: 'blu-ray-ultra-hd-4k', heightMm: 0.0448 * 149, topMm: bandMiddle(BLURAY_SHELL.h, h), printed: true }] }));
    },
  },
  {
    kind: 'vhs',
    name: 'VHS box',
    group: 'Boxes',
    variants: [{ id: 'std-25', label: 'VHS' }],
    // A retail VHS sleeve is card, not plastic, so it is a printable box. The tape stands upright: 105 wide, 190 tall,
    // with the spine (the 25 mm thickness) along the long side.
    build: () => tuckBox({ kind: 'vhs', name: 'VHS box', variantId: 'std-25', ...VHS_SLEEVE, casing: { color: '#e6dfcf', roughness: 0.8 }, radiusMm: 1 }),
  },
  {
    kind: 'betamax',
    name: 'Betamax box',
    group: 'Boxes',
    variants: [{ id: 'std', label: 'Betamax' }],
    build: () => tuckBox({ kind: 'betamax', name: 'Betamax box', variantId: 'std', ...BETAMAX_SLEEVE, casing: { color: '#e6dfcf', roughness: 0.8 }, radiusMm: 1 }),
  },
  {
    kind: 'cd',
    name: 'CD',
    group: 'Cases',
    variants: [
      { id: 'jewel', label: 'CD Jewel Case' },
      { id: 'mini-slim', label: 'Mini CD / DVD' },
    ],
    build: (id) => (id === 'mini-slim' ? miniCdSlimCase() : jewelCase('cd', 'CD Jewel Case', 'jewel', 'clear')),
  },
  {
    kind: 'cassette',
    name: 'Cassette',
    group: 'Cases',
    variants: [{ id: 'std', label: 'Cassette' }],
    build: () =>
      assemble({
        kind: 'cassette',
        name: 'Cassette',
        variantId: 'std',
        bleedMm: 3,
        pieces: [
          // One strip folded twice: the flap wraps round the spine onto the back of the case (a partial back image),
          // then the spine, then the front (the standard J-card, see cases.ts).
          {
            dir: 'row',
            specs: [
              { id: 'back', label: 'Back (wraps round)', w: CASSETTE_JCARD.back, h: CASSETTE_JCARD.h },
              { id: 'spine', label: 'Spine', w: CASSETTE_JCARD.spine, h: CASSETTE_JCARD.h, text: 'vertical' },
              { id: 'front', label: 'Front', w: CASSETTE_JCARD.front, h: CASSETTE_JCARD.h },
            ],
          },
        ],
        preview: {
          kind: 'box',
          widthMm: CASSETTE_JCARD.front,
          heightMm: CASSETTE_JCARD.h,
          depthMm: CASSETTE_JCARD.spine,
          faces: { '+z': 'front', '-x': 'spine' },
          decals: [{ panel: 'back', face: '-z', align: 'min-x' }],
          casing: { color: '#d8e6ee', transmission: 0.85, roughness: 0.15 },
          glossy: true,
          radiusMm: 1,
        },
      }),
  },
  {
    kind: 'minidisc',
    name: 'MiniDisc',
    group: 'Cases',
    variants: [
      { id: 'std', label: 'MiniDisc' },
      { id: 'album', label: 'MiniDisc Album' },
    ],
    build: (id) => (id === 'album' ? miniDiscAlbumCase() : miniDiscCase()),
  },
  {
    kind: 'card-box',
    name: 'Card deck box',
    group: 'Boxes',
    variants: [{ id: 'poker', label: 'Card Deck Box' }],
    build: () => tuckBox({ kind: 'card-box', name: 'Card Deck Box', variantId: 'poker', ...CARD_BOX, casing: { color: '#ece8df', roughness: 0.8 }, radiusMm: 0.8 }),
  },
  {
    kind: 'floppy',
    name: 'Floppy disk',
    group: 'Labels & cards',
    variants: [{ id: 'face', label: '3.5" Floppy Disk' }],
    build: () =>
      assemble({
        kind: 'floppy',
        name: 'Floppy disk',
        variantId: 'face',
        bleedMm: 1,
        pieces: [{ dir: 'row', specs: [{ id: 'front', label: 'Label', w: FLOPPY.label, h: FLOPPY.label }] }],
        preview: {
          kind: 'slab',
          bodyWidthMm: FLOPPY.body.w,
          bodyHeightMm: FLOPPY.body.h,
          bodyDepthMm: FLOPPY.body.d,
          body: { color: '#2b2e36', roughness: 0.5 },
          panel: 'front',
          fullFace: false,
          // Real labels start below the metal shutter and wrap round the bottom edge onto the back.
          labelTopMm: 42,
          shutter: { widthMm: 24, heightMm: 23, xMm: -4 },
          hub: { radiusMm: 11, yMm: -4 },
          chamferMm: 6,
          radiusMm: 2,
        },
      }),
  },
  {
    kind: 'nfc-card',
    name: 'NFC card',
    group: 'Labels & cards',
    variants: [
      { id: 'cr80-duplex', label: 'NFC Card' },
      // Front only, offered before the two-sided card: hidden, but saves that use it still print one card.
      { id: 'cr80', label: 'NFC Card (front only)', hidden: true },
    ],
    build: (id) => {
      const duplex = id !== 'cr80';
      return assemble({
        kind: 'nfc-card',
        name: 'NFC card',
        variantId: duplex ? 'cr80-duplex' : 'cr80',
        bleedMm: 1,
        // Two separate cards side by side (not folded), so each gets its own bleed. The back is on the left and the
        // front on the right, like the other templates.
        pieces: [
          ...(duplex ? [{ dir: 'row' as const, specs: [{ id: 'back' as const, label: 'Card back', w: CR80.w, h: CR80.h }] }] : []),
          { dir: 'row', specs: [{ id: 'front', label: 'Card face', w: CR80.w, h: CR80.h }] },
        ],
        preview: {
          kind: 'slab',
          bodyWidthMm: CR80.w,
          bodyHeightMm: CR80.h,
          bodyDepthMm: CR80.d,
          body: { color: '#f4f4f2', roughness: 0.4 },
          panel: 'front',
          backPanel: duplex ? 'back' : undefined,
          fullFace: true,
          radiusMm: CR80.radius,
        },
      });
    },
  },
  {
    kind: 'nfc-sticker',
    name: 'NFC sticker',
    group: 'Labels & cards',
    variants: Object.keys(NFC_STICKER_MM).map((id) => ({ id, label: NFC_STICKER_NAME[id] })),
    build: (id) => {
      const dia = NFC_STICKER_MM[id] ?? 25;
      return assemble({
        kind: 'nfc-sticker',
        name: 'NFC sticker',
        variantId: NFC_STICKER_MM[id] ? id : '25',
        bleedMm: 1,
        pieces: [{ dir: 'row', specs: [{ id: 'front', label: 'Sticker', w: dia, h: dia }] }],
        // The panel is square; the sticker is the circle inside it.
        marks: (panels) => [{ label: 'Cut', xMm: panels[0].xMm + dia / 2, yMm: panels[0].yMm + dia / 2, diameterMm: dia }],
        preview: {
          kind: 'slab',
          bodyWidthMm: dia,
          bodyHeightMm: dia,
          bodyDepthMm: 0.4,
          body: { color: '#f4f4f2', roughness: 0.5 },
          panel: 'front',
          fullFace: true,
          radiusMm: dia / 2,
        },
      });
    },
  },
  {
    kind: 'nfc-box',
    name: 'NFC box',
    group: 'Boxes',
    variants: [
      ...Object.entries(NFC_BOX).map(([id, v]) => ({ id, label: v.label, hidden: v.hidden })),
      { id: 'wallet', label: 'NFC Card Wallet' },
    ],
    build: (id) => {
      // The tag sits inside, behind the front: mark its spot on the front panel for placement.
      const marksFor = (w: number, h: number) => (panels: PanelRect[]): TemplateMark[] => {
        const front = panels.find((p) => p.id === 'front')!;
        const dia = Math.min(25, w * 0.6, h * 0.6);
        return [{ label: 'NFC tag (inside)', xMm: front.xMm + front.widthMm / 2, yMm: front.yMm + front.heightMm / 2, diameterMm: dia }];
      };
      const { wallet: wl } = NFC_BOXES;
      if (id === 'wallet') return wallet('NFC card wallet', wl.w, wl.h, marksFor(wl.w, wl.h));
      const variantId = id === 'small' ? 'small' : 'card';
      const v = { ...NFC_BOX[variantId], ...NFC_BOXES[variantId] };
      return tuckBox({ kind: 'nfc-box', name: v.label, variantId, ...v, casing: { color: '#e9e4d8', roughness: 0.85 }, radiusMm: 0.8, marks: marksFor(v.w, v.h) });
    },
  },
  {
    kind: 'vinyl',
    name: 'Vinyl',
    group: 'Cases',
    variants: Object.entries(VINYL).map(([id, v]) => ({ id, label: v.label })),
    build: (id) => {
      const variantId = VINYL[id] ? id : '12inch';
      const { size: s, spine } = VINYL_SLEEVES[variantId];
      return wrap(
        'vinyl',
        VINYL[variantId].label,
        variantId,
        s,
        s,
        spine,
        {
          kind: 'box',
          widthMm: s,
          heightMm: s,
          depthMm: spine,
          faces: { '-x': 'spine', '+z': 'front', '-z': 'back' },
          casing: { color: '#1a1a1a', roughness: 0.7 },
          glossy: false,
          radiusMm: 1,
        },
      );
    },
  },
  {
    kind: 'game-case',
    name: 'Game case',
    group: 'Game cases',
    variants: Object.entries(GAME_CASE).map(([id, v]) => ({ id, label: v.label, origin: GAME_CASE_ORIGIN[id], caseName: GAME_CASE_NAME[id] })),
    build: (id) => {
      const variantId = GAME_CASE[id] ? id : 'ps4';
      const v = GAME_CASE[variantId];
      if (v.jewel) return jewelCase('game-case', v.label, variantId, 'black');
      const { insert: { w, h, spine }, outside } = GAME_CASES[variantId];
      const casing = v.clear ? { color: v.color, transmission: 0.9, roughness: 0.15 } : { color: v.color, roughness: 0.3 };
      // The 3D shows the real case with the insert inside it, where the case's outside is known (not the NES and SNES boxes).
      return wrap('game-case', v.label, variantId, w, h, spine,
        outside
          ? keepcasePreview(outside, outside.d ?? spine, casing, 2, UNDER_BAND[variantId] && { insertBottomMm: INSERT_BOTTOM_MM, emboss: UNDER_BAND[variantId].map((e) => ({ ...e, topMm: bandMiddle(outside.h, h) })) })
          : wrapPreview(w, h, spine, casing, true, 2));
    },
  },
];
