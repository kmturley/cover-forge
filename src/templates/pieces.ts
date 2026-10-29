import type { Piece, TemplateConfig } from '../types/template';
import { assemble, tuckBox } from './definitions';

/** What can be printed for a case, in the order the Type buttons list them. */
export const PIECES: readonly Piece[] = ['insert', 'slipcover', 'box'];

/** The name the editor shows for a piece: it is called a Type there. */
export const PIECE_NAME: Record<Piece, string> = { insert: 'Insert', slipcover: 'Slipcover', box: 'Box' };

/** Joins a case's template id to its piece: `dvd-std-14~slipcover`. An insert is the case's own id. */
export const PIECE_SEPARATOR = '~';

/**
 * Room added to the case's outer size, in mm, on width, height and depth. These two are assumptions, not published
 * figures: a sleeve or box printed on card and folded by hand needs a little play to slide on, and nobody publishes
 * one number for it (see case-research.md). Measure your own case if it has to be exact.
 */
export const SLIPCOVER_CLEARANCE_MM = 1.5;
export const BOX_CLEARANCE_MM = 2;

/** The glue tab on a slipcover, and the bleed around every piece. */
const GLUE_MM = 10;
const BLEED_MM = 3;

/** The outer size of the thing a slipcover or box goes round, in mm. */
export interface CaseSpec {
  w: number;
  h: number;
  depth: number;
  /** false when the size is a published figure; true when it is worked out from the insert (see `caseSpecOf`). */
  derived: boolean;
}

/**
 * The outside size (width, height) of a case, from the "Case exterior" tables in case-research.md. The DVD keepcase is
 * 135 × 190 mm; the Blu-ray-class case 135 × 170–171.5 (171 is the most repeated); a Switch case 105 × 170. Depth is the
 * insert's spine unless noted.
 */
const DVD_CASE = { w: 135, h: 190 };
const TALL_CASE = { w: 135, h: 171 };
const GAME_OUTER: Record<string, { w: number; h: number; depth?: number }> = {
  pc: DVD_CASE,
  ps2: DVD_CASE,
  'wii-u': DVD_CASE,
  wii: DVD_CASE,
  gamecube: DVD_CASE,
  xbox: DVD_CASE,
  'xbox-360': DVD_CASE,
  ps3: TALL_CASE,
  ps4: TALL_CASE,
  ps5: TALL_CASE,
  'xbox-one': { w: 135, h: 170 },
  'xbox-series': { w: 135, h: 170 },
  switch: { w: 105, h: 170 },
  switch2: { w: 105, h: 170 },
  // A single manufacturer source; the case is 11 mm deep against the insert's 9 mm spine.
  'ps-vita': { w: 105, h: 135, depth: 11 },
};

/**
 * Where no outside size is known (a cassette case isn't researched), the insert's size plus what a DVD case adds to its
 * insert (a 135 × 190 mm case, a 129.5 × 183 mm insert). A record jacket is the outer size already.
 */
const SHELL_MARGIN = { w: 5.5, h: 7 };

/** A CD jewel case: 142 × 125 × 10 mm outside (case-research.md §1). */
const JEWEL: CaseSpec = { w: 142, h: 125, depth: 10, derived: false };

const isJewel = (t: TemplateConfig) => t.kind === 'cd' || (t.kind === 'game-case' && t.variantId === 'ps1');

/**
 * The outer size of the case a base template is printed for, or null when no slipcover or box makes sense for it
 * (a round sticker). A template that is already a box (VHS, the NFC boxes) is its own case: the box is what the
 * sleeve goes round.
 */
export function caseSpecOf(base: TemplateConfig): CaseSpec | null {
  const p = base.preview;
  if (base.kind === 'nfc-sticker') return null;
  if (p.kind === 'slab') return { w: p.bodyWidthMm, h: p.bodyHeightMm, depth: p.bodyDepthMm, derived: false };
  if (isJewel(base)) return JEWEL;
  if (base.kind === 'vhs' || base.kind === 'nfc-box') return { w: p.widthMm, h: p.heightMm, depth: p.depthMm, derived: false };
  const front = base.panels.find((q) => q.id === 'front');
  const spine = base.panels.find((q) => q.id === 'spine');
  if (!front || !spine) return null;
  const known: { w: number; h: number; depth?: number } | undefined = base.kind === 'dvd' ? DVD_CASE : base.kind === 'bluray' || base.kind === 'uhd' ? TALL_CASE : base.kind === 'game-case' ? GAME_OUTER[base.variantId] : undefined;
  if (known) return { w: known.w, h: known.h, depth: known.depth ?? spine.widthMm, derived: false };
  // A record jacket is the outer size already.
  const margin = base.kind === 'vinyl' ? { w: 0, h: 0 } : SHELL_MARGIN;
  return { w: front.widthMm + margin.w, h: front.heightMm + margin.h, depth: spine.widthMm, derived: true };
}

const named = (base: TemplateConfig, piece: Exclude<Piece, 'insert'>, t: TemplateConfig): TemplateConfig => ({
  ...t,
  id: `${base.id}${PIECE_SEPARATOR}${piece}`,
  kind: base.kind,
  variantId: base.variantId,
  name: `${base.name} ${PIECE_NAME[piece].toLowerCase()}`,
  piece,
});

/**
 * A slipcover: a card sleeve round the case with open ends, a strip [ back | spine | front | spine | glue tab ] folded
 * into a tube. Only the glue tab is stuck, and the case slides in through either end. Both spines carry the title.
 */
export function slipcover(base: TemplateConfig, spec: CaseSpec): TemplateConfig {
  const [w, h, d] = [spec.w + SLIPCOVER_CLEARANCE_MM, spec.h + SLIPCOVER_CLEARANCE_MM, spec.depth + SLIPCOVER_CLEARANCE_MM];
  return named(
    base,
    'slipcover',
    assemble({
      kind: base.kind,
      name: base.name,
      variantId: base.variantId,
      bleedMm: BLEED_MM,
      pieces: [
        {
          dir: 'row',
          specs: [
            { id: 'back', label: 'Back', w, h },
            { id: 'spine', label: 'Spine (left)', w: d, h, text: 'vertical' },
            { id: 'front', label: 'Front', w, h },
            { id: 'spineRight', label: 'Spine (right)', w: d, h, text: 'vertical', mirrors: 'spine' },
            { id: 'glue', label: 'Glue tab', w: GLUE_MM, h, follows: 'spineRight' },
          ],
        },
      ],
      preview: {
        kind: 'box',
        widthMm: w,
        heightMm: h,
        depthMm: d,
        // The ends are open: nothing is printed on the top and bottom, and the 3D view leaves them out.
        faces: { '+z': 'front', '-z': 'back', '-x': 'spine', '+x': 'spineRight' },
        hollow: true,
        casing: { color: '#e6dfcf', roughness: 0.8 },
        glossy: false,
        radiusMm: 0.5,
      },
    }),
  );
}

/** A box that holds the case, card or media: the tuck-end net used for the VHS and NFC boxes, sized to it plus room. */
export function box(base: TemplateConfig, spec: CaseSpec): TemplateConfig {
  return named(
    base,
    'box',
    tuckBox({
      kind: base.kind,
      name: base.name,
      variantId: base.variantId,
      w: spec.w + BOX_CLEARANCE_MM,
      h: spec.h + BOX_CLEARANCE_MM,
      d: spec.depth + BOX_CLEARANCE_MM,
      casing: { color: '#e6dfcf', roughness: 0.8 },
      radiusMm: 1,
      mirrorSpine: true,
    }),
  );
}
