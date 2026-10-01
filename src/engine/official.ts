import type { PanelRect, TemplateConfig, TemplateKind } from '../types/template';
import { paintRect } from '../templates/geometry';
import { brandHeight, brandPath2D, brandWidth, getBrand } from '../brands';

/**
 * The "Branded" trade dress: each platform's front header, spine cap and marks, drawn as on retail covers. The values
 * follow branding-spec.md. Front sizes are fractions of the front panel (`W` wide, `H` tall); spine positions are
 * fractions of the spine's length `L`, and its marks' widths fractions of the spine's width `S`.
 */

/** A flat colour, or a gradient across the shape (`x`: left to right, `y`: top to bottom) as [offset, colour] stops. */
export type Paint = string | { x: [number, string][] } | { y: [number, string][] };

/** Simple drawn marks for brands Simple Icons doesn't carry. */
export type Icon = 'joycon' | 'xsphere' | 'cube' | 'windows';

/** One piece of a lockup. `h` is its height relative to the others (default 1); `color` overrides the lockup's. */
export type Part =
  | { brand: string; h?: number; color?: string }
  | { text: string; h?: number; color?: string; weight?: number; italic?: boolean; spacing?: number }
  | { icon: Icon; h?: number; color?: string; accent?: string }
  | { row: Part[] }
  | { stack: Part[] };

/** A logo made of parts laid side by side (a symbol followed by a wordmark). */
export interface Lockup {
  parts: Part[];
  color: string;
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
}

/** The lower edge of a band: its depth (fraction of H) at `x` (fraction of W from the left). */
export type Depth = (x: number) => number;

export const flat = (h: number): Depth => () => h;
/** Straight lines between [x, depth] points (GameCube's slope). */
export const slope = (points: [number, number][]): Depth => (x) => {
  const i = points.findIndex(([px]) => px >= x);
  if (i <= 0) return points[Math.max(i, 0)][1];
  const [x0, d0] = points[i - 1];
  const [x1, d1] = points[i];
  return d0 + ((d1 - d0) * (x - x0)) / (x1 - x0);
};
/** A single convex arc, `edge` deep at both sides and `centre` in the middle (Wii U). */
export const arc = (edge: number, centre: number): Depth => (x) => edge + (centre - edge) * (1 - (2 * x - 1) ** 2);
/** A curve deepening from `left` to `right`, slowly at first (Wii). */
export const ease = (left: number, right: number): Depth => (x) => left + (right - left) * x * x;

export type FrontHeader =
  /** Full width across the top. */
  | { shape: 'band'; depth: Depth; fill: Paint; line?: { color: string; size: number }; decor?: 'xbox-orb' | 'x360-swoosh'; marks: FrontMark[] }
  /** A block in the top-left corner, `w` × `h`; with `wBottom` its right edge is a diagonal. */
  | { shape: 'tab'; w: number; h: number; wBottom?: number; fill: Paint; marks: FrontMark[] }
  /** Full height down the left edge, `w` wide. Its marks run along it. */
  | { shape: 'strip'; w: number; fill: Paint; marks: SpanMark[] }
  | { shape: 'none'; marks: FrontMark[] };

