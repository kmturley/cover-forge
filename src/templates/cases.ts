/**
 * The physical things the app prints for, in one place: each case's real outside size and the size of what is printed
 * for it, in mm, with where each figure comes from. Templates (definitions.ts), slipcovers and boxes (pieces.ts) and the
 * 3D jewel case (three/JewelCase.tsx) all read their sizes from here, so a figure is set once and a correction reaches
 * the 2D print, the 3D view and the pieces built round it together.
 *
 * Sources are sections of case-research.md (§n), where each figure is cross-checked against several independent
 * sources; anything that rests on a single source, or is worked out rather than published, says so.
 *
 * Only physical sizes live here. How the pieces are laid out on the sheet, the 3D materials and the names shown in the
 * app stay with the templates.
 */

/** A size in mm. `d` (depth) left out means "the printed spine's width". */
export interface Size {
  w: number;
  h: number;
  d?: number;
}

/** A printed wrap's front panel (the back is the same size) and the spine between them, mm. */
export interface InsertSize {
  w: number;
  h: number;
  spine: number;
}

// ——— Shells: the real outside of a case ———

/** The DVD keepcase, 135 × 190 mm (§2). Depth is the insert's spine (14 mm standard, 7 or 9 mm slim, §3). */
export const DVD_SHELL: Size = { w: 135, h: 190 };
/** The tall Blu-ray-class case, 135 × 171 mm: 171 is the most repeated of the published 170–171.5 (§4). */
export const BLURAY_SHELL: Size = { w: 135, h: 171 };
/** The Xbox One and Series case: published as 135 × 170 mm (§5). */
export const XBOX_ONE_SHELL: Size = { w: 135, h: 170 };
/** The Switch case, 105 × 170 mm (§6). */
export const SWITCH_SHELL: Size = { w: 105, h: 170 };
/** The DS case: 136 × 124 mm, the footprint the 3DS case shares, and about 19 mm deep (§13, §15). */
export const DS_SHELL: Size = { w: 136, h: 124, d: 19 };
/** The 3DS case: 136 × 124 × 12.5 mm (Walvis; §14, §15). */
export const THREEDS_SHELL: Size = { w: 136, h: 124, d: 12.5 };
/** The PS Vita case: 105 × 135 × 11 mm. A single manufacturer source (§7). */
export const VITA_SHELL: Size = { w: 105, h: 135, d: 11 };

// ——— Inserts: what is printed for a case ———

/** The DVD keepcase insert, 129.5 × 183 mm front (§2). */
export const DVD_INSERT = { w: 129.5, h: 183 };
/** The Blu-ray insert, 128 × 149 mm front (§4), also the Xbox One and Series insert (§5). */
export const BLURAY_INSERT = { w: 128, h: 149 };

/** Spines of the DVD cases, by template variant (§2, §3). */
export const DVD_SPINES: Record<string, number> = { 'std-14': 14, 'slim-7': 7, 'slim-9': 9 };
/** Spines of the Blu-ray cases, by template variant (§4). */
export const BLURAY_SPINES: Record<string, number> = { 'us-11': 11, 'slim-7': 7, 'us-12.5': 12.5, 'eu-14': 14 };
/** Spines of the 4K UHD cases, by template variant: Severin's single to 3-disc cases are 12.5 mm, its 4-disc 15 mm (§12). */
export const UHD_SPINES: Record<string, number> = { 'us-11': 11, 'elite-12.5': 12.5, 'multi4-15': 15 };

/**
 * The CD jewel case (CD, PS1; §1): 142 × 125 × 10 mm outside. Its booklet sits behind the lid 3 mm in from the opening
 * edge; its tray card wraps the disc tray, a 137 mm back between two 6.5 mm flaps, 2 mm shorter than the booklet (the
 * tray's hinge and teeth along the top trim it).
 *
 * `parts` are the plastic mouldings the 3D view draws, measured from a real case's 3D model ("Compact disc and case" by
 * effe on BlendSwap, CC0) and a photo of an empty case. x runs across the case from its centre (the hinge on -x), z
 * through it (the lid at +z).
 */
