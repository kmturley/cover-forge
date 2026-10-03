import type { MediaItem } from '../types/media';
import type { SpineSettings } from '../types/editor';

export interface SpineBox {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** Titles longer than this are rare (catalogue titles average about 20 characters; roughly 45 covers all but a few). */
export const TYPICAL_LONG_TITLE_CHARS = 45;
/** Average width of a character of bold sans text, in em (mixed case with spaces). */
const AVG_CHAR_EM = 0.6;
const CAP_HEIGHT_EM = 0.72;
/** The largest automatic text height, used wherever a long title fits at this size. */
export const MAX_AUTO_CAP_MM = 4;
/** Automatic text never fills more than this share of the spine's thickness. */
const MAX_THICKNESS_SHARE = 0.4;
const SPINE_MARGIN_MM = 4;

/**
 * The default cap height for a spine: MAX_AUTO_CAP_MM, or smaller when the spine is too short to fit a long title on one
 * line at that size (a CD, cassette or NFC box), and never more than 40% of the spine's thickness so it doesn't crowd the edges.
 */
export function defaultCapHeightMm(
  box: SpineBox,
  orientation: 'vertical' | 'horizontal' = 'vertical',
  inset: { start: number; end: number } = { start: 0, end: 0 },
): number {
  const vertical = orientation === 'vertical';
  const runMm = (vertical ? box.heightMm : box.widthMm) - SPINE_MARGIN_MM * 2 - inset.start - inset.end;
  const thicknessMm = vertical ? box.widthMm : box.heightMm;
  const fit = runMm / ((TYPICAL_LONG_TITLE_CHARS * AVG_CHAR_EM) / CAP_HEIGHT_EM);
  return Math.floor(Math.max(1.5, Math.min(MAX_AUTO_CAP_MM, fit, thicknessMm * MAX_THICKNESS_SHARE)) * 10) / 10;
}

/** The template a design starts with when the user hasn't set one: "Artist · Title" for music, just the title for everything else — a game or movie spine naming the publisher isn't a convention, unlike a music spine naming the artist. */
export function defaultSpineTemplate(item: MediaItem): string {
  return item.type === 'music' ? '{creator} · {title}' : '{title}';
}

/** The variables spine text can use, with what each one is. */
export const SPINE_VARIABLES: { name: string; label: string }[] = [
  { name: 'title', label: 'Title' },
  { name: 'creator', label: 'Artist or developer' },
  { name: 'artist', label: 'Artist (music)' },
  { name: 'developer', label: 'Developer (games)' },
  { name: 'year', label: 'Year' },
  { name: 'subtitle', label: 'Subtitle as found (TV: network and genres)' },
];

function variables(item: MediaItem): Record<string, string> {
  const creator = item.type === 'music' || item.type === 'game' ? (item.subtitle ?? '') : '';
  return {
    title: item.title,
    creator,
    artist: item.type === 'music' ? creator : '',
    developer: item.type === 'game' ? creator : '',
    year: item.year ?? '',
    subtitle: item.subtitle ?? '',
  };
}

/** Text between variables that is only punctuation and spaces, e.g. " · " or " - ": dropped along with an empty variable. */
const SEPARATOR = /^[\s·•|/,:;–—-]*$/;

/**
 * Fills `{name}` variables from the item. An empty variable takes a separator with it, so "{artist} · {title}" is just
 * "Title" without an artist. Unknown variables are left as typed.
 */
export function fillSpineText(template: string, item: MediaItem): string {
  const vars = variables(item);
  const parts: { text: string; sep: boolean }[] = [];
  for (const [i, piece] of template.split(/\{(\w+)\}/).entries()) {
    if (i % 2 === 0) {
      if (piece) parts.push({ text: piece, sep: SEPARATOR.test(piece) });
    } else {
      // Own keys only: `{constructor}` must not find Object.prototype's.
      const value = Object.hasOwn(vars, piece) ? vars[piece] : `{${piece}}`;
      if (value) parts.push({ text: value, sep: false });
    }
  }
  // Separators only belong between two values: drop them at either end, and keep the first of any run.
  const kept = parts.filter((p, i) => !p.sep || (i > 0 && !parts[i - 1].sep && parts.slice(i + 1).some((q) => !q.sep)));
  return kept.map((p) => p.text).join('').trim();
}

/** The text on an item's spine: its own text if it has one, otherwise the design's, with the variables filled in. */
export function spineText(item: MediaItem, s: Pick<SpineSettings, 'text' | 'textTemplate'>): string {
  return fillSpineText(s.text ?? s.textTemplate ?? defaultSpineTemplate(item), item);
}

/**
 * Draws spine text rotated 90° clockwise (reads top-to-bottom, the Blu-ray/DVD convention),
 * shrinking the font until it fits the spine length with a margin. `textHeightMm` is the cap height. Geometry is in mm; `px` scales to pixels.
 */
export function drawSpineText(
  ctx: CanvasRenderingContext2D,
  box: SpineBox,
  text: string,
  s: SpineSettings,
  px: number,
  /** 'vertical' reads top-to-bottom (rotated 90° CW) along a tall spine; 'horizontal' runs along a wide, short one (J-card). */
  orientation: 'vertical' | 'horizontal' = 'vertical',
  /** Space a cap or mark takes at the start (top / left) and end of the spine. The text stays centred on the spine and shrinks to keep clear of it. */
  space: { start: number; end: number } = { start: 0, end: 0 },
  /** Scales the automatic size (not a size the user set). */
  scale = 1,
): void {
  if (!text) return;
  // Centred whatever sits at either end: the clearance is the larger of the two, applied to both sides.
  const clear = Math.max(space.start, space.end);
  const inset = { start: clear, end: clear };
  const marginMm = SPINE_MARGIN_MM;
  const vertical = orientation === 'vertical';
  const lengthMm = vertical ? box.heightMm : box.widthMm; // the direction the text runs
  const thicknessMm = vertical ? box.widthMm : box.heightMm; // the direction that limits glyph height
  const maxLengthPx = (lengthMm - marginMm * 2 - inset.start - inset.end) * px;
  // The size ignores the branding (a Branded spine's title is as big as an unbranded one); only a title too long to fit shrinks.
  // Cap height ≈ 0.72 em. Never let the glyphs fill more than 80% of the spine's thickness.
  const capHeightMm = Math.min(s.textHeightMm ?? defaultCapHeightMm(box, orientation) * scale, thicknessMm * 0.8);
  let sizePx = (capHeightMm * px) / CAP_HEIGHT_EM;

  ctx.save();
  ctx.fillStyle = s.color;
  ctx.textAlign = 'center';
  // The em box's middle sits below the capitals' middle, so a 'middle' baseline reads as off-centre across the spine;
  // draw on the alphabetic baseline and centre the capitals instead.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${sizePx}px ${s.fontFamily}`;
  const w = ctx.measureText(text).width;
  if (w > maxLengthPx) {
    sizePx = (sizePx * maxLengthPx) / w;
    ctx.font = `700 ${sizePx}px ${s.fontFamily}`;
  }
  const capPx = ctx.measureText('H').actualBoundingBoxAscent || sizePx * CAP_HEIGHT_EM;
  ctx.translate((box.xMm + box.widthMm / 2) * px, (box.yMm + box.heightMm / 2) * px);
  if (vertical) ctx.rotate(Math.PI / 2);
  if (s.rotationDeg) ctx.rotate((s.rotationDeg * Math.PI) / 180);
  ctx.fillText(text, 0, capPx / 2);
  ctx.restore();
}