export interface SpineBranding {
  /** Colours the whole spine (Switch red, Wii white). */
  fill?: Paint;
  /** A block at the top of the spine, `length` of L, closed by an optional line. */
  cap?: { length: number; fill: Paint; line?: { color: string; size: number } };
  marks: SpanMark[];
  /** Where the title may start (fraction of L). Default: just past the cap and the marks. */
  titleFrom?: number;
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
const NINTENDO_RED = '#e60012';
const XBOX_GREEN = '#107c10';

const PS4_BLUE: Paint = { x: [[0, '#003ca5'], [0.45, '#0162b8'], [0.85, '#1aa0e0'], [1, '#048fd2']] };
const X360_WHITE: Paint = { y: [[0, '#ffffff'], [1, '#d9dcde']] };
const GFW_WHITE: Paint = { y: [[0, '#f2f2f0'], [1, '#fbfbfb']] };

/** A format's small spine cap and back logo (DVD, CD, VHS…), which have no front header. */
function format(label: Part[], color: string, bg: string, cap: number): Branding {
  return {
    front: { shape: 'none', marks: [] },
    spine: cap ? { cap: { length: cap, fill: bg }, marks: [{ parts: label, color, from: 0.015, to: cap - 0.015, across: 0.7, rotate: 0 }] } : undefined,
    back: [{ parts: label, color, h: 0.035, align: 'left', inset: 0.05, cy: 0.94, plate: bg }],
  };
}

/** A plain band with a text label, for formats with no retail convention (floppy, NFC). */
function labelBand(text: string, bg: string, fg: string, h: number, cap: number): Branding {
  return {
    front: { shape: 'band', depth: flat(h), fill: bg, marks: [{ parts: [{ text, weight: 700 }], color: fg, h: h * 0.45, align: 'left', inset: 0.05 }] },
    spine: cap ? { cap: { length: cap, fill: bg }, marks: [{ parts: [{ text, weight: 700 }], color: fg, from: 0.015, to: cap - 0.015, rotate: 90 }] } : undefined,
  };
}

export const FORMAT_BRANDING: Record<TemplateKind, Branding> = {
  bluray: {
    front: { shape: 'band', depth: flat(0.08), fill: '#0a4da2', marks: [{ parts: [{ text: 'Blu-ray Disc', weight: 700 }], color: W, h: 0.035, align: 'center' }] },
    spine: { cap: { length: 0.1, fill: '#0a4da2' }, marks: [{ parts: [{ text: 'BD', weight: 800 }], color: W, from: 0.02, to: 0.08, across: 0.7, rotate: 0 }] },
  },
  dvd: format([{ stack: [{ text: 'DVD', weight: 800, h: 0.65 }, { text: 'VIDEO', weight: 600, h: 0.35, spacing: 0.15 }] }], W, '#141414', 0.08),
  vhs: format([{ text: 'VHS', weight: 800 }], '#ffd200', '#141414', 0.08),
  cd: format([{ stack: [{ text: 'COMPACT', weight: 700, h: 0.4, spacing: 0.1 }, { text: 'DISC', weight: 800, h: 0.6 }] }], W, '#141414', 0.1),
  cassette: format([{ text: 'TAPE', weight: 800 }], '#ffd200', '#141414', 0.16),
  vinyl: format([{ text: 'STEREO · 33⅓ RPM', weight: 700 }], '#f5e642', '#1a1a1a', 0),
  floppy: labelBand('FLOPPY', '#22252b', W, 0.086, 0),
  'nfc-card': labelBand('NFC', '#1a73e8', W, 0.082, 0),
  'nfc-sticker': labelBand('NFC', '#1a73e8', W, 0.1, 0),
  'nfc-box': labelBand('NFC', '#1a73e8', W, 0.078, 0.13),
  'game-case': labelBand('GAME', '#1a1a1a', W, 0.1, 0.12),
};

/** Per-platform branding for game cases, keyed by variant id. US releases, current era; see branding-spec.md. */
export const GAME_CASE_BRANDING: Record<string, Branding> = {
  // Games for Windows (2006–2013): a white bevelled band, the logo left and "PC DVD" right.
  pc: {
    front: {
      shape: 'band', depth: flat(0.11), fill: GFW_WHITE, line: { color: '#d0d0cc', size: 0.004 },
      marks: [
        { parts: [{ icon: 'windows' }, { stack: [{ text: 'Games', weight: 700, h: 0.55 }, { text: 'for Windows', weight: 400, h: 0.4 }] }], color: '#3c6fb4', h: 0.07, align: 'left', inset: 0.02, gap: 0.15 },
        { parts: [{ text: 'PC', weight: 300 }, { text: 'DVD', weight: 800 }], color: '#8a8a8a', h: 0.03, align: 'right', inset: 0.02, gap: 0.15 },
      ],
    },
  },
  // PS1 (jewel case): a black strip down the left, the PS symbol at its top and "PlayStation" reading upwards.
  ps1: {
    front: {
      shape: 'strip', w: 0.15, fill: K,
      marks: [
        { parts: [PS], color: W, from: 0.02, to: 0.14, across: 0.7, rotate: 0 },
        { parts: [{ text: 'PlayStation', weight: 500 }], color: W, from: 0.17, to: 0.78, across: 0.6, rotate: -90 },
      ],
    },
    spine: {
      fill: K,
      marks: [{ parts: [{ text: 'PlayStation®', weight: 500 }], color: W, from: 0.02, to: 0.17, rotate: 90 }],
      titleCase: 'upper',
    },
  },
  // PS2: a black band, the wordmark left and the PS symbol right; a black spine with the symbol on a white square.
  ps2: {
    front: {
      shape: 'band', depth: flat(0.09), fill: K,
      marks: [
        { parts: [{ text: 'PlayStation', weight: 500 }, { text: '2', weight: 700 }], color: W, h: 0.035, align: 'left', inset: 0.02, gap: 0.08 },
        { parts: [PS], color: W, h: 0.06, align: 'right', inset: 0.02 },
      ],
    },
    spine: {
      fill: K,
      marks: [
        { parts: [PS], color: K, plate: W, from: 0.006, to: 0.067, across: 0.75, rotate: 0 },
        { parts: [{ text: 'PlayStation', weight: 500 }, { text: '2', weight: 700 }], color: W, from: 0.075, to: 0.25, gap: 0.08, rotate: 90 },
      ],
    },
  },
  // PS3 (2009–2017): black fading to grey from 60% W, a crimson line, the logo left; a black spine cap with "PS3".
  ps3: {
    front: {
      shape: 'band', depth: flat(0.083), fill: { x: [[0, K], [0.6, K], [1, '#888888']] }, line: { color: '#8d1214', size: 0.004 },
      marks: [{ parts: [PS, { brand: 'playstation3', h: 0.55 }], color: W, h: 0.045, align: 'left', inset: 0.035 }],
    },
    spine: { cap: { length: 0.165, fill: K }, marks: [{ parts: [{ brand: 'playstation3' }], color: W, from: 0.02, to: 0.14, rotate: 90 }] },
  },
  // PS4: a blue gradient band with a white line; a blue spine cap to 23% L with the symbol, then "PS4".
  ps4: {
    front: {
      shape: 'band', depth: flat(0.103), fill: PS4_BLUE, line: { color: W, size: 0.006 },
      marks: [{ parts: [PS, { brand: 'playstation4', h: 0.55 }], color: W, h: 0.055, align: 'left', inset: 0.025 }],
    },
    spine: {
      cap: { length: 0.23, fill: '#0a5fb4', line: { color: W, size: 0.006 } },
      marks: [
        { parts: [PS], color: W, from: 0.02, to: 0.06, rotate: 0 },
        { parts: [{ brand: 'playstation4' }], color: W, from: 0.08, to: 0.21, rotate: 90 },
      ],
    },
  },
  // PS5: a white band with a navy line and a black logo; a white spine cap to 23% L.
  ps5: {
    front: {
      shape: 'band', depth: flat(0.111), fill: W, line: { color: '#1b3a70', size: 0.006 },
      marks: [{ parts: [PS, { brand: 'playstation5', h: 0.55 }], color: K, h: 0.055, align: 'left', inset: 0.025 }],
    },
    spine: {
      cap: { length: 0.23, fill: W },
      marks: [
        { parts: [PS], color: K, from: 0.03, to: 0.06, rotate: 0 },
        { parts: [{ brand: 'playstation5' }], color: K, from: 0.08, to: 0.19, rotate: 90 },
      ],
    },
  },
  // PS Vita: a blue gradient band with a white line; the spine laid out like PS4 (unverified).
  'ps-vita': {
    front: {
      shape: 'band', depth: flat(0.075), fill: { x: [[0, '#075daa'], [1, '#1b8dcc']] }, line: { color: W, size: 0.005 },
      marks: [{ parts: [PS, { brand: 'playstationvita', h: 0.45 }], color: W, h: 0.04, align: 'left', inset: 0.02 }],
    },
    spine: {
      cap: { length: 0.2, fill: '#075daa' },
      marks: [
        { parts: [PS], color: W, from: 0.02, to: 0.06, rotate: 0 },
        { parts: [{ brand: 'playstationvita' }], color: W, from: 0.08, to: 0.18, rotate: 90 },
      ],
    },
  },
  // Switch: a red tab in the top-left corner with the Joy-Con icon over "NINTENDO SWITCH"; a red spine.
  switch: {
    front: {
      shape: 'tab', w: 0.224, h: 0.13, fill: NINTENDO_RED,
      marks: [{ parts: [{ stack: [{ icon: 'joycon', h: 0.55, accent: NINTENDO_RED }, { text: 'NINTENDO', weight: 500, h: 0.13, spacing: 0.25 }, { text: 'SWITCH', weight: 800, h: 0.2 }] }], color: W, h: 0.095, align: 'center', gap: 0.08 }],
    },
    spine: { fill: NINTENDO_RED, marks: [{ parts: [{ icon: 'joycon', accent: NINTENDO_RED }], color: W, from: 0.02, to: 0.045, rotate: 0 }], titleFrom: 0.08 },
  },
  // Switch 2: a full-width red band, the icon and "2" over "NINTENDO SWITCH", centred; a red spine.
  switch2: {
    front: {
      shape: 'band', depth: flat(0.129), fill: NINTENDO_RED,
      marks: [{ parts: [{ stack: [{ row: [{ icon: 'joycon', accent: NINTENDO_RED }, { text: '2', weight: 800, h: 0.8 }] }, { text: 'NINTENDO SWITCH', weight: 700, h: 0.3, spacing: 0.1 }] }], color: W, h: 0.09, align: 'center', gap: 0.15 }],
    },
    spine: { fill: NINTENDO_RED, marks: [{ parts: [{ stack: [{ icon: 'joycon', accent: NINTENDO_RED }, { text: '2', weight: 800, h: 0.7 }] }], color: W, from: 0.015, to: 0.09, across: 0.7, rotate: 0 }], titleFrom: 0.12 },
  },
  // Wii U: a cyan band with a convex lower edge and a yellow-green line, "Wii U" centred; a white spine.
  'wii-u': {
    front: {
      shape: 'band', depth: arc(0.035, 0.095), fill: '#009ac7', line: { color: '#e7f237', size: 0.005 },
      marks: [{ parts: [{ text: 'Wii U', weight: 700 }], color: W, h: 0.035, align: 'center', cy: 0.035 }],
    },
    spine: {
      fill: W,
      titleColor: '#333333',
      marks: [{ parts: [{ text: 'Wii', weight: 700, color: '#8c8c8c' }, { text: 'U', weight: 700, color: '#009ac7' }], color: '#8c8c8c', from: 0.03, to: 0.15, gap: 0.12, rotate: 90 }],
    },
  },
  // Wii: a white header deepening to the right along a curve, a grey line, "Wii" right; a white spine.
  wii: {
    front: {
      shape: 'band', depth: ease(0.017, 0.122), fill: W, line: { color: '#a5a5a6', size: 0.005 },
      marks: [{ parts: [{ text: 'Wii', weight: 700 }], color: '#8c8c8c', h: 0.05, align: 'right', inset: 0.03 }],
    },
    spine: { fill: W, titleColor: '#333333', marks: [{ parts: [{ text: 'Wii', weight: 700 }], color: '#8c8c8c', from: 0.03, to: 0.12, rotate: 90 }] },
  },
  // GameCube: a black band sloping up at the right with a white line, the cube and wordmark centred; a black spine cap.
  gamecube: {
    front: {
      shape: 'band', depth: slope([[0, 0.112], [0.55, 0.112], [1, 0.072]]), fill: K, line: { color: W, size: 0.005 },
      marks: [{ parts: [{ icon: 'cube', color: '#6b63b5' }, { stack: [{ text: 'NINTENDO', weight: 500, h: 0.3, spacing: 0.3 }, { text: 'GAMECUBE', weight: 800, h: 0.55 }] }], color: W, h: 0.06, align: 'center', gap: 0.2 }],
    },
    spine: {
      cap: { length: 0.175, fill: K },
      marks: [
        { parts: [{ icon: 'cube', color: '#6b63b5' }], color: W, from: 0.05, to: 0.09, rotate: 0 },
        { parts: [{ text: 'NINTENDO GAMECUBE', weight: 700 }], color: W, from: 0.1, to: 0.165, across: 0.45, rotate: 90 },
      ],
    },
  },
  // Xbox: a black band, the X and "XBOX" in green left of centre, a glowing orb top-right; a black spine cap.
  xbox: {
    front: {
      shape: 'band', depth: flat(0.1), fill: K, decor: 'xbox-orb',
      marks: [{ parts: [{ icon: 'xsphere', accent: K }, { text: 'XBOX', weight: 800 }], color: '#9bc848', h: 0.05, align: 'left', inset: 0.08 }],
    },
    spine: {
      cap: { length: 0.17, fill: K },
      marks: [
        { parts: [{ icon: 'xsphere', accent: K }], color: '#9bc848', from: 0.045, to: 0.07, rotate: 0 },
        { parts: [{ text: 'XBOX', weight: 800 }], color: '#9bc848', from: 0.08, to: 0.16, rotate: 90 },
      ],
    },
  },
  // Xbox 360: a white band with green swooshes on the right third, the logo left; a white spine cap.
  'xbox-360': {
    front: {
      shape: 'band', depth: flat(0.121), fill: X360_WHITE, decor: 'x360-swoosh',
      marks: [{ parts: [{ icon: 'xsphere', color: '#b8bcbf', accent: '#52a43a' }, { text: 'XBOX', weight: 800, h: 0.6, color: '#52a43a' }, { text: '360', weight: 400, h: 0.6, color: '#8a8d8f' }], color: '#52a43a', h: 0.07, align: 'left', inset: 0.05, gap: 0.12 }],
    },
    spine: {
      cap: { length: 0.25, fill: X360_WHITE },
      marks: [
        { parts: [{ icon: 'xsphere', color: '#b8bcbf', accent: '#52a43a' }], color: '#52a43a', from: 0.025, to: 0.065, rotate: 0 },
        { parts: [{ text: 'XBOX', weight: 800, color: '#52a43a' }, { text: '360', weight: 400, color: '#8a8d8f' }], color: '#52a43a', from: 0.08, to: 0.23, gap: 0.12, rotate: 90 },
      ],
    },
  },
  // Xbox One: a flat green band with the sphere and "XBOX ONE" centred; a black spine.
  'xbox-one': {
    front: {
      shape: 'band', depth: flat(0.08), fill: XBOX_GREEN,
      marks: [{ parts: [{ icon: 'xsphere', accent: XBOX_GREEN }, { text: 'XBOX ONE', weight: 700, h: 0.75 }], color: W, h: 0.035, align: 'center' }],
    },
    spine: {
      fill: K,
      marks: [
        { parts: [{ icon: 'xsphere', accent: K }], color: W, from: 0.024, to: 0.064, rotate: 0 },
        { parts: [{ text: 'XBOX ONE', weight: 700 }], color: W, from: 0.07, to: 0.2, rotate: 90 },
      ],
    },
  },
  // Xbox Series X|S (2024 on): a green block over the spine's top and the front's top-left corner with a diagonal edge,
  // "XBOX SERIES X" top right on the artwork; a black spine.
  'xbox-series': {
    front: {
      shape: 'tab', w: 0.17, wBottom: 0.1, h: 0.088, fill: '#4daa14',
      marks: [
        { parts: [{ icon: 'xsphere', accent: '#4daa14' }], color: W, h: 0.06, align: 'left', inset: 0.025 },
        { parts: [{ text: 'XBOX SERIES X', weight: 800 }], color: K, h: 0.02, align: 'right', inset: 0.03, cy: 0.035, onPanel: true },
      ],
    },
    spine: {
      fill: K,
      cap: { length: 0.088, fill: '#4daa14' },
      marks: [
        { parts: [{ icon: 'xsphere', accent: K }], color: W, from: 0.11, to: 0.14, rotate: 0 },
        { parts: [{ text: 'XBOX', weight: 800 }], color: W, from: 0.15, to: 0.22, rotate: 90 },
      ],
    },
  },
};

/** The branding for a template: its platform's for game cases, else its format's. */
export function brandingFor(kind: TemplateKind, variantId: string): Branding {
  return kind === 'game-case' ? (GAME_CASE_BRANDING[variantId] ?? FORMAT_BRANDING['game-case']) : FORMAT_BRANDING[kind];
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

const ICON_ASPECT: Record<Icon, number> = { joycon: 0.85, xsphere: 1, cube: 1, windows: 1.05 };

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
  const w = h * ICON_ASPECT[p.icon];
  return { w, h, draw: (x, y) => drawIcon(ctx, p.icon, x, y, w, h, fill, p.accent) };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawIcon(ctx: Ctx, icon: Icon, x: number, y: number, w: number, h: number, color: string, accent = '#000000') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (icon === 'joycon') {
    // Two Joy-Con halves: the left outlined with a stick, the right solid with four face buttons.
    const half = w * 0.47;
    const line = w * 0.09;
    ctx.lineWidth = line;
    roundRect(ctx, x + line / 2, y + line / 2, half - line, h - line, [half / 2, 0, 0, half / 2]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + half / 2, y + h * 0.28, half * 0.19, 0, Math.PI * 2);
    ctx.fill();
    roundRect(ctx, x + w - half, y, half, h, [0, half / 2, half / 2, 0]);
    ctx.fill();
    // The four face buttons (ABXY layout) are holes showing the background behind the icon.
    ctx.fillStyle = accent;
    const bx = x + w - half / 2;
    const by = y + h * 0.62;
    const spread = half * 0.19;
    const dotR = half * 0.085;
    ([[0, -spread], [0, spread], [-spread, 0], [spread, 0]] as [number, number][]).forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(bx + dx, by + dy, dotR, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (icon === 'xsphere') {
    // A sphere with a soft diagonal swoosh across its upper half.
    const r = h / 2;
    ctx.beginPath();
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = r * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.15, y + r * 1.15);
    ctx.quadraticCurveTo(x + r * 1.0, y + r * 0.25, x + r * 1.9, y + r * 0.85);
    ctx.stroke();
    ctx.restore();
  } else if (icon === 'cube') {
    // An isometric cube: three faces of one colour at different strengths, with a faint seam between them.
    const cx = x + w / 2;
    const s = h / 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, h * 0.012);
    const face = (pts: [number, number][], alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    const dx = s * 0.87;
    face([[cx, y], [cx + dx, y + s / 2], [cx, y + s], [cx - dx, y + s / 2]], 1);
    face([[cx - dx, y + s / 2], [cx, y + s], [cx, y + h], [cx - dx, y + h - s / 2]], 0.75);
    face([[cx + dx, y + s / 2], [cx, y + s], [cx, y + h], [cx + dx, y + h - s / 2]], 0.55);
  } else {
    // The four-colour Windows flag, panes slightly rounded.
    const g = w * 0.07;
    const q = (w - g) / 2;
    const qh = (h - g) / 2;
    const rad = w * 0.015;
    [['#f25022', 0, 0], ['#7fba00', 1, 0], ['#00a4ef', 0, 1], ['#ffb900', 1, 1]].forEach(([c, i, j]) => {
      ctx.fillStyle = c as string;
      roundRect(ctx, x + (i as number) * (q + g), y + (j as number) * (qh + g), q, qh, [rad]);
      ctx.fill();
    });
  }
  ctx.restore();
}

/** Measures a lockup whose total height is `heightPx`. */
function lockup(ctx: Ctx, m: Lockup, heightPx: number): Box {
  const natural = layout(ctx, m.parts, m.color, 100, m.gap ?? 0.25, 'row');
  const k = natural.h ? heightPx / natural.h : 1;
  return layout(ctx, m.parts, m.color, 100 * k, m.gap ?? 0.25, 'row');
}

/** Draws a lockup fitted inside `w` × `h` (px, centred on cx, cy), rotated by `rotate` degrees. */
function drawFitted(ctx: Ctx, m: Lockup, cx: number, cy: number, w: number, h: number, rotate: number) {
  const sideways = rotate !== 0;
  const [bw, bh] = sideways ? [h, w] : [w, h];
  const probe = lockup(ctx, m, 100);
  if (!probe.w || !probe.h) return;
  const heightPx = Math.min(bh, (bw * probe.h) / probe.w);
  const box = lockup(ctx, m, heightPx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotate * Math.PI) / 180);
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
  const x = m.align === 'left' ? area.x + inset : m.align === 'right' ? area.x + area.w - inset - box.w : area.x + (area.w - box.w) / 2;
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
  const [ax, ay, aw] = [area.xMm * px, area.yMm * px, area.widthMm * px];
  const [x0, y0, W, H] = [p.xMm * px, p.yMm * px, p.widthMm * px, p.heightMm * px];
  const panelBox = { x: x0, w: W };

  if (h.shape === 'band') {
    // The lower edge in px at a canvas x, clamped to the trim so the bleed carries the edge's end depth.
    const edge = (x: number) => y0 + h.depth(Math.min(1, Math.max(0, (x - x0) / W))) * H;
    const steps = 64;
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
      const t2 = h.line.size * H;
      ctx.beginPath();
      outline(0).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (const [x, y] of outline(t2).reverse()) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = h.line.color;
      ctx.fill();
    }
    for (const m of h.marks) drawFrontMark(ctx, m, panelBox, p, px, (xMm) => h.depth(Math.min(1, Math.max(0, (xMm - p.xMm) / p.widthMm))) * p.heightMm);
  } else if (h.shape === 'tab') {
    const tw = h.w * W;
    const bw = (h.wBottom ?? h.w) * W;
    const th = h.h * H;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(x0 + tw, ay);
    ctx.lineTo(x0 + bw, y0 + th);
    ctx.lineTo(ax, y0 + th);
    ctx.closePath();
    ctx.fillStyle = paint(ctx, h.fill, x0, ay, tw, th);
    ctx.fill();
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
    // A glowing green orb with an X, cropped by the top and right trims.
    const r = W * 0.14;
    const cx = x0 + W - r * 0.55;
    const cy = y0 + depth * 0.35;
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#d8f59a');
    g.addColorStop(0.45, '#7cc242');
    g.addColorStop(1, '#1e5c12');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, 'xsphere', cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, 'rgba(0,0,0,0)', '#0f3b0a');
    return;
  }
  // Green ribbons sweeping through the band's right third.
  const ribbons: [string, number, number][] = [['#d3e753', 0.05, 0.5], ['#8ec645', 0.35, 0.75], ['#46a82d', 0.6, 1.05]];
  for (const [color, a, b] of ribbons) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0 + W * 0.67, y0 + depth);
    ctx.bezierCurveTo(x0 + W * 0.8, y0 + depth * a, x0 + W * 0.9, y0 + depth * (a - 0.2), x0 + W * 1.02, y0 + depth * (a - 0.3));
    ctx.lineTo(x0 + W * 1.02, y0 + depth * (b - 0.3));
    ctx.bezierCurveTo(x0 + W * 0.9, y0 + depth * b, x0 + W * 0.82, y0 + depth * (b + 0.2), x0 + W * 0.72, y0 + depth);
    ctx.closePath();
    ctx.fill();
  }
}