export const JEWEL_CASE = {
  outside: { w: 142, h: 125, d: 10 },
  booklet: { w: 120, h: 120, fromOpeningEdgeMm: 3 },
  trayCard: { back: 137, flap: 6.5, h: 118 },
  /** The shell's front and back walls. */
  wallMm: 1,
  parts: {
    /** The lid: as tall as the case; its top and bottom walls wrap over the base; its front stops this far in from the hinge edge. */
    lid: { frontFromHingeMm: 12 },
    /** The base: shorter than the lid (inside its walls); its end wall on the opening side is set in this far, leaving a finger slot. */
    base: { heightMm: 122.8, openingWallInsetMm: 1 },
    tray: {
      /** Its floor's gap in front of the base's back wall (the tray card's place) and its thickness. */
      floorGapMm: 0.2,
      floorMm: 0.8,
      /** The deck round the disc well: its top this far in front of the base's back wall. */
      deckMm: 5.87,
      /** Its end on the opening side: this far in from the base's end wall (the card's flap's place). */
      endGapMm: 0.2,
      /**
       * The hinge strip, as far in from the case's hinge edge as the lid's front starts: a channel open to the outside, its
       * front flush with the lid's (the band down the front of the case), its inner wall the well's side. The card's flap
       * sits inside it.
       */
      strip: { frontMm: 1.75, wallMm: 1, ribs: 9, ribWidthMm: 0.45, ribMm: 0.15 },
      /** The disc well: its centre right of the case's centre, its rim's radius; it runs off the tray's top and bottom edges. */
      well: { xMm: 4.3, radiusMm: 61, rimMm: 0.8 },
      /** The hub: a low round platform, and inside it a crown of teeth (the slots between them radiate from a small hole). */
      hub: { platformMm: 15, platformHeightMm: 1.2, crownMm: 9.5, crownHeightMm: 3.2, holeMm: 3.5, slotWidthMm: 1.1, slots: 16 },
    },
    /** The lid's four booklet tabs: half-round clips inside its top and bottom walls, centred at these x. */
    tabs: { radiusMm: 5, depthMm: 0.8, xMm: [-37, 47] as const },
  },
} as const;

/**
 * Each game platform's case: the printed insert (US releases, cross-checked in case-research.md) and the real outside of
 * the case it goes in, where that is known. Platforms on the same case share a size; the brand only changes the dress.
 */
export const GAME_CASES: Record<string, { insert: InsertSize; outside?: Size }> = {
  // PC boxed games shipped in standard DVD keepcases (§2).
  pc: { insert: { ...DVD_INSERT, spine: 14 }, outside: DVD_SHELL },
  // PS1 is a jewel case: its template is built from JEWEL_CASE's pieces (the booklet and a tray-card flap here).
  ps1: { insert: { w: JEWEL_CASE.booklet.w, h: JEWEL_CASE.booklet.h, spine: JEWEL_CASE.trayCard.flap }, outside: JEWEL_CASE.outside },
  ps2: { insert: { ...DVD_INSERT, spine: 14 }, outside: DVD_SHELL },
  // The Blu-ray-class shell, with a shorter insert window on the PS3 than the PS4 and PS5 (§4).
  ps3: { insert: { w: 129.5, h: 149, spine: 14 }, outside: BLURAY_SHELL },
  ps4: { insert: { w: 129.5, h: 161, spine: 14 }, outside: BLURAY_SHELL },
  ps5: { insert: { w: 129.5, h: 161, spine: 14 }, outside: BLURAY_SHELL },
  // From a reported 207 × 125 mm full cover; the lowest-confidence case (§7).
  'ps-vita': { insert: { w: 99, h: 125, spine: 9 }, outside: VITA_SHELL },
  // The Game Boy family's template is the DS-size case sold for them since; their covers in scans/ measure like the DS's (§16–18).
  gb: { insert: { w: 130, h: 116, spine: 16 }, outside: DS_SHELL },
  gbc: { insert: { w: 130, h: 116, spine: 16 }, outside: DS_SHELL },
  gba: { insert: { w: 130, h: 116, spine: 16 }, outside: DS_SHELL },
  // The retail box's wrap (§20): no published case size, so a slipcover works it out from the insert.
  nes: { insert: { w: 133, h: 176, spine: 28 } },
  // PROTOTYPE: the retail box, 7 × 5 × 1.25 in (§21).
  snes: { insert: { w: 127, h: 177.8, spine: 31.75 } },
  ds: { insert: { w: 130, h: 116, spine: 16 }, outside: DS_SHELL },
  // The 3DS front is 130 like the DS's, whose case footprint it shares (§14, §15).
  '3ds': { insert: { w: 130, h: 116, spine: 12 }, outside: THREEDS_SHELL },
  switch: { insert: { w: 99, h: 161, spine: 10 }, outside: SWITCH_SHELL },
  switch2: { insert: { w: 99, h: 161, spine: 10 }, outside: SWITCH_SHELL },
  'wii-u': { insert: { ...DVD_INSERT, spine: 14 }, outside: DVD_SHELL },
  wii: { insert: { ...DVD_INSERT, spine: 14 }, outside: DVD_SHELL },
  gamecube: { insert: { ...DVD_INSERT, spine: 14 }, outside: DVD_SHELL },
  xbox: { insert: { ...DVD_INSERT, spine: 14 }, outside: DVD_SHELL },
  'xbox-360': { insert: { ...DVD_INSERT, spine: 14 }, outside: DVD_SHELL },
  // The Blu-ray insert in Microsoft's own case (§5). Scans of Series X covers read 156 mm tall: unconfirmed (see scans-needed.md).
  'xbox-one': { insert: { ...BLURAY_INSERT, spine: 11 }, outside: XBOX_ONE_SHELL },
  // The newest Series case (2023 on), the one its dress draws: the insert runs almost the case's full height, its printed
  // header at the top with ~5.5 mm of green above and below (photo of a retail GTA V case; the three scans' proportions
  // agree). The original 2020 case followed the Xbox One's, a 149 mm insert under a green case band (§5).
  'xbox-series': { insert: { w: 129.5, h: 161, spine: 11 }, outside: XBOX_ONE_SHELL },
};

