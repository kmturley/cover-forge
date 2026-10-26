import type { TemplateKind } from '../types/template';

/**
 * The "Branded" trade dress: each platform's front header, spine cap and marks, drawn as on retail covers. The values
 * follow branding-spec.md. Front sizes are fractions of the front panel (`W` wide, `H` tall); spine positions are
 * fractions of the spine's length `L`, and its marks' widths fractions of the spine's width `S`.
 */

/** A flat colour, or a gradient across the shape (`x`: left to right, `y`: top to bottom) as [offset, colour] stops. */
export type Paint = string | { x: [number, string][] } | { y: [number, string][] };

/** One piece of a lockup. `h` is its height relative to the others (default 1); `color` overrides the lockup's. */
export type Part =
  | { brand: string; h?: number; color?: string }
  | { logo: string; h?: number; color?: string; mono?: boolean; only?: number[]; crop?: [number, number, number, number] }
  | { text: string; h?: number; color?: string; weight?: number; italic?: boolean; spacing?: number }
  | { row: Part[] }
  | { stack: Part[] };

/** A logo made of parts laid side by side (a symbol followed by a wordmark). */
export interface Lockup {
  parts: Part[];
  color: string;
  /** A thin outline drawn round the whole lockup (PS1's boxed symbol). */
  frame?: { color: string; mm?: number };
  /** Gap between parts as a fraction of the lockup's height. Default 0.25. */
  gap?: number;
}

export interface FrontMark extends Lockup {
  /** Height as a fraction of H. */
  h: number;
  align: 'left' | 'center' | 'right';
  /** Distance from the aligned edge as a fraction of W. Default 0.025. */
  inset?: number;
  /** Centre as a fraction of H from the top; by default halfway down the header where the mark sits. */
  cy?: number;
  /** Measure alignment against the whole panel rather than the header (a mark on the artwork beside a tab). */
  onPanel?: boolean;
  /** Shifts the mark sideways by this fraction of W (positive: right). */
  dx?: number;
  /** A solid rectangle behind the mark, for marks that sit on the artwork. */
  plate?: string;
}

/** A mark fitted into a span of the spine (or of a front strip), centred in it. */
export interface SpanMark extends Lockup {
  /** Where it goes, as fractions of the length from the top. */
  from: number;
  to: number;
  /** Share of the width it may use. Default 0.6. */
  across?: number;
  /** 90 reads top-to-bottom (spines), −90 bottom-to-top (PS1 and early PS3 strips). */
  rotate: 0 | 90 | -90;
  /** Fills the whole span, edge to edge, behind the mark (PS2's white square). */
  plate?: string;
  /** Share of the strip's width the plate covers, centred. Default: all of it. */
  plateAcross?: number;
  /** Shifts the mark across the strip by this fraction of its width (positive: right or down). */
  dx?: number;
}

/** A line along a band's lower edge. `taper` makes it thinner towards both sides: that share of `size` at the edges. */
export interface Line { color: string; size: number; taper?: number; shadow?: { color: string; size: number } }

/** The lower edge of a band: its depth (fraction of H) at `x` (fraction of W from the left). */
export type Depth = (x: number) => number;

export const flat = (h: number): Depth => () => h;
/** Straight lines between [x, depth] points (GameCube's slope, Wii's S-curve). */
export const slope = (points: [number, number][]): Depth => (x) => {
  const i = points.findIndex(([px]) => px >= x);
  // Before the first point or past the last, the depth holds at that end's value.
  if (i === -1) return points[points.length - 1][1];
  if (i === 0) return points[0][1];
  const [x0, d0] = points[i - 1];
  const [x1, d1] = points[i];
  return d0 + ((d1 - d0) * (x - x0)) / (x1 - x0);
};
/** A single convex arc, `edge` deep at both sides and `centre` in the middle (Wii U). */
export const arc = (edge: number, centre: number): Depth => (x) => edge + (centre - edge) * (1 - (2 * x - 1) ** 2);
/** A curve deepening from `left` to `right`, slowly at first. */
export const ease = (left: number, right: number): Depth => (x) => left + (right - left) * x * x;