/** A span mark along a spine-like strip; `frame` is in px, `across` the strip's width and `along` its length. */
function drawSpan(ctx: Ctx, m: SpanMark, frame: { x: number; y: number; across: number; along: number }, orientation: 'vertical' | 'horizontal', px: number) {
  void px;
  const vertical = orientation === 'vertical';
  const start = m.from * frame.along;
  const len = (m.to - m.from) * frame.along;
  const [cx, cy] = vertical ? [frame.x + frame.across / 2, frame.y + start + len / 2] : [frame.x + start + len / 2, frame.y + frame.across / 2];
  if (m.plate) {
    ctx.fillStyle = m.plate;
    if (vertical) ctx.fillRect(frame.x, frame.y + start, frame.across, len);
    else ctx.fillRect(frame.x + start, frame.y, len, frame.across);
  }
  const room = frame.across * (m.across ?? 0.6);
  // On a horizontal spine the text already runs along it, so nothing turns.
  const rotate = vertical ? m.rotate : 0;
  const [w, h] = vertical ? [room, len] : [len, room];
  drawFitted(ctx, m, cx, cy, w, h, rotate);
}

function drawSpine(ctx: Ctx, t: TemplateConfig, p: PanelRect, s: SpineBranding, px: number) {
  const area = paintRect(t, p);
  const vertical = p.text === 'vertical';
  const [ax, ay, aw, ah] = [area.xMm * px, area.yMm * px, area.widthMm * px, area.heightMm * px];
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
    ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
    if (s.cap.line) {
      const t2 = s.cap.line.size * along;
      ctx.fillStyle = s.cap.line.color;
      if (vertical) ctx.fillRect(ax, y0 + len, aw, t2);
      else ctx.fillRect(x0 + len, ay, t2, ah);
    }
  }
  for (const m of s.marks) drawSpan(ctx, m, { x: x0, y: y0, across, along }, vertical ? 'vertical' : 'horizontal', px);
}