/**
 * MiniDisc cases (§22):
 * - the standard case, printed with a J-card: one 73 mm strip, a 68 mm front, a 5.5 mm spine and an 11 mm tab that tucks
 *   behind the disc;
 * - the album case pre-recorded discs came in, 90 × 110 × 14 mm outside, built like a jewel case: a 106 × 101.5 mm tray
 *   card (a 9.3 mm flap, an 87.4 mm back, a 9.3 mm flap) and a 73 × 105 mm booklet, measured from the case seller's
 *   printable templates.
 */
export const MINIDISC_JCARD = { front: 68, spine: 5.5, tab: 11, h: 73 };
export const MINIDISC_ALBUM = { outside: { w: 90, h: 110, d: 14 }, tray: { w: 106, h: 101.5, spine: 9.3 }, booklet: { w: 73, h: 105 } };

/** The slim 8 cm case for Mini CDs and Mini DVDs, 93 × 90 × 5.2 mm, holding a 82.6 × 85.7 mm card, with a 1 mm frame round its back (§25). */
export const MINI_CD_SLIM = { outside: { w: 93, h: 90, d: 5.2 }, card: { w: 82.6, h: 85.7 }, frame: 1 };

/** The compact cassette's J-card: one 101.6 mm strip, a 25.4 mm flap round the back, a 12.7 mm spine and a 65.1 mm front (§9). */
export const CASSETTE_JCARD = { back: 25.4, spine: 12.7, front: 65.1, h: 101.6 };

/** A retail VHS sleeve, card not plastic: 105 × 190 mm, the 25 mm thickness its spine along the long side (§8). */
export const VHS_SLEEVE = { w: 105, h: 190, d: 25 };
/** A Betamax cassette's sleeve, 98 × 159 × 27 mm (§23). */
export const BETAMAX_SLEEVE = { w: 98, h: 159, d: 27 };
/** A tuck box for a poker-size deck (63.5 × 88.9 mm cards), 66 × 91 × 18 mm for 54 cards (§24). */
export const CARD_BOX = { w: 66, h: 91, d: 18 };

/** Record sleeves: square outer jackets about 3 mm thick. Not in case-research.md: the common published jacket sizes. */
export const VINYL_SLEEVES: Record<string, { size: number; spine: number }> = {
  '12inch': { size: 314, spine: 3 },
  '10inch': { size: 262, spine: 3 },
  '7inch': { size: 184, spine: 3 },
};

/** A 3.5-inch floppy disk, 90 × 94 × 3.3 mm, and its 69.85 mm (2¾ in) square label (§10). */
export const FLOPPY = { body: { w: 90, h: 94, d: 3.3 }, label: 69.85 };

/** An ISO/IEC 7810 ID-1 (CR80) card: 54 × 85.6 × 0.76 mm with 3.18 mm corners. */
export const CR80 = { w: 54, h: 85.6, d: 0.76, radius: 3.18 };
/** Boxes and a wallet for an NFC card (a CR80 card plus room to slide) and a small keepsake box. Our own sizes, not a standard. */
export const NFC_BOXES = { card: { w: 58, h: 90, d: 6 }, small: { w: 60, h: 60, d: 25 }, wallet: { w: 58, h: 90 } };
/** Round NFC stickers, by diameter. */
export const NFC_STICKERS: Record<string, number> = { '25': 25, '30': 30, '35': 35 };