export type FrontHeader =
  /** Full width across the top. */
  | { shape: 'band'; depth: Depth; fill: Paint; line?: Line; decor?: 'xbox-orb' | 'x360-swoosh'; marks: FrontMark[] }
  /** A block in the top-left corner, `w` × `h`; with `wBottom` its right edge is a diagonal. */
  | { shape: 'tab'; w: number; h: number; wBottom?: number; /** Also paints the top bleed this far across (a share of W), so a logo flush with the top edge has none showing above it. */ lip?: number; fill: Paint; plate?: { top: number; bottom: number; fill: string; line: string }; marks: FrontMark[] }
  /** Full height down the left edge, `w` wide. Its marks run along it. */
  | { shape: 'strip'; w: number; fill: Paint; marks: SpanMark[] }
  | { shape: 'none'; marks: FrontMark[] };

export interface SpineBranding {
  /** Colours the whole spine (Switch red, Wii white). */
  fill?: Paint;
  /** A block at the top of the spine, `length` of L, closed by an optional line. `dome` curves its lower edge up in the middle by that share of L. */
  cap?: { length: number; fill: Paint; line?: { color: string; size: number; gap?: number }; dome?: number };
  /** A thin outline round the whole spine (or its cap), `mm` thick. `top: false` leaves the top edge off, and `rightFrom`
   * starts the right edge that far down (fraction of L) so it doesn't run along a header that meets it. */
  outline?: { color: string; mm: number; top?: boolean; right?: boolean; rightFrom?: number };
  marks: SpanMark[];
  /** Where the title may start (fraction of L). Default: just past the cap and the marks. */
  titleFrom?: number;
  /** Scales the title's automatic size (the VHS spine's is a little larger). */
  titleScale?: number;
  /** The title's colour when the chosen one wouldn't show on `fill` (dark grey on Wii's white spine). */
  titleColor?: string;
  /** Forces the title's letter case on this spine (PS1's is always printed in caps). */
  titleCase?: 'upper';
}

export interface Branding {
  front: FrontHeader;
  spine?: SpineBranding;
  /** Small format logos on the back (DVD, CD). */
  back?: FrontMark[];
  /** Continues the front's band (fill and line, no marks) across the back cover. */
  backBand?: boolean;
}

/** A mark's `color` only tints logo layers that have no fill of their own; logos with colours baked into the SVG (Wii, Xbox, Xbox 360…) ignore it. */
const W = '#ffffff';
const K = '#000000';
const PS = { brand: 'playstation' } as const;
const NINTENDO_RED = '#da1820';
/** Switch 2 covers print a brighter red than the Switch's (measured on three covers and the fan template). */
const SWITCH2_RED = '#f20c0d';
/** The Xbox One and Series covers' green, shared with the 3D case colour. */
export const XBOX_GREEN = '#0c7a1f';

const PS4_BLUE: Paint = { x: [[0, '#2e4a8e'], [0.5, '#2063a4'], [1, '#1381c0']] };
const X360_WHITE = '#ffffff';

/** A format's small spine cap and back logo (DVD, CD, VHS…), which have no front header. */
function format(label: Part[], color: string, bg: string, cap: number, spineLabel: Part[] = label, opts: { across?: number; titleScale?: number; rotate?: 0 | 90 | -90; inset?: number; from?: number; to?: number } = {}): Branding {
  return {
    front: { shape: 'none', marks: [] },
    spine: cap ? { cap: { length: cap, fill: bg }, marks: [{ parts: spineLabel, color, from: opts.from ?? opts.inset ?? 0.015, to: opts.to ?? cap - (opts.inset ?? 0.015), across: opts.across ?? 0.7, rotate: opts.rotate ?? 0 }], titleScale: opts.titleScale } : undefined,
    back: [{ parts: label, color, h: 0.035, align: 'left', inset: 0.05, cy: 0.94, plate: bg }],
  };
}

/** The contactless symbol that follows the word NFC: the card is touch enabled. */
const NFC_WAVES: Part[] = [{ logo: 'nfc', h: 0.82 }];

