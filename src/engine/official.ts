import type { PanelRect, TemplateConfig, TemplateKind } from '../types/template';
import { paintRect } from '../templates/geometry';
import { brandHeight, brandPath2D, brandWidth, getBrand, getLogo, logoPaths2D } from '../brands';
import { X360_WAVES, X360_WAVES_SIZE } from './x360Waves.generated';

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
  | { logo: string; h?: number; color?: string; mono?: boolean; ink?: string; only?: number[]; crop?: [number, number, number, number] }
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
}

const W = '#ffffff';
const K = '#000000';
const PS = { brand: 'playstation' } as const;
const NINTENDO_RED = '#da1820';
/** Switch 2 covers print a brighter red than the Switch's (measured on three covers and the fan template). */
const SWITCH2_RED = '#f20c0d';
const XBOX_GREEN = '#107c10';

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
    front: { shape: 'band', depth: flat(0.08), fill: '#0a4da2', marks: [{ parts: [{ logo: 'bluray' }], color: W, h: 0.06, align: 'center' }] },
    spine: { cap: { length: 0.08, fill: '#0a4da2' }, marks: [{ parts: [{ logo: 'bluray' }], color: W, from: 0.008, to: 0.072, across: 0.85, rotate: 0 }] },
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
        { parts: [{ stack: [{ logo: 'playstation-mark-colour' }, { logo: 'playstation-wordmark', mono: true, crop: [0, 0, 0.94, 1], h: 0.22 }] }], color: W, frame: { color: W }, gap: 0.3, from: 0.034, to: 0.1325, across: 0.635, dx: -0.005, rotate: 0 },
        { parts: [{ logo: 'sony-logo', ink: '#013999' }], color: W, from: 0.84, to: 0.98, across: 0.62, dx: -0.0035, rotate: 0 },
        { parts: [{ logo: 'playstation-wordmark', mono: true }], color: W, from: 0.168, to: 0.79, across: 0.85, dx: 0.064, rotate: -90 },
      ],
    },
    spine: {
      fill: K,
      marks: [{ parts: [{ logo: 'playstation-wordmark', mono: true }], color: W, from: 0.028, to: 0.147, dx: -0.05, rotate: 90 }],
      titleCase: 'upper',
    },
  },
  // PS2: a black band, the wordmark left and the PS symbol right; a black spine with the symbol on a white square.
  ps2: {
    front: {
      shape: 'band', depth: flat(0.104), fill: K, line: { color: W, size: 0.0016 },
      marks: [
        { parts: [{ logo: 'playstation-2-wordmark', mono: true }], color: W, h: 0.066, align: 'left', inset: 0.038, cy: 0.058 },
        { parts: [{ logo: 'playstation-mark-colour' }], color: W, h: 0.066, align: 'right', inset: 0.024, cy: 0.0525 },
      ],
    },
    spine: {
      cap: { length: 0.278, fill: K },
      outline: { color: W, mm: 0.25, top: false, rightFrom: 0.104 },
      marks: [
        { parts: [{ logo: 'playstation-mark-colour' }], color: K, plate: W, plateAcross: 0.79, from: 0.018, to: 0.0776, across: 0.6, rotate: 0 },
        { parts: [{ logo: 'playstation-2-wordmark', mono: true }], color: W, from: 0.1065, to: 0.262, rotate: 90 },
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
      marks: [{ parts: [{ logo: 'wii-u' }], color: '#8c8c8c', from: 0.056, to: 0.191, across: 0.55, rotate: 90 }],
    },
  },
  // Wii: a white header that stays shallow across the left half, then curves down in an S to a deep plateau on the right,
  // with a grey line along it and "Wii" at the right; a white spine. (Depths are the band alone: the line is drawn below.)
  wii: {
    front: {
      shape: 'band', depth: slope([[0.0000, 0.0288], [0.0011, 0.0261], [0.0021, 0.0250], [0.0032, 0.0243], [0.0042, 0.0237], [0.0053, 0.0233], [0.0063, 0.0229], [0.0074, 0.0226], [0.0085, 0.0224], [0.0095, 0.0222], [0.0106, 0.0221], [0.0116, 0.0220], [0.0127, 0.022], [0.45, 0.024], [0.5, 0.028], [0.55, 0.036], [0.6, 0.05], [0.65, 0.072], [0.7, 0.1], [0.75, 0.119], [0.8, 0.1255], [1, 0.1255]]), fill: W, line: { color: '#8a8f93', size: 0.004 },
      marks: [{ parts: [{ logo: 'wii', mono: true }], color: '#838488', h: 0.066, align: 'right', inset: 0.03 }],
    },
    spine: { fill: W, titleColor: '#333333', marks: [{ parts: [{ logo: 'wii', mono: true }], color: '#838488', from: 0.0285, to: 0.1365, across: 0.55, rotate: 90 }] },
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
      marks: [{ parts: [{ logo: 'xbox', crop: [0, 0, 0.339, 1] }, { logo: 'xbox', crop: [0.339, 0.285, 1, 0.71], h: 0.411 }], color: '#94c83f', h: 0.0647, align: 'left', inset: 0.0415, cy: 0.0555, gap: 0.03 }],
    },
    spine: {
      cap: { length: 0.2154, fill: K },
      marks: [
        { parts: [{ logo: 'xbox', crop: [0, 0, 0.339, 1] }], color: '#94c83f', from: 0.046, to: 0.093, across: 0.6, rotate: 0 },
        { parts: [{ logo: 'xbox', crop: [0.339, 0.285, 1, 0.71] }], color: '#94c83f', from: 0.0946, to: 0.1891, across: 0.55, rotate: 90 },
      ],
    },
  },
  // Xbox 360: a white band with a thin green line and green swooshes on the right, the logo left; a white spine cap outlined in green on the left and below.
  'xbox-360': {
    front: {
      shape: 'band', depth: flat(0.121), fill: X360_WHITE, line: { color: '#8dc63f', size: 0.0016 }, decor: 'x360-swoosh',
      marks: [{ parts: [{ logo: 'xbox360' }], color: '#92c83e', h: 0.0715, align: 'left', inset: 0.0275, cy: 0.0657 }],
    },
    spine: {
      cap: { length: 0.261, fill: X360_WHITE },
      outline: { color: '#8dc63f', mm: 0.25, top: false, right: false },
      marks: [
        { parts: [{ logo: 'xbox360', crop: [0, 0, 0.22, 1] }], color: '#92c83e', from: 0.0275, to: 0.0762, across: 0.63, rotate: 0 },
        { parts: [{ logo: 'xbox360', crop: [0.22, 0.18, 1, 0.82] }], color: '#92c83e', from: 0.0804, to: 0.249, across: 0.55, rotate: 90 },
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

/** The branding for a template: its platform's for game cases, else its format's. */
export function brandingFor(kind: TemplateKind, variantId: string): Branding {
  return kind === 'game-case' ? (GAME_CASE_BRANDING[variantId] ?? FORMAT_BRANDING['game-case']) : FORMAT_BRANDING[kind];
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

// ——— Drawing ———

const FONT = 'Helvetica, Arial, sans-serif';
/** Cap height of the font, as a fraction of its size. */
const CAP = 0.72;

type Ctx = CanvasRenderingContext2D;

function paint(ctx: Ctx, fill: Paint, x: number, y: number, w: number, h: number): string | CanvasGradient {
  if (typeof fill === 'string') return fill;
  const [stops, g] = 'x' in fill ? [fill.x, ctx.createLinearGradient(x, 0, x + w, 0)] : [fill.y, ctx.createLinearGradient(0, y, 0, y + h)];
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

const partH = (p: Part) => ('h' in p && p.h) || 1;

function setFont(ctx: Ctx, p: { weight?: number; italic?: boolean; spacing?: number }, capPx: number) {
  const size = capPx / CAP;
  ctx.font = `${p.italic ? 'italic ' : ''}${p.weight ?? 700} ${size}px ${FONT}`;
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${(p.spacing ?? 0) * size}px`;
}

interface Box { w: number; h: number; draw: (x: number, y: number) => void }


/** Lays out parts at `unit` pixels per relative height unit; returns the size and a function drawing it at a top-left. */
function layout(ctx: Ctx, parts: Part[], color: string, unit: number, gapUnits: number, dir: 'row' | 'stack'): Box {
  const boxes = parts.map((p) => part(ctx, p, color, unit, gapUnits));
  const gap = gapUnits * unit;
  if (dir === 'row') {
    const w = boxes.reduce((s, b) => s + b.w, 0) + gap * (boxes.length - 1);
    const h = Math.max(...boxes.map((b) => b.h));
    return {
      w, h,
      draw: (x, y) => boxes.reduce((cx, b) => (b.draw(cx, y + (h - b.h) / 2), cx + b.w + gap), x),
    };
  }
  const w = Math.max(...boxes.map((b) => b.w));
  const sgap = gap * 0.4;
  const h = boxes.reduce((s, b) => s + b.h, 0) + sgap * (boxes.length - 1);
  return { w, h, draw: (x, y) => boxes.reduce((cy, b) => (b.draw(x + (w - b.w) / 2, cy), cy + b.h + sgap), y) };
}

function part(ctx: Ctx, p: Part, color: string, unit: number, gapUnits: number): Box {
  if ('row' in p) return layout(ctx, p.row, color, unit, gapUnits, 'row');
  if ('stack' in p) return layout(ctx, p.stack, color, unit, gapUnits, 'stack');
  const h = partH(p) * unit;
  const fill = p.color ?? color;
  if ('text' in p) {
    ctx.save();
    setFont(ctx, p, h);
    const w = ctx.measureText(p.text).width;
    ctx.restore();
    return {
      w, h,
      draw: (x, y) => {
        ctx.save();
        setFont(ctx, p, h);
        ctx.fillStyle = fill;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(p.text, x, y + h);
        ctx.restore();
      },
    };
  }
  if ('brand' in p) {
    const b = getBrand(p.brand);
    if (!b) return { w: 0, h: 0, draw: () => {} };
    const k = h / brandHeight(b);
    return {
      w: brandWidth(b) * k, h,
      draw: (x, y) => {
        ctx.save();
        ctx.fillStyle = fill;
        ctx.translate(x, y);
        ctx.scale(k, k);
        ctx.translate(-b.bbox[0], -b.bbox[1]);
        ctx.fill(brandPath2D(b));
        ctx.restore();
      },
    };
  }
  {
    // What is left is a supplied logo.
    const l = getLogo(p.logo);
    if (!l) return { w: 0, h: 0, draw: () => {} };
    const used = l.layers.map((_, i) => i).filter((i) => !p.only || p.only.includes(i));
    const boxes = used.map((i) => l.layers[i].box);
    const [lx0, ly0, lx1, ly1] = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
    // `crop` keeps only a share of the artwork, as fractions of its bounds: [left, top, right, bottom].
    const [c0, c1, c2, c3] = p.crop ?? [0, 0, 1, 1];
    const [bx, by] = [lx0 + c0 * (lx1 - lx0), ly0 + c1 * (ly1 - ly0)];
    const [bw, bh] = [(c2 - c0) * (lx1 - lx0), (c3 - c1) * (ly1 - ly0)];
    const k = h / bh;
    return {
      w: bw * k, h,
      draw: (x, y) => {
        const paths = logoPaths2D(l);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        if (p.crop) {
          ctx.beginPath();
          ctx.rect(0, 0, bw, bh);
          ctx.clip();
        }
        used.forEach((i) => {
          const layer = l.layers[i];
          ctx.save();
          ctx.translate(-bx + layer.offset[0], -by + layer.offset[1]);
          if (layer.fill !== 'none') {
            ctx.fillStyle = p.mono || !layer.fill || layer.fill === p.ink ? fill : layer.fill;
            const grad = layer.gradient && !p.mono && layer.fill !== p.ink ? layer.gradient : undefined;
            let shape = paths[i];
            if (grad) {
              let g: CanvasGradient;
              ctx.save();
              if (grad.radial) {
                // A radial gradient is the unit circle under a matrix, so the layer is drawn through its inverse.
                const [a, b, c, d, e, f] = grad.radial;
                const det = a * d - b * c;
                const inv = { a: d / det, b: -b / det, c: -c / det, d: a / det, e: (c * f - d * e) / det, f: (b * e - a * f) / det };
                ctx.transform(a, b, c, d, e, f);
                g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
                shape = new Path2D();
                shape.addPath(paths[i], inv as unknown as DOMMatrix);
              } else {
                const [x1, y1, x2, y2] = grad.line!;
                g = ctx.createLinearGradient(x1, y1, x2, y2);
              }
              for (const [at, color] of grad.stops) g.addColorStop(Math.min(1, Math.max(0, at)), color);
              ctx.fillStyle = g;
              ctx.fill(shape, l.evenodd ? 'evenodd' : 'nonzero');
              ctx.restore();
            } else ctx.fill(shape, l.evenodd ? 'evenodd' : 'nonzero');
          }
          if (layer.stroke !== undefined) {
            ctx.strokeStyle = p.mono || !layer.stroke || layer.stroke === p.ink ? fill : layer.stroke;
            ctx.lineWidth = layer.strokeWidth ?? 1;
            ctx.lineCap = layer.strokeCap ?? 'butt';
            ctx.stroke(paths[i]);
          }
          ctx.restore();
        });
        ctx.restore();
      },
    };
  }
}

/** Measures a lockup whose total height is `heightPx`. */
function lockup(ctx: Ctx, m: Lockup, heightPx: number): Box {
  const natural = layout(ctx, m.parts, m.color, 100, m.gap ?? 0.25, 'row');
  const k = natural.h ? heightPx / natural.h : 1;
  return layout(ctx, m.parts, m.color, 100 * k, m.gap ?? 0.25, 'row');
}

/** Draws a lockup fitted inside `w` × `h` (px, centred on cx, cy), rotated by `rotate` degrees. */
function drawFitted(ctx: Ctx, m: Lockup, cx: number, cy: number, w: number, h: number, rotate: number, px = 1) {
  const sideways = rotate !== 0;
  const [bw, bh] = sideways ? [h, w] : [w, h];
  const probe = lockup(ctx, m, 100);
  if (!probe.w || !probe.h) return;
  // A frame takes a little room round the artwork.
  const pad = m.frame ? Math.min(bw, bh) * 0.08 : 0;
  const heightPx = Math.min(bh - 2 * pad, ((bw - 2 * pad) * probe.h) / probe.w);
  const box = lockup(ctx, m, heightPx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotate * Math.PI) / 180);
  if (m.frame) {
    const lw = Math.max(1, (m.frame.mm ?? 0.2) * px);
    ctx.strokeStyle = m.frame.color;
    ctx.lineWidth = lw;
    ctx.strokeRect(-box.w / 2 - pad, -box.h / 2 - pad, box.w + 2 * pad, box.h + 2 * pad);
  }
  box.draw(-box.w / 2, -box.h / 2);
  ctx.restore();
}

/** Draws a front mark with its height, alignment and inset; `depth` gives the header's depth where it lands. */
function drawFrontMark(ctx: Ctx, m: FrontMark, area: { x: number; w: number }, p: PanelRect, px: number, depth: (xMm: number) => number) {
  const H = p.heightMm * px;
  let box = lockup(ctx, m, m.h * H);
  const maxW = area.w * 0.9;
  if (box.w > maxW) box = lockup(ctx, m, (m.h * H * maxW) / box.w);
  const inset = (m.inset ?? 0.025) * p.widthMm * px;
  const x = (m.align === 'left' ? area.x + inset : m.align === 'right' ? area.x + area.w - inset - box.w : area.x + (area.w - box.w) / 2) + (m.dx ?? 0) * p.widthMm * px;
  const cy = m.cy !== undefined ? p.yMm * px + m.cy * H : p.yMm * px + (depth((x + box.w / 2) / px) * px) / 2;
  const y = cy - box.h / 2;
  if (m.plate) {
    const pad = box.h * 0.35;
    ctx.fillStyle = m.plate;
    ctx.fillRect(x - pad, y - pad, box.w + pad * 2, box.h + pad * 2);
  }
  box.draw(x, y);
}

/** Draws the header, spine caps and back logos. `px` is pixels per mm. */
export function drawOfficial(ctx: Ctx, t: TemplateConfig, px: number): void {
  const b = brandingFor(t.kind, t.variantId);
  ctx.save();
  const front = t.panels.find((p) => p.id === 'front');
  if (front) drawFront(ctx, t, front, b.front, px);
  const back = t.panels.find((p) => p.id === 'back');
  if (back && b.back) for (const m of b.back) drawFrontMark(ctx, m, { x: back.xMm * px, w: back.widthMm * px }, back, px, () => 0);
  if (b.spine) for (const p of t.panels) if (p.text) drawSpine(ctx, t, p, b.spine, px);
  ctx.restore();
}

function drawFront(ctx: Ctx, t: TemplateConfig, p: PanelRect, h: FrontHeader, px: number) {
  const area = paintRect(t, p);
  // Snapped outwards to whole pixels so the paint meets its neighbour with no hairline of the base colour between them.
  const [ax, ay] = [Math.floor(area.xMm * px), Math.floor(area.yMm * px)];
  const aw = Math.ceil((area.xMm + area.widthMm) * px) - ax;
  const [x0, y0, W, H] = [p.xMm * px, p.yMm * px, p.widthMm * px, p.heightMm * px];
  const panelBox = { x: x0, w: W };

  if (h.shape === 'band') {
    // The lower edge in px at a canvas x, clamped to the trim so the bleed carries the edge's end depth.
    const edge = (x: number) => y0 + h.depth(Math.min(1, Math.max(0, (x - x0) / W))) * H;
    const steps = 480;
    const xs = Array.from({ length: steps + 1 }, (_, i) => ax + (aw * i) / steps);
    const outline = (offset: number) => xs.map((x) => [x, edge(x) + offset] as const);
    const deepest = Math.max(...xs.map(edge));

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + aw, ay);
    for (const [x, y] of outline(0).reverse()) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = paint(ctx, h.fill, x0, ay, W, deepest - ay);
    ctx.fill();

    if (h.decor) {
      ctx.save();
      ctx.clip();
      drawDecor(ctx, h.decor, x0, y0, W, deepest - y0);
      ctx.restore();
    }

    if (h.line) {
      // Thickest in the middle and thinner towards both sides when tapered.
      const thick = (x: number) => {
        const u = Math.min(1, Math.max(0, (x - x0) / W));
        const edge = h.line!.taper ?? 1;
        return h.line!.size * H * (edge + (1 - edge) * (1 - (2 * u - 1) ** 2));
      };
      ctx.beginPath();
      outline(0).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (const [x, y] of xs.map((x) => [x, edge(x) + thick(x)] as const).reverse()) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = h.line.color;
      ctx.fill();
      if (h.line.shadow) {
        // A soft edge under the line (GameCube's bevel), drawn translucent.
        const sh = h.line.shadow.size * H;
        ctx.beginPath();
        xs.forEach((x, i) => (i ? ctx.lineTo(x, edge(x) + thick(x)) : ctx.moveTo(x, edge(x) + thick(x))));
        for (const x of [...xs].reverse()) ctx.lineTo(x, edge(x) + thick(x) + sh);
        ctx.closePath();
        ctx.fillStyle = h.line.shadow.color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const m of h.marks) drawFrontMark(ctx, m, panelBox, p, px, (xMm) => h.depth(Math.min(1, Math.max(0, (xMm - p.xMm) / p.widthMm))) * p.heightMm);
  } else if (h.shape === 'tab') {
    const tw = h.w * W;
    const bw = (h.wBottom ?? h.w) * W;
    const th = h.h * H;
    // The edges are measured at the trim; the paint runs on up into the bleed along the same slope.
    const lead = (y0 - ay) / th;
    const onward = (top: number, bottom: number) => (top + (top - bottom) * lead) * W;
    if (h.plate) {
      // A pale slanted plate continuing the tab to the right, outlined along its slanted edge and bottom.
      ctx.beginPath();
      ctx.moveTo(x0 + tw - 1, ay);
      ctx.lineTo(x0 + onward(h.plate.top, h.plate.bottom), ay);
      ctx.lineTo(x0 + h.plate.bottom * W, y0 + th);
      ctx.lineTo(x0 + bw - 1, y0 + th);
      ctx.closePath();
      ctx.fillStyle = h.plate.fill;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x0 + onward(h.plate.top, h.plate.bottom), ay);
      ctx.lineTo(x0 + h.plate.bottom * W, y0 + th);
      ctx.lineTo(x0 + bw, y0 + th);
      ctx.strokeStyle = h.plate.line;
      ctx.lineWidth = Math.max(1, px * 0.1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(x0 + onward(h.w, h.wBottom ?? h.w), ay);
    ctx.lineTo(x0 + bw, y0 + th);
    ctx.lineTo(ax, y0 + th);
    ctx.closePath();
    ctx.fillStyle = paint(ctx, h.fill, x0, ay, tw, th);
    ctx.fill();
    if (h.lip) {
      ctx.fillStyle = paint(ctx, h.fill, x0, ay, tw, th);
      ctx.fillRect(ax, ay, x0 + h.lip * W - ax, y0 - ay + 1);
    }
    const tabBox = { x: x0, w: bw };
    for (const m of h.marks) drawFrontMark(ctx, m, m.onPanel ? panelBox : tabBox, p, px, () => h.h * p.heightMm);
  } else if (h.shape === 'strip') {
    const sw = h.w * W;
    const [sy, sh] = [area.yMm * px, area.heightMm * px];
    ctx.fillStyle = paint(ctx, h.fill, ax, sy, x0 + sw - ax, sh);
    ctx.fillRect(ax, sy, x0 + sw - ax, sh);
    for (const m of h.marks) drawSpan(ctx, m, { x: x0, y: y0, across: sw, along: H }, 'vertical', px);
  } else {
    for (const m of h.marks) drawFrontMark(ctx, m, panelBox, p, px, () => 0);
  }
}

function drawDecor(ctx: Ctx, decor: 'xbox-orb' | 'x360-swoosh', x0: number, y0: number, W: number, depth: number) {
  if (decor === 'xbox-orb') {
    // Fine horizontal ridges fading in towards the orb, a dark ring, then the glossy green-to-yellow orb with its X,
    // cropped by the band's bottom and right trims.
    const [r, cx, cy] = [W * 0.125, x0 + W * 0.9, y0 + depth * 0.47];
    const ridge = ctx.createLinearGradient(x0 + W * 0.2, 0, x0 + W * 0.77, 0);
    ridge.addColorStop(0, 'rgba(255,255,255,0)');
    ridge.addColorStop(0.35, 'rgba(255,255,255,0.08)');
    ridge.addColorStop(1, 'rgba(255,255,255,0.15)');
    ctx.fillStyle = ridge;
    const pitch = depth * 0.052;
    for (let y = y0; y < y0 + depth; y += pitch) ctx.fillRect(x0 + W * 0.2, y, W * 0.57, pitch * 0.55);

    const ring = ctx.createLinearGradient(cx - r * 1.2, 0, cx - r * 0.8, 0);
    ring.addColorStop(0, '#1c1c1c');
    ring.addColorStop(1, '#030303');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.17, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(cx + r * 0.2, cy + r * 0.35, 0, cx + r * 0.2, cy + r * 0.35, r * 1.7);
    for (const [at, color] of [[0, '#f8f4a8'], [0.2, '#e6e75c'], [0.38, '#cdd514'], [0.58, '#96c008'], [0.76, '#4f9c06'], [1, '#1f5f05']] as const) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const x = part(ctx, { logo: 'xbox', crop: [0, 0, 0.339, 1] }, '#ffffff', W * 0.119, 0);
    ctx.save();
    ctx.globalAlpha = 0.6;
    x.draw(cx - x.w / 2, cy - x.h / 2);
    ctx.restore();
    return;
  }
  // The Xbox 360 swooshes, traced from the artwork: a fade from white, then bands painted left to right. The artwork is
  // as tall as the band and flush with the right trim, with its last colours carried on into the bleed.
  const k = depth / (X360_WAVES_SIZE.h - 1);
  const right = x0 + W;
  const sx = (x: number) => right - (X360_WAVES_SIZE.w - x) * k;
  const sy = (y: number) => y0 + y * k;
  const edgeAt = (pts: [number, number][], y: number) => {
    // Past the last point, keep to the last segment rather than wrapping round to the first.
    const j = pts.findIndex((p) => p[1] >= y);
    const i = j === -1 ? pts.length - 1 : Math.max(1, j);
    const [a, b] = [pts[i - 1], pts[i]];
    return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1);
  };
  const first = X360_WAVES[0];
  const [fr, fg, fb] = (first.stops[1][1].match(/[0-9a-f]{2}/g) ?? []).map((h) => parseInt(h, 16));
  const fade = W * 0.075;
  for (let y = 0; y < X360_WAVES_SIZE.h; y += 1) {
    const e = sx(edgeAt(first.left, y));
    const g = ctx.createLinearGradient(e - fade, 0, e, 0);
    g.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
    g.addColorStop(0.65, `rgba(${fr},${fg},${fb},0.12)`);
    g.addColorStop(1, `rgba(${fr},${fg},${fb},0.8)`);
    ctx.fillStyle = g;
    ctx.fillRect(e - fade, sy(y), fade + 1, k + 0.6);
  }
  // A green underlay, so the hairline between two neighbouring shapes shows green rather than the page.
  ctx.fillStyle = '#2f9b00';
  ctx.beginPath();
  first.left.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
  ctx.lineTo(right + W * 0.1, sy(X360_WAVES_SIZE.h - 1));
  ctx.lineTo(right + W * 0.1, sy(0));
  ctx.closePath();
  ctx.fill();
  const bleed = (x: number) => (x > X360_WAVES_SIZE.w ? right + W * 0.1 : sx(x));
  for (const band of X360_WAVES) {
    const [top, bottom] = [sy(band.left[0][1]), sy(band.left.at(-1)![1])];
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    for (const [at, color] of band.stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    band.left.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
    for (const [x, y] of [...band.right].reverse()) ctx.lineTo(bleed(x), sy(y));
    ctx.closePath();
    ctx.fill();
  }
}

/** A span mark along a spine-like strip; `frame` is in px, `across` the strip's width and `along` its length. */
function drawSpan(ctx: Ctx, m: SpanMark, frame: { x: number; y: number; across: number; along: number }, orientation: 'vertical' | 'horizontal', px: number) {
  const vertical = orientation === 'vertical';
  const start = m.from * frame.along;
  const len = (m.to - m.from) * frame.along;
  const shift = (m.dx ?? 0) * frame.across;
  const [cx, cy] = vertical ? [frame.x + frame.across / 2 + shift, frame.y + start + len / 2] : [frame.x + start + len / 2, frame.y + frame.across / 2 + shift];
  if (m.plate) {
    ctx.fillStyle = m.plate;
    const pw = frame.across * (m.plateAcross ?? 1);
    const off = (frame.across - pw) / 2;
    if (vertical) ctx.fillRect(frame.x + off, frame.y + start, pw, len);
    else ctx.fillRect(frame.x + start, frame.y + off, len, pw);
  }
  const room = frame.across * (m.across ?? 0.6);
  // On a horizontal spine the text already runs along it, so nothing turns.
  const rotate = vertical ? m.rotate : 0;
  const [w, h] = vertical ? [room, len] : [len, room];
  drawFitted(ctx, m, cx, cy, w, h, rotate, px);
}

function drawSpine(ctx: Ctx, t: TemplateConfig, p: PanelRect, s: SpineBranding, px: number) {
  const area = paintRect(t, p);
  const vertical = p.text === 'vertical';
  const [ax, ay] = [Math.floor(area.xMm * px), Math.floor(area.yMm * px)];
  const [aw, ah] = [Math.ceil((area.xMm + area.widthMm) * px) - ax, Math.ceil((area.yMm + area.heightMm) * px) - ay];
  const along = (vertical ? p.heightMm : p.widthMm) * px;
  const across = (vertical ? p.widthMm : p.heightMm) * px;
  const [x0, y0] = [p.xMm * px, p.yMm * px];

  if (s.fill) {
    ctx.fillStyle = paint(ctx, s.fill, ax, ay, aw, ah);
    ctx.fillRect(ax, ay, aw, ah);
  }
  if (s.cap) {
    const len = s.cap.length * along;
    const rect = vertical ? [ax, ay, aw, y0 + len - ay] : [ax, ay, x0 + len - ax, ah];
    ctx.fillStyle = paint(ctx, s.cap.fill, rect[0], rect[1], rect[2], rect[3]);
    if (s.cap.dome && vertical) {
      // The lower edge rises in the middle: a curve between the two ends of the edge.
      const rise = s.cap.dome * along;
      const [cx0, cy0, cw, ch] = rect;
      ctx.beginPath();
      ctx.moveTo(cx0, cy0);
      ctx.lineTo(cx0 + cw, cy0);
      ctx.lineTo(cx0 + cw, cy0 + ch);
      ctx.quadraticCurveTo(cx0 + cw / 2, cy0 + ch - 2 * rise, cx0, cy0 + ch);
      ctx.closePath();
      ctx.fill();
    } else ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
    if (s.cap.line) {
      const t2 = s.cap.line.size * along;
      ctx.fillStyle = s.cap.line.color;
      const gap = (s.cap.line.gap ?? 0) * along;
      if (vertical) ctx.fillRect(ax, y0 + len + gap, aw, t2);
      else ctx.fillRect(x0 + len + gap, ay, t2, ah);
    }
  }
  if (s.outline) {
    // Round the cap when there is one, otherwise round the whole spine.
    const lw = Math.max(1, s.outline.mm * px);
    const [ow, oh] = [p.widthMm * px, (s.cap && vertical ? s.cap.length * along : p.heightMm * px)];
    const rightFrom = (s.outline.rightFrom ?? 0) * along;
    ctx.fillStyle = s.outline.color;
    // Each side is snapped outwards to whole pixels, so it meets a line drawn by the neighbouring panel with no gap.
    const edge = (x: number, y: number, w: number, h: number) => {
      const [fx, fy] = [Math.floor(x), Math.floor(y)];
      ctx.fillRect(fx, fy, Math.ceil(x + w) - fx, Math.ceil(y + h) - fy);
    };
    if (s.outline.top !== false) edge(x0, y0, ow, lw);
    edge(x0, y0, lw, oh);
    edge(x0, y0 + oh - lw, ow, lw);
    if (s.outline.right !== false) edge(x0 + ow - lw, y0 + rightFrom, lw, oh - rightFrom);
  }
  for (const m of s.marks) drawSpan(ctx, m, { x: x0, y: y0, across, along }, vertical ? 'vertical' : 'horizontal', px);
}