/** A plain band with a text label, for formats with no retail convention (floppy, NFC). */
function labelBand(text: string, bg: string, fg: string, h: number, cap: number, after: Part[] = [], scale = 1, spineBg = true, align: 'left' | 'center' = 'left'): Branding {
  const label: Part[] = [{ text, weight: 700, h: after.length ? 0.92 : 1 }, ...after];
  // The spine label stays centred in the cap (nudged down a touch) and shrinks with `scale`.
  const half = (cap / 2 - 0.015) * scale;
  const down = after.length ? 0.004 : 0;
  return {
    front: { shape: 'band', depth: flat(h), fill: bg, marks: [{ parts: label, color: fg, h: h * 0.45 * scale, align, ...(align === 'left' && { inset: 0.05 }), cy: h / 2 + (after.length ? 0.005 : 0) }] },
    spine: cap ? { ...(spineBg && { cap: { length: cap, fill: bg } }), marks: [{ parts: label, color: fg, from: cap / 2 - half + down, to: cap / 2 + half + down, rotate: 90 }] } : undefined,
  };
}

export const FORMAT_BRANDING: Record<TemplateKind, Branding> = {
  bluray: {
    backBand: true,
    front: { shape: 'band', depth: flat(0.08), fill: '#0a4da2', marks: [{ parts: [{ logo: 'blu-ray' }], color: W, h: 0.06, align: 'center' }] },
    spine: { cap: { length: 0.08, fill: '#0a4da2' }, marks: [{ parts: [{ logo: 'blu-ray' }], color: W, from: 0.008, to: 0.072, across: 0.85, rotate: 0 }] },
  },
  // Blu-ray 4K UHD: the Blu-ray layout with a black band, the grey logo and a grey line under the band (1 px at 96 dpi, 0.265 mm).
  uhd: {
    backBand: true,
    front: { shape: 'band', depth: flat(0.08), fill: K, line: { color: '#979797', size: 0.0018 }, marks: [{ parts: [{ logo: 'blu-ray-ultra-hd-4k' }], color: W, h: 0.0448, align: 'center' }] },
    spine: { cap: { length: 0.08, fill: K, line: { color: '#979797', size: 0.0018 } }, marks: [{ parts: [{ logo: 'blu-ray-ultra-hd' }], color: W, from: 0.88, to: 0.98, across: 0.85, rotate: 90 }], titleFrom: 0.13 },
  },
  dvd: format([{ stack: [{ text: 'DVD', weight: 800, h: 0.65 }, { text: 'VIDEO', weight: 600, h: 0.35, spacing: 0.15 }] }], W, '#141414', 0.08, [{ logo: 'dvd' }]),
  vhs: format([{ logo: 'vhs' }], W, '#141414', 0.08, undefined, { across: 0.58, titleScale: 1.25 }),
  cd: format([{ logo: 'cd' }], W, '#141414', 0.108, undefined, { across: 0.9, rotate: 90, from: 0.022, to: 0.102 }),
  cassette: format([{ logo: 'cassette', color: W }], W, '#141414', 0.26, undefined, { across: 0.9, rotate: 90, from: 0.035, to: 0.225, titleScale: 1.3 }),
  vinyl: format([{ text: 'STEREO · 33⅓ RPM', weight: 700 }], W, '#1a1a1a', 0),
  floppy: labelBand('FLOPPY', '#22252b', W, 0.086, 0),
  'nfc-card': labelBand('NFC', '#1a73e8', W, 0.082, 0, NFC_WAVES, 0.85),
  'nfc-sticker': labelBand('NFC', '#1a73e8', W, 0.1, 0, NFC_WAVES, 0.85, true, 'center'),
  'nfc-box': labelBand('NFC', '#1a73e8', W, 0.078, 0.13, NFC_WAVES, 0.85, false),
  'game-case': labelBand('GAME', '#1a1a1a', W, 0.1, 0.12),
};

/** Per-platform branding for game cases, keyed by variant id. US releases, current era; see branding-spec.md. */
export const GAME_CASE_BRANDING: Record<string, Branding> = {
  // Games for Windows (2006–2013): a white bevelled band, the logo left and "PC DVD" right.
  // PC: just the PC CD-ROM logo, top left at 28% of the cover's width (with a dark corner behind it that carries
  // the colour into the bleed), and the same logo turned to read down the top of the spine.
  pc: {
    front: {
      shape: 'tab', w: 0.01, lip: 0.28, h: 0.0646, fill: '#171717',
      marks: [{ parts: [{ logo: 'pc' }], color: W, h: 0.0646, align: 'left', inset: 0, cy: 0.0646 / 2, onPanel: true }],
    },
    spine: {
      marks: [{ parts: [{ logo: 'pc' }], color: W, from: 0.02, to: 0.19, across: 0.85, rotate: 90 }],
    },
  },
  // PS1 (jewel case): a black strip down the left, the PS symbol at its top and "PlayStation" reading upwards.
  ps1: {
    front: {
      shape: 'strip', w: 0.155, fill: K,
      marks: [
        { parts: [{ stack: [{ logo: 'playstation-mark-colour' }, { logo: 'playstation-wordmark', crop: [0, 0, 0.94, 1], h: 0.22 }] }], color: W, frame: { color: W }, gap: 0.3, from: 0.034, to: 0.1325, across: 0.635, dx: -0.005, rotate: 0 },
        { parts: [{ logo: 'sony-logo' }], color: W, from: 0.84, to: 0.98, across: 0.62, dx: -0.0035, rotate: 0 },
        { parts: [{ logo: 'playstation-wordmark' }], color: W, from: 0.168, to: 0.79, across: 0.85, dx: 0.064, rotate: -90 },
      ],
    },
    spine: {
      fill: K,
      marks: [{ parts: [{ logo: 'playstation-wordmark' }], color: W, from: 0.028, to: 0.147, dx: -0.05, rotate: 90 }],
      titleCase: 'upper',
    },
  },
  // PS2: a black band, the wordmark left and the PS symbol right; a black spine with the symbol on a white square.
  ps2: {
    front: {
      shape: 'band', depth: flat(0.104), fill: K, line: { color: W, size: 0.0016 },
      marks: [
        { parts: [{ logo: 'playstation-2-wordmark' }], color: W, h: 0.066, align: 'left', inset: 0.038, cy: 0.058 },
        { parts: [{ logo: 'playstation-mark-colour' }], color: W, h: 0.066, align: 'right', inset: 0.024, cy: 0.0525 },
      ],
    },
    spine: {
      cap: { length: 0.278, fill: K },
      outline: { color: W, mm: 0.25, top: false, rightFrom: 0.104 },
      marks: [
        { parts: [{ logo: 'playstation-mark-colour' }], color: K, plate: W, plateAcross: 0.79, from: 0.018, to: 0.0776, across: 0.6, rotate: 0 },
        { parts: [{ logo: 'playstation-2-wordmark' }], color: W, from: 0.1065, to: 0.262, rotate: 90 },
      ],
    },
  },
  // PS3 (2009–2017): black blending evenly to grey across the width, a crimson line, the logo left; a black spine cap with "PS3".
  ps3: {
    front: {
      shape: 'band', depth: flat(0.083), fill: { x: [[0, K], [1, '#868686']] }, line: { color: '#b00a0a', size: 0.004 },
      marks: [{ parts: [{ brand: 'playstation', color: '#b8b8b8' }, { brand: 'playstation3', h: 0.875 }], color: W, h: 0.05, align: 'left', inset: 0.032, gap: 0.6 }],
    },
    spine: { cap: { length: 0.1648, fill: K, line: { color: '#a50a0a', size: 0.004 } }, marks: [{ parts: [{ brand: 'playstation3' }], color: W, from: 0.0185, to: 0.1455, rotate: 90 }] },
  },
  // PS4: a blue gradient band with a white line; a blue spine cap to 23% L with the symbol, then "PS4".
  ps4: {
    front: {
      shape: 'band', depth: flat(0.1094), fill: PS4_BLUE, line: { color: W, size: 0.0042 },
      marks: [{ parts: [PS, { brand: 'playstation4', h: 0.6 }], color: W, h: 0.0765, align: 'left', inset: 0.022, gap: 0.5 }],
    },
    spine: {
      cap: { length: 0.2277, fill: '#2e4589', line: { color: W, size: 0.0042 } },
      marks: [
        { parts: [PS], color: W, from: 0.0174, to: 0.0654, across: 0.72, rotate: 0 },
        { parts: [{ brand: 'playstation4' }], color: W, from: 0.08, to: 0.21, across: 0.64, rotate: 90 },
      ],
    },
  },
  // PS5: a white band with a navy line and a black logo; a white spine cap to 23% L.
  ps5: {
    front: {
      shape: 'band', depth: flat(0.1117), fill: W, line: { color: '#094695', size: 0.0047 },
      marks: [{ parts: [PS, { brand: 'playstation5', h: 0.6 }], color: K, h: 0.075, align: 'left', inset: 0.037, gap: 0.32 }],
    },
    spine: {
      cap: { length: 0.2292, fill: W, line: { color: '#094695', size: 0.0052 } },
      marks: [
        { parts: [PS], color: K, from: 0.021, to: 0.066, across: 0.7, rotate: 0 },
        { parts: [{ brand: 'playstation5' }], color: K, from: 0.0779, to: 0.1935, across: 0.7, rotate: 90 },
      ],
    },
  },
  // PS Vita: a blue gradient band with a white line, the symbol and a large wordmark left; a dark blue spine cap with the wordmark.
  'ps-vita': {
    front: {
      shape: 'band', depth: flat(0.075), fill: { x: [[0, '#143b81'], [0.5, '#0b64ab'], [1, '#018fd7']] }, line: { color: W, size: 0.0065 },
      marks: [{ parts: [PS, { brand: 'playstationvita', h: 0.78 }], color: W, h: 0.0482, align: 'left', inset: 0.0607, gap: 0.66 }],
    },
    spine: {
      cap: { length: 0.1865, fill: '#143b81', line: { color: W, size: 0.006 } },
      marks: [{ parts: [{ brand: 'playstationvita' }], color: W, from: 0.019, to: 0.1624, dx: 0.025, rotate: 90 }],
    },
  },
  // Switch: a red tab in the top-left corner with the Joy-Con icon over "NINTENDO SWITCH"; a red spine.
  switch: {
    front: {
      shape: 'tab', w: 0.22, h: 0.132, fill: NINTENDO_RED,
      marks: [{ parts: [{ logo: 'switch' }], color: W, h: 0.096, align: 'center', dx: 0.006 }],
    },
    spine: { fill: NINTENDO_RED, marks: [{ parts: [{ logo: 'switch', crop: [0.155, 0, 0.805, 0.635] }], color: W, from: 0.014, to: 0.046, across: 0.6, rotate: 0 }], titleFrom: 0.08 },
  },
  // Switch 2: a full-width red band, the icon and "2" over a small "NINTENDO" and "SWITCH", centred; a red spine.
  switch2: {
    front: {
      shape: 'band', depth: flat(0.131), fill: SWITCH2_RED,
      marks: [{ parts: [{ logo: 'switch2' }], color: W, h: 0.0835, align: 'center' }],
    },
    spine: { fill: SWITCH2_RED, marks: [{ parts: [{ stack: [{ logo: 'switch2', only: [1] }, { logo: 'switch2', only: [2] }] }], color: W, gap: 0.7, from: 0.0235, to: 0.112, across: 0.5, rotate: 0 }], titleFrom: 0.12 },
  },
  // Wii U: a cyan band with a convex lower edge and a yellow-green line, "Wii U" centred; a white spine.
  'wii-u': {
    front: {
      shape: 'band', depth: arc(0.0346, 0.0941), fill: '#019fcc', line: { color: '#fcee38', size: 0.0078, taper: 0 },
      marks: [{ parts: [{ logo: 'wii-u', mono: true }], color: W, h: 0.052, align: 'center', cy: 0.043, dx: 0.004 }],
    },
    spine: {
      cap: { length: 0.0346, fill: '#019fcc', dome: 0.0075 },
      fill: W,
      titleColor: '#333333',
      marks: [{ parts: [{ logo: 'wii-u' }], color: W, from: 0.056, to: 0.191, across: 0.55, rotate: 90 }],
    },
  },
  // Wii: a white header that stays shallow across the left half, then curves down in an S to a deep plateau on the right,
  // with a grey line along it and "Wii" at the right; a white spine. (Depths are the band alone: the line is drawn below.)
  wii: {
    front: {
      shape: 'band', depth: slope([[0.0000, 0.0288], [0.0011, 0.0261], [0.0021, 0.0250], [0.0032, 0.0243], [0.0042, 0.0237], [0.0053, 0.0233], [0.0063, 0.0229], [0.0074, 0.0226], [0.0085, 0.0224], [0.0095, 0.0222], [0.0106, 0.0221], [0.0116, 0.0220], [0.0127, 0.022], [0.45, 0.024], [0.5, 0.028], [0.55, 0.036], [0.6, 0.05], [0.65, 0.072], [0.7, 0.1], [0.75, 0.119], [0.8, 0.1255], [1, 0.1255]]), fill: W, line: { color: '#8a8f93', size: 0.004 },
      marks: [{ parts: [{ logo: 'wii' }], color: W, h: 0.066, align: 'right', inset: 0.03 }],
    },
    spine: { fill: W, titleColor: '#333333', marks: [{ parts: [{ logo: 'wii' }], color: W, from: 0.0285, to: 0.1365, across: 0.55, rotate: 90 }] },
  },
  // GameCube: a black band with a convex lower edge and a white line tapering towards the sides, the cube and wordmark centred; a black spine cap.
  gamecube: {
    front: {
      shape: 'band', depth: arc(0.0575, 0.1055), fill: K, line: { color: '#f2f2f2', size: 0.0065, taper: 0.4, shadow: { color: '#8a8a8a', size: 0.0045 } },
      marks: [{ parts: [{ logo: 'gamecube', crop: [0, 0, 0.214, 1], h: 1.1 }, { logo: 'gamecube', crop: [0.214, 0, 1, 1] }], color: W, h: 0.0676, align: 'center', gap: 0, dx: 0.01 }],
    },
    spine: {
      cap: { length: 0.3097, fill: K, line: { color: W, size: 0.0051 } },
      marks: [
        { parts: [{ logo: 'gamecube' }], color: W, from: 0.069, to: 0.275, across: 0.62, rotate: 90 },
      ],
    },
  },
  // Xbox: a black band, the X and "XBOX" in green left of centre, a glowing orb top-right; a black spine cap.
  xbox: {
    front: {
      shape: 'band', depth: flat(0.1), fill: K, decor: 'xbox-orb',
      marks: [{ parts: [{ logo: 'xbox', crop: [0, 0, 0.339, 1] }, { logo: 'xbox', crop: [0.339, 0.285, 1, 0.71], h: 0.411 }], color: W, h: 0.0647, align: 'left', inset: 0.0415, cy: 0.0555, gap: 0.03 }],
    },
    spine: {
      cap: { length: 0.2154, fill: K },
      marks: [
        { parts: [{ logo: 'xbox', crop: [0, 0, 0.339, 1] }], color: W, from: 0.046, to: 0.093, across: 0.6, rotate: 0 },
        { parts: [{ logo: 'xbox', crop: [0.339, 0.285, 1, 0.71] }], color: W, from: 0.0946, to: 0.1891, across: 0.55, rotate: 90 },
      ],
    },
  },
  // Xbox 360: a white band with a thin green line and green swooshes on the right, the logo left; a white spine cap outlined in green on the left and below.
  'xbox-360': {
    front: {
      shape: 'band', depth: flat(0.121), fill: X360_WHITE, line: { color: '#8dc63f', size: 0.0016 }, decor: 'x360-swoosh',
      marks: [{ parts: [{ logo: 'xbox360' }], color: W, h: 0.0715, align: 'left', inset: 0.0275, cy: 0.0657 }],
    },
    spine: {
      cap: { length: 0.261, fill: X360_WHITE },
      outline: { color: '#8dc63f', mm: 0.25, top: false, right: false },
      marks: [
        { parts: [{ logo: 'xbox360', crop: [0, 0, 0.22, 1] }], color: W, from: 0.0275, to: 0.0762, across: 0.63, rotate: 0 },
        { parts: [{ logo: 'xbox360', crop: [0.22, 0.18, 1, 0.82] }], color: W, from: 0.0804, to: 0.249, across: 0.55, rotate: 90 },
      ],
    },
  },
  // Xbox One: a flat green band with the sphere and "XBOX ONE" centred, running over the spine's top; a charcoal spine.
  'xbox-one': {
    front: {
      shape: 'band', depth: flat(0.105), fill: XBOX_GREEN,
      marks: [{ parts: [{ logo: 'xbox-one' }], color: W, h: 0.052, align: 'center', cy: 0.0532, dx: -0.0052 }],
    },
    spine: {
      fill: '#373632',
      cap: { length: 0.105, fill: XBOX_GREEN },
      marks: [
        { parts: [{ logo: 'xbox-one', crop: [0, 0, 0.208, 1] }], color: W, from: 0.1298, to: 0.1812, across: 0.6, dx: 0.03, rotate: 0 },
        { parts: [{ logo: 'xbox-one', crop: [0.208, 0.16, 1, 0.82] }], color: W, from: 0.1823, to: 0.3503, across: 0.5, dx: 0.03, rotate: 90 },
      ],
    },
  },
  // Xbox Series X|S (2024 on): a green block over the spine's top and the front's top-left corner with a diagonal edge,
  // continued by a pale slanted plate holding "Xbox Series X"; a charcoal spine.
  'xbox-series': {
    front: {
      shape: 'tab', w: 0.2069, wBottom: 0.1195, h: 0.105, fill: XBOX_GREEN,
      plate: { top: 0.583, bottom: 0.497, fill: '#fcfcfc', line: '#d9d9d9' },
      marks: [
        { parts: [{ logo: 'xbox-seriesx-mark' }], color: W, h: 0.0583, align: 'left', inset: 0.0529, cy: 0.0588 },
        { parts: [{ text: 'Xbox Series X', weight: 800 }], color: '#333333', h: 0.0232, align: 'left', inset: 0.211, cy: 0.0582, onPanel: true },
      ],
    },
    spine: {
      fill: '#373632',
      cap: { length: 0.105, fill: XBOX_GREEN },
      marks: [
        { parts: [{ logo: 'xbox-seriesx-mark' }], color: W, from: 0.131, to: 0.181, across: 0.58, dx: 0.03, rotate: 0 },
        { parts: [{ logo: 'xbox-seriesx', crop: [0.372, 0.2, 1, 0.82] }], color: W, from: 0.1852, to: 0.2755, across: 0.4, dx: 0.02, rotate: 90 },
      ],
    },
  },
};

/** A variant of a format that is branded differently from the rest of its kind, by `${kind}/${variantId}`. */
const FORMAT_VARIANT_BRANDING: Record<string, Branding> = {
  // The slim case's spine is too narrow for the logo upright, so it runs along the spine.
  'bluray/slim-7': {
    ...FORMAT_BRANDING.bluray,
    spine: { ...FORMAT_BRANDING.bluray.spine!, marks: [{ ...FORMAT_BRANDING.bluray.spine!.marks![0], from: 0.016, to: 0.064, rotate: 90 }] },
  },
};

/** The branding for a template: its platform's for game cases, else its variant's or its format's. */
export function brandingFor(kind: TemplateKind, variantId: string): Branding {
  return kind === 'game-case' ? (Object.hasOwn(GAME_CASE_BRANDING, variantId) ? GAME_CASE_BRANDING[variantId] : FORMAT_BRANDING['game-case']) : (FORMAT_VARIANT_BRANDING[`${kind}/${variantId}`] ?? FORMAT_BRANDING[kind]);
}

/** How much to scale a spine title's automatic size by (1 unless the format asks for more). */
export function spineTitleScale(kind: TemplateKind, variantId: string, branded: boolean): number {
  return (branded ? brandingFor(kind, variantId).spine?.titleScale : undefined) ?? 1;
}

/** Room to leave at the start of a spine's title for the cap and marks (0 when Branded is off). */
export function spineTitleStartMm(kind: TemplateKind, variantId: string, branded: boolean, spineLengthMm: number): number {
  const spine = branded ? brandingFor(kind, variantId).spine : undefined;
  if (!spine) return 0;
  const end = spine.titleFrom ?? Math.max(spine.cap?.length ?? 0, ...spine.marks.map((m) => m.to)) + 0.02;
  return end * spineLengthMm;
}

/** Relative luminance of a #rrggbb colour (0 black, 1 white). */
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16);
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The spine title's colour: the chosen one, unless it would vanish on a Branded spine's own colour. */
export function spineTitleColor(kind: TemplateKind, variantId: string, branded: boolean, color: string): string {
  const spine = branded ? brandingFor(kind, variantId).spine : undefined;
  if (!spine?.titleColor || typeof spine.fill !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  return contrast(color, spine.fill) < 2 ? spine.titleColor : color;
}

/** Forces the spine title's letter case on platforms that always print it one way (PS1's is always caps). */
export function spineTitleCase(kind: TemplateKind, variantId: string, branded: boolean, text: string): string {
  const spine = branded ? brandingFor(kind, variantId).spine : undefined;
  return spine?.titleCase === 'upper' ? text.toUpperCase() : text;
}
