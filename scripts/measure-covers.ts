/**
 * Measures printed cover wraps and aggregates the results by folder name.
 *
 * Assumes each image is a single, pre-cropped full wrap laid out left to right as
 * back | spine | front, with no background border beyond the trim edge (the image's
 * own edges ARE the trim edges) — except CD/PS1/Dreamcast jewel cases, which are
 * spine | back | spine | front (see JEWEL_CASE_GROUPS below). Point it at a directory
 * of subfolders, one per platform/case ("scans/ps4/*.jpg", "scans/ps5/*.jpg", ...) and
 * it aggregates by subfolder name.
 *
 * Usage:
 *   node scripts/measure-covers.ts                                  # scans ./scans, writes scans-report.md
 *   node scripts/measure-covers.ts scans --out case-scan-report.md --branding-out branding-spec.md
 *   node scripts/measure-covers.ts "scans/**\/*.jpg" --out case-scan-report.md
 *
 * A `template.png` inside a folder is treated as a FAN-MADE TEMPLATE, not a scan (see measureTemplate): a
 * mostly-transparent PNG holding only the branding (header strip, spine strip, back/spine logos). It is
 * measured from its alpha channel with the same header-band/colour code the scans use, reported alongside
 * that folder's scans as one more row, so the folder's single summary row (mode, else median) covers both.
 *
 * Source defaults to `./scans`, `--out` to `scans-report.md`. The same run also measures what is printed on the
 * front header and spine (mark positions, sizes, colours, the line under the header, spine caps) and writes it,
 * one column per attribute, to `--branding-out` (default `branding-spec.md`), replacing that file entirely.
 * Scans whose embedded DPI isn't exactly 300 are rejected outright and left out of the
 * report entirely (noted on stderr instead), since a print-shop scan should always be
 * saved at 300 DPI and anything else is a strong signal the file isn't one (a web image,
 * a phone photo, a re-save that dropped/rewrote the metadata).
 *
 * What's deterministic here vs. a first pass, honestly:
 *   - Pixel size and mm conversion (via embedded DPI): deterministic, but only as
 *     good as the file's DPI metadata — files that aren't exactly 300 DPI are rejected
 *     rather than trusted.
 *   - Fold line (back|spine, spine|front) detection: a real edge-detection pass
 *     (vertical gradient profile + symmetry check), not a guess, but it can fail
 *     on busy artwork; failures are reported per file, not silently papered over.
 *   - Front header band height/colour: only detects FLAT bands (a single colour
 *     with one transition row), the most common case. Sloped or curved headers
 *     (Wii, GameCube, Wii U) will misdetect or report low confidence — noted in
 *     the output, not silently treated as correct.
 */
import { existsSync, globSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp']);
const MM_PER_INCH = 25.4;
const DEFAULT_SOURCE = './scans';
const DEFAULT_OUT = 'scans-report.md';
const DEFAULT_BRANDING_OUT = 'branding-spec.md';
/** Where scripts/compare-covers.ts writes `<platform>/app.png` (and its fold positions), if it has been run. */
const DEFAULT_APP_DIR = 'compare';
/** Print-ready covers are supplied at 300 DPI; anything else (72/96 dpi web images, a phone photo, metadata
 * lost on a re-save) is rejected rather than trusted. */
const REQUIRED_DPI = 300;
/** A spine between these fractions of the total width is plausible for every case format in this project
 * (from a 3 mm cassette spine to a 25 mm VHS box, roughly 0.5%-20% of a typical wrap width). */
const SPINE_FRACTION_RANGE: [number, number] = [0.005, 0.2];
/** Front and back panels are the same width on every case researched so far (case-research.md); reject a
 * fold-line pair whose two side widths disagree by more than this fraction of their average. */
const SYMMETRY_TOLERANCE = 0.08;

/**
 * Fallback spine widths (mm), keyed by the folder name you use for each case, from case-research.md's
 * already-researched values (see definitions.ts). Flat, pre-print cover files have no physical fold crease
 * to detect — edge/variance detection on them tends to lock onto ordinary art content instead (a photo
 * inset, a plain-colour background) rather than failing safely. When generic detection doesn't find a
 * plausible, symmetric pair, this is used as a calibration prior instead: assume front and back panels are
 * equal width (true for every case in case-research.md) and place the spine using its known width. This is
 * an ESTIMATE, not a measurement, and is always labelled as such in the report.
 */
const KNOWN_SPINE_MM: Record<string, number> = {
  pc: 14,
  ps2: 14,
  ps3: 14,
  ps4: 14,
  ps5: 14,
  'ps-vita': 9,
  psvita: 9,
  switch: 10,
  switch2: 10,
  wii: 14,
  'wii-u': 14,
  wiiu: 14,
  gamecube: 14,
  xbox: 14,
  'xbox-360': 14,
  xbox360: 14,
  'xbox-one': 11,
  xboxone: 11,
  'xbox-series': 11,
  xboxseries: 11,
  dvd: 14,
  'dvd-slim': 7,
  dvdslim: 7,
  bluray: 11,
  'blu-ray': 11,
};

/**
 * CD/PS1/Dreamcast jewel cases are the one shape in this project where a source file can't be treated
 * as back | spine | front: the tray card's two spine flaps and the (physically separate) front cover are
 * commonly supplied side by side in a single file, left to right as spine | back | spine | front — see
 * case-research.md's CD jewel case section and `jewelCase()` in src/templates/definitions.ts, both of
 * which record the tray card as [spine | back | spine] with the front as its own piece. `spine` is the
 * app's own 6.5 mm tray-card flap width; `spine2` uses the case's ~10 mm shelf spine (Wikipedia, already
 * used for this case's exterior depth in case-research.md) rather than repeating `spine`, because every
 * real scan tested so far draws the flap nearest the front noticeably wider than the one nearest the back.
 */
const JEWEL_CASE_GROUPS = new Set(['cd', 'ps1', 'dreamcast']);
const JEWEL_CASE_MM = { spine: 6.5, spine2: 10, back: 137, front: 120 };

/** Fan-made templates are named this (any extension) inside a platform folder. */
const TEMPLATE_BASENAME = 'template';
/** A wrap's width in every case researched so far falls in this range (mm); a template outside it has
 * broken DPI metadata (seen: a 72-DPI-tagged file, a 10752 px wide file tagged 300). */
const PLAUSIBLE_WRAP_WIDTH_MM: [number, number] = [180, 330];
/** Alpha above this counts as "printed" when reading a template's layout. */
const ALPHA_OPAQUE = 128;
/** The colour transparent template pixels are flattened onto, so the scan header-band code sees a hard edge
 * where the branding ends. */
const TEMPLATE_FLATTEN_RGB: [number, number, number] = [255, 0, 255];

type DpiConfidence = 'ok' | 'wrong' | 'missing';

interface ImageResult {
  file: string;
  /** 'template' = fan-made transparent template, measured from its alpha channel. 'app' = the app's own render of
   * this case (scripts/compare-covers.ts), measured with its fold positions known; it is reported beside the folder's
   * Mode row and never counted in it. */
  kind: 'scan' | 'template' | 'app';
  widthPx: number;
  heightPx: number;
  dpi: number | null;
  dpiConfidence: DpiConfidence;
  widthMm: number | null;
  heightMm: number | null;
  backMm: number | null;
  spineMm: number | null;
  frontMm: number | null;
  /** The second spine flap, jewel cases only (see JEWEL_CASE_GROUPS) — null for every other case shape. */
  spine2Mm: number | null;
  /** 'detected' from the image itself, 'estimated' from a known spine width, or 'none' (neither worked). */
  spineSource: 'detected' | 'estimated' | 'known' | 'none';
  bandHeightPct: number | null;
  bandShape: 'flat' | 'gradient' | 'none';
  bandColorHex: string | null;
  bandEndColorHex: string | null;
  spineCapPct: number | null;
  /** Header/spine branding, or null when the wrap's layout couldn't be located. */
  branding: Branding | null;
  notes: string[];
}

interface RawImage {
  width: number;
  height: number;
  channels: number;
  data: Buffer;
}

function findImages(source: string): string[] {
  const isDir = (() => {
    try {
      return statSync(source).isDirectory();
    } catch {
      return false;
    }
  })();
  const pattern = isDir ? join(source, '*/*') : source;
  return globSync(pattern)
    .filter((f) => IMAGE_EXTS.has(('.' + f.split('.').pop()!).toLowerCase()))
    .sort();
}

/** Name of an embedded ICC profile (its `desc` tag), or null when the image carries none. */
function iccProfileName(icc: Buffer | undefined): string | null {
  if (!icc || icc.length < 132) return null;
  const count = icc.readUInt32BE(128);
  for (let i = 0; i < count; i++) {
    if (icc.toString('ascii', 132 + i * 12, 136 + i * 12) !== 'desc') continue;
    const offset = icc.readUInt32BE(136 + i * 12);
    const type = icc.toString('ascii', offset, offset + 4);
    if (type === 'desc') return icc.toString('ascii', offset + 12, offset + 12 + icc.readUInt32BE(offset + 8) - 1);
    if (type === 'mluc') {
      const length = icc.readUInt32BE(offset + 20);
      const start = offset + icc.readUInt32BE(offset + 24);
      return Buffer.from(icc.subarray(start, start + length)).swap16().toString('utf16le');
    }
  }
  return 'unnamed profile';
}

/**
 * Every colour this script reports is sRGB. sharp converts an embedded ICC profile to sRGB when it decodes the
 * pixels (checked: the same Adobe RGB scan reads 33,48,80 normally and 42,51,80 with the profile ignored), so a
 * wide-gamut scan is converted, not trusted as-is. An image with no profile is assumed to already be sRGB, which
 * cannot be verified. Returns a note for the report when a conversion happened, else null.
 */
function colourProfileNote(icc: Buffer | undefined): string | null {
  const name = iccProfileName(icc);
  if (!name || /^srgb/i.test(name)) return null;
  return `Colour profile ${name} converted to sRGB.`;
}

function dpiConfidence(density: number | undefined): { dpi: number | null; confidence: DpiConfidence } {
  if (!density) return { dpi: null, confidence: 'missing' };
  return { dpi: density, confidence: Math.round(density) === REQUIRED_DPI ? 'ok' : 'wrong' };
}

/** Grayscale luminance, one value per pixel, row-major. */
function toGray(img: RawImage): Float32Array {
  const { width, height, channels, data } = img;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    gray[i] = (data[o] + data[o + 1] + data[o + 2]) / 3;
  }
  return gray;
}

/** Per-column vertical-edge strength: mean absolute horizontal gradient down each column. A real fold
 * line shows up as a column-spanning seam even where local artwork is busy, because it's consistent for
 * the image's full height; scattered artwork edges are not. */
function verticalSeamProfile(gray: Float32Array, width: number, height: number): Float64Array {
  const profile = new Float64Array(width);
  for (let x = 1; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < height; y++) {
      sum += Math.abs(gray[y * width + x] - gray[y * width + x - 1]);
    }
    profile[x] = sum / height;
  }
  return profile;
}

function smooth(a: Float64Array, window = 5): Float64Array {
  const out = new Float64Array(a.length);
  const half = Math.floor(window / 2);
  for (let i = 0; i < a.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(a.length - 1, i + half); j++) {
      sum += a[j];
      n++;
    }
    out[i] = sum / n;
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The strongest column in each run of adjacent above-threshold columns of a (smoothed) vertical-edge
 * profile — one real seam can span a couple of px, so this collapses each such run to its single peak. */
function findPeaks(profile: Float64Array, width: number): number[] {
  const margin = Math.max(2, Math.floor(width * 0.01));
  for (let i = 0; i < margin; i++) profile[i] = 0;
  for (let i = width - margin; i < width; i++) profile[i] = 0;

  const values = Array.from(profile);
  const baseline = median(values);
  const mad = median(values.map((v) => Math.abs(v - baseline))) || 1;
  const threshold = baseline + 4 * mad;

  const candidates: number[] = [];
  for (let i = 0; i < profile.length; i++) if (profile[i] > threshold) candidates.push(i);
  if (!candidates.length) return [];

  const peaks: number[] = [];
  let run = [candidates[0]];
  for (const c of candidates.slice(1)) {
    if (c - run[run.length - 1] <= 3) {
      run.push(c);
    } else {
      peaks.push(run.reduce((best, i) => (profile[i] > profile[best] ? i : best)));
      run = [c];
    }
  }
  peaks.push(run.reduce((best, i) => (profile[i] > profile[best] ? i : best)));
  return peaks;
}

/** Finds the back|spine and spine|front seams. Returns [x1, x2] in pixels, or null. */
function findFoldLines(gray: Float32Array, width: number, height: number): [number, number] | null {
  const profile = smooth(verticalSeamProfile(gray, width, height));
  const peaks = findPeaks(profile, width);
  if (!peaks.length) return null;

  const [lo, hi] = SPINE_FRACTION_RANGE;
  let best: [number, number] | null = null;
  let bestScore = -1;
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const x1 = peaks[i];
      const x2 = peaks[j];
      const spine = x2 - x1;
      if (spine < lo * width || spine > hi * width) continue;
      const back = x1;
      const front = width - x2;
      if (back === 0 || front === 0) continue;
      if (Math.abs(back - front) / ((back + front) / 2) > SYMMETRY_TOLERANCE) continue;
      const score = profile[x1] + profile[x2];
      if (score > bestScore) {
        bestScore = score;
        best = [x1, x2];
      }
    }
  }
  return best;
}

/**
 * For CD/PS1/Dreamcast jewel cases only: refines the three seams of a spine | back | spine | front layout
 * (see JEWEL_CASE_GROUPS) by searching near where JEWEL_CASE_MM's known proportions predict each one,
 * rather than a blind global search. A global threshold-based search (the same approach as findFoldLines)
 * was tried first and rejected: on real jewel case scans, the busy collage-style back cover raises the
 * "ordinary edge noise" baseline enough that the genuine, but modest, spine1|back seam often doesn't clear
 * a global threshold at all (seen in testing on two of three real PS1 scans), while a blind combinatorial
 * match against whatever peaks DO clear it can just as easily lock onto a wrong triple. Anchoring each
 * search to its expected position avoids both failure modes, at the cost of never finding a seam far from
 * where it's expected to be. */
function findJewelCaseSeams(gray: Float32Array, width: number, height: number, dpi: number): [number, number, number] {
  const mmToPx = (mm: number) => (mm / MM_PER_INCH) * dpi;
  const profile = smooth(verticalSeamProfile(gray, width, height));
  const margin = Math.max(2, Math.floor(width * 0.01));
  for (let i = 0; i < margin; i++) profile[i] = 0;
  for (let i = width - margin; i < width; i++) profile[i] = 0;

  const peakNear = (expectedPx: number, windowPx: number): number => {
    const lo = Math.max(0, Math.round(expectedPx - windowPx));
    const hi = Math.min(width - 1, Math.round(expectedPx + windowPx));
    let best = Math.round(expectedPx);
    let bestValue = -Infinity;
    for (let x = lo; x <= hi; x++) {
      if (profile[x] > bestValue) {
        bestValue = profile[x];
        best = x;
      }
    }
    return best;
  };

  const x1 = peakNear(mmToPx(JEWEL_CASE_MM.spine), mmToPx(4));
  const x2 = peakNear(x1 + mmToPx(JEWEL_CASE_MM.back), mmToPx(6));
  const x3 = peakNear(x2 + mmToPx(JEWEL_CASE_MM.spine2), mmToPx(6));
  return [x1, x2, x3];
}

function colorToHex([r, g, b]: [number, number, number]): string {
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Per-row MEDIAN colour (not mean): a band with left-aligned logo text or marks over part of its width
 * would otherwise pull the row's average colour towards the logo, which can trigger a false transition
 * well before the band's real lower edge (seen in testing: PS4/PS5's inset logo did exactly this to a
 * mean-based version of this function). The median is unaffected as long as the logo covers under half
 * the row's width, which it always does here. */
function rowMedianColor(img: RawImage, x0: number, x1: number, y: number): [number, number, number] {
  const { width, channels, data } = img;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let x = x0; x < x1; x++) {
    const o = (y * width + x) * channels;
    r.push(data[o]);
    g.push(data[o + 1]);
    b.push(data[o + 2]);
  }
  return [median(r), median(g), median(b)];
}

/** Total colour drift between a band's top row and its bottom row beyond which it's called a "gradient"
 * rather than "flat" — well above ordinary JPEG noise in a genuinely flat area, well below the drift of a
 * black-to-grey style header (seen in testing on PS3). */
const GRADIENT_DRIFT_THRESHOLD = 20;

/** How much the row-median colour must jump, row to row, to be considered a real edge rather than a
 * smooth gradient's own gradual drift (seen in testing: a gradient moves a couple of units per row over
 * dozens of rows; the edge into real cover art moves 50-250+ units in a single row). */
const JUMP_THRESHOLD = 25;

/** Detects the header band — flat OR a smooth vertical gradient — by tracking the row-median colour
 * (immune to a small logo/badge sitting in part of the row, see rowMedianColor) down from the top and
 * looking for a sudden, sustained jump: a gradient drifts a little every row without ever jumping this
 * much in one step, while real cover art starts abruptly relative to wherever the band's colour had
 * drifted to. Persistence is checked against the colour just before the candidate jump, not the band's
 * very first row, precisely so an already-drifted gradient doesn't fool the check. Reports the band's top
 * and bottom colours; callers can tell a flat band from a gradient by comparing the two. */
function findHeaderBand(
  img: RawImage,
  x0: number,
  x1: number,
  maxFrac = 0.35,
): { row: number; shape: 'flat' | 'gradient'; colorHex: string; endColorHex: string } | null {
  const { height } = img;
  const limit = Math.max(2, Math.floor(height * maxFrac));
  if (x1 - x0 <= 0) return null;

  // A few rows in from the very top, not row 0, in case of a 1px scan/bleed artefact at the trim edge.
  const refRow = 2;
  // A short-lived bump (a texture, a small badge partly surviving the row median) must not be mistaken
  // for the real edge; require the jump to hold for a meaningful slice of the search window, not a
  // handful of rows, before accepting it.
  const persistFor = Math.max(8, Math.round(limit * 0.05));
  const topColor = rowMedianColor(img, x0, x1, refRow);

  let prevColor = topColor;
  for (let row = refRow + 1; row < limit - persistFor; row++) {
    const color = rowMedianColor(img, x0, x1, row);
    if (colorDistance(color, prevColor) <= JUMP_THRESHOLD) {
      prevColor = color;
      continue;
    }
    const preJumpColor = prevColor;
    const holds = Array.from({ length: persistFor }, (_, k) => colorDistance(rowMedianColor(img, x0, x1, row + k), preJumpColor) > JUMP_THRESHOLD).every(
      Boolean,
    );
    if (holds) {
      // A little inside the band, not its last row: a border thinner than the persistence window sits at the foot.
      const bottomColor = rowMedianColor(img, x0, x1, Math.max(refRow + 1, Math.floor(row * 0.85)));
      const shape = colorDistance(topColor, bottomColor) > GRADIENT_DRIFT_THRESHOLD ? 'gradient' : 'flat';
      return { row, shape, colorHex: colorToHex(topColor), endColorHex: colorToHex(bottomColor) };
    }
    prevColor = color;
  }
  return null;
}

/** The most frequent band colour if one wins outright, otherwise the per-channel median. */
function modeOrMedianHexColor(hexes: (string | null)[]): string | null {
  const present = hexes.filter((h): h is string => h !== null);
  if (!present.length) return null;
  const counts = new Map<string, number>();
  for (const h of present) counts.set(h, (counts.get(h) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] > 1 && ranked[0][1] > (ranked[1]?.[1] ?? 0)) return ranked[0][0];
  const parsed = present.map((h): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  return colorToHex([median(parsed.map((c) => c[0])), median(parsed.map((c) => c[1])), median(parsed.map((c) => c[2]))]);
}

// ─── Branding: what is printed on the front and the spine ─────────────────────────────────────────────────
// Everything below works on the same RawImage the case measurements use (templates flattened onto magenta so
// the branding's edge is a hard jump). The vocabulary is the same for the front and the spine:
//   band — the solid coloured area at the top (or down the left edge) that carries the logo
//   logo — a group of printed marks on the band
// Sizes and positions are percentages of the panel they sit on: the front is W (its width) by H (its height),
// the spine is S (its width) by L (its length, = H). Position is the top-left corner, measured from the panel's
// top-left trim corner.

type HeaderBand = NonNullable<ReturnType<typeof findHeaderBand>>;

interface Band {
  /** flat / sloped / arched / dipped describe a full-width band's lower edge; tab is a block covering part of the
   * width; strip is a vertical strip down the left edge. */
  shape: 'flat' | 'sloped' | 'arched' | 'dipped' | 'tab' | 'strip';
  widthPct: number;
  heightPct: number;
  /** The shallowest the band gets; the same as heightPct unless the lower edge is sloped, arched or dipped. */
  heightMinPct: number;
  xPct: number;
  yPct: number;
  hex: string;
  /** Second colour when the band is a gradient (and which way it runs), else null. */
  hex2: string | null;
  gradient: 'horizontal' | 'vertical' | null;
  /** The thin line along the band's lower edge. */
  borderPct: number | null;
  borderHex: string | null;
}
interface Logo {
  widthPct: number;
  heightPct: number;
  xPct: number;
  yPct: number;
  hex: string;
}
interface Branding {
  frontBand: Band | null;
  frontLogos: Logo[];
  /** The spine's coloured cap — or the whole spine, when its colour runs the full length (heightPct 100). */
  spineBand: Band | null;
  spineLogos: Logo[];
}

/** Colour distance beyond which a pixel counts as a printed mark on its band/cap, not the plain background. */
const MARK_DISTANCE = 70;
/** A header/tab needs at least this much depth (% H) in a column to count as present there. */
const MIN_HEADER_DEPTH_PCT = 2;
/** Marks closer together than this (fraction of the panel) belong to one logo. */
const LOGO_GAP_FRACTION = 0.08;

function pixelAt(img: RawImage, x: number, y: number): [number, number, number] {
  const o = (y * img.width + x) * img.channels;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
}

/** Mean colour of the 3 columns around x at row y (steadies a single noisy JPEG pixel). */
function meanAround(img: RawImage, x: number, y: number): [number, number, number] {
  const lo = Math.max(0, x - 1);
  const hi = Math.min(img.width - 1, x + 1);
  let r = 0;
  let g = 0;
  let b = 0;
  for (let xx = lo; xx <= hi; xx++) {
    const [pr, pg, pb] = pixelAt(img, xx, y);
    r += pr;
    g += pg;
    b += pb;
  }
  const n = hi - lo + 1;
  return [r / n, g / n, b / n];
}

function medianColor(colors: [number, number, number][]): string | null {
  if (!colors.length) return null;
  return colorToHex([median(colors.map((c) => c[0])), median(colors.map((c) => c[1])), median(colors.map((c) => c[2]))]);
}

/** Header depth (rows) in each sampled column of [x0, x1): the same "sudden sustained jump" test findHeaderBand
 * uses, run per column. A logo makes some columns stop early, so callers take an envelope over neighbours. */
function columnBandDepths(img: RawImage, x0: number, x1: number, maxFrac = 0.35): { xs: number[]; depths: number[] } {
  const limit = Math.max(2, Math.floor(img.height * maxFrac));
  const persist = Math.max(8, Math.round(limit * 0.05));
  const step = Math.max(1, Math.floor((x1 - x0) / 300));
  const xs: number[] = [];
  const depths: number[] = [];
  for (let x = x0; x < x1; x += step) {
    let prev = meanAround(img, x, 2);
    let depth = 0;
    for (let row = 3; row < limit - persist; row++) {
      const color = meanAround(img, x, row);
      if (colorDistance(color, prev) <= JUMP_THRESHOLD) {
        prev = color;
        continue;
      }
      let holds = true;
      for (let k = 0; k < persist && holds; k++) holds = colorDistance(meanAround(img, x, row + k), prev) > JUMP_THRESHOLD;
      if (holds) {
        depth = row;
        break;
      }
      prev = color;
    }
    xs.push(x);
    depths.push(depth);
  }
  return { xs, depths };
}

/** The thin line under a header: rows after the band's lower edge that keep one colour, if that run is short
 * enough (≤2.5% H) to be a line rather than the start of the artwork. */
function findEdgeLine(img: RawImage, x0: number, x1: number, bandRow: number): { thicknessPct: number; hex: string } | null {
  const start = Math.min(img.height - 1, bandRow + 1); // bandRow itself is often a blended edge row
  const first = rowMedianColor(img, x0, x1, start);
  let run = 0;
  const maxRun = Math.round(img.height * 0.025);
  for (let y = start; y < Math.min(img.height, start + maxRun + 4); y++) {
    if (colorDistance(rowMedianColor(img, x0, x1, y), first) > 30) break;
    run++;
  }
  // Shorter than ~0.25% H is a blend of two colours, not a printed line; longer than maxRun is artwork.
  if (run < img.height * 0.0025 || run > maxRun) return null;
  return { thicknessPct: (100 * run) / img.height, hex: colorToHex(first) };
}

/** A border that the band-edge search absorbed into the band because it is thinner than the persistence window:
 * look back up from the band's end for a short run of one colour that differs from the band body. */
function findTrailingLine(img: RawImage, x0: number, x1: number, bandRow: number): { thicknessPct: number; hex: string } | null {
  const lastRow = Math.max(0, bandRow - 1);
  const last = rowMedianColor(img, x0, x1, lastRow);
  const body = rowMedianColor(img, x0, x1, Math.max(0, Math.floor(bandRow * 0.85)));
  if (colorDistance(last, body) <= 40) return null;
  let run = 0;
  const maxRun = Math.round(img.height * 0.025);
  for (let y = lastRow; y >= Math.max(0, lastRow - maxRun - 4); y--) {
    if (colorDistance(rowMedianColor(img, x0, x1, y), last) > 30) break;
    run++;
  }
  if (run < img.height * 0.0025 || run > maxRun) return null;
  return { thicknessPct: (100 * run) / img.height, hex: colorToHex(last) };
}

/** The band with its bottom colour taken a little inside, so a border at the very edge isn't read as a gradient. */
function insideBand(img: RawImage, x0: number, x1: number, band: HeaderBand): HeaderBand {
  return { ...band, endColorHex: colorToHex(rowMedianColor(img, x0, x1, Math.max(2, Math.floor(band.row * 0.85)))) };
}

/** Which columns of the front hold the band, found from the top row's colour: inside a band (flat, or a gradient) it
 * changes smoothly from column to column, while a tab's edge or the artwork beside it is an abrupt change. Splits the
 * row at abrupt changes, merges across a tiny segment (a logo touching the top edge) when its two neighbours match,
 * and returns the segment holding the most columns deep enough to be a band. */
function pickBandSegment(tops: [number, number, number][], deep: boolean[], tinyColumns: number): [number, number] | null {
  const segs: [number, number][] = [];
  let start = 0;
  for (let i = 1; i < tops.length; i++) {
    if (colorDistance(tops[i], tops[i - 1]) > 60) {
      segs.push([start, i - 1]);
      start = i;
    }
  }
  segs.push([start, tops.length - 1]);
  for (let merged = true; merged; ) {
    merged = false;
    for (let k = 1; k < segs.length - 1; k++) {
      const [a, b] = segs[k];
      if (b - a + 1 <= tinyColumns && colorDistance(tops[segs[k - 1][1]], tops[segs[k + 1][0]]) <= 60) {
        segs.splice(k - 1, 3, [segs[k - 1][0], segs[k + 1][1]]);
        merged = true;
        break;
      }
    }
  }
  const countDeep = (a: number, b: number) => deep.slice(a, b + 1).filter(Boolean).length;
  // A header sits against the front's left edge (a band spans the width, a tab starts in the corner), so a
  // substantial segment there wins over a larger one in the artwork.
  const first = segs.find(([a, b]) => b - a + 1 > tinyColumns);
  if (first && countDeep(first[0], first[1]) >= (first[1] - first[0] + 1) * 0.3) return first;
  let best: [number, number] | null = null;
  let bestCount = 0;
  for (const [a, b] of segs) {
    const count = countDeep(a, b);
    if (count > bestCount) {
      bestCount = count;
      best = [a, b];
    }
  }
  return best;
}

/** The band's lower edge in each column, steadied against logos: an upper quantile of the nearby columns that reach
 * almost as deep as the deepest of them. A logo cuts a column short, so those are dropped; a sloped or arched edge
 * is not, because the window is small (±4% of the front). If a logo fills the whole window, fall back to the
 * deepest column within a wider one. */
function edgeDepths(xs: number[], depths: number[], frontW: number): number[] {
  const near = frontW * 0.04;
  const far = frontW * 0.12;
  return xs.map((x) => {
    const inNear = depths.filter((_, i) => Math.abs(xs[i] - x) <= near);
    const deepest = Math.max(...inNear);
    const kept = inNear.filter((d) => d >= deepest * 0.6).sort((a, b) => a - b);
    // The 80th percentile of the columns that reach nearly full depth: logos pull the middle down, a slope only
    // moves the top by a fraction of a percent inside a window this small.
    if (kept.length >= 2) return kept[Math.min(kept.length - 1, Math.floor(kept.length * 0.8))];
    return Math.max(...depths.filter((_, i) => Math.abs(xs[i] - x) <= far));
  });
}

/** The thin border along the band's lower edge, read in each column at that column's own edge (so a curved or sloped
 * band is followed, not sampled at one row) and combined across the front. Checks both the rows just above the
 * edge (a border thinner than the edge search's persistence window gets absorbed into the band) and just below. */
function findBorderAlongEdge(img: RawImage, xs: number[], rawDepths: number[], cleanDepths: number[]): { thicknessPct: number; hex: string } | null {
  const maxRun = Math.round(img.height * 0.025);
  const minRun = img.height * 0.0025;
  const runs: number[] = [];
  const colors: [number, number, number][] = [];
  let candidates = 0;
  for (let i = 0; i < xs.length; i++) {
    const d = rawDepths[i];
    if (d < 8 || d < cleanDepths[i] * 0.9 || d + maxRun + 4 >= img.height) continue; // logo-shortened columns have no edge
    candidates++;
    const x = xs[i];
    const body = meanAround(img, x, 2);
    const above = meanAround(img, x, d - 1);
    let run = 0;
    let color: [number, number, number] | null = null;
    if (colorDistance(above, body) > 40) {
      color = above;
      for (let y = d - 1; y >= Math.max(0, d - 1 - maxRun - 4); y--) {
        if (colorDistance(meanAround(img, x, y), above) > 30) break;
        run++;
      }
    } else {
      const below = meanAround(img, x, d + 1);
      if (colorDistance(below, body) > 40) {
        color = below;
        for (let y = d + 1; y < d + 1 + maxRun + 4; y++) {
          if (colorDistance(meanAround(img, x, y), below) > 30) break;
          run++;
        }
      }
    }
    if (color && run >= minRun && run <= maxRun) {
      runs.push(run);
      colors.push(color);
    }
  }
  if (candidates === 0 || runs.length < 3 || runs.length < candidates * 0.25) return null;
  return { thicknessPct: (100 * median(runs)) / img.height, hex: medianColor(colors) ?? '#000000' };
}

/** How many columns at the front's left edge are really still the spine. A fold found a few millimetres too far left
 * leaves the spine's own mark (PS2's white square) showing there, where it merges with the front's logo. Such a mark
 * is visible in the spine's last column, and the leaked columns stay identical to it; a plain spine edge has no mark,
 * so nothing is trimmed (which also keeps a plain band's left edge where it is). */
function spineLeakColumns(img: RawImage, x2: number): number {
  const rows = Math.round(img.height * 0.12);
  // A little inside the spine, not its very edge, where scanner shading and the fold's own shadow differ from the face.
  const ref = Math.max(0, x2 - 8);
  const bg = meanAround(img, ref, 2);
  let marks = 0;
  for (let y = 4; y < rows; y++) if (colorDistance(pixelAt(img, ref, y), bg) > MARK_DISTANCE) marks++;
  // A real mark (PS2's square) covers a sizeable share of the column; a few stray pixels at the spine's edge do not.
  if (marks < (rows - 4) * 0.15) return 0;
  const limit = Math.round((img.width - x2) * 0.08);
  let k = 0;
  for (; k < limit; k++) {
    let diff = 0;
    for (let y = 4; y < rows; y++) diff += colorDistance(pixelAt(img, x2 + k, y), pixelAt(img, ref, y));
    if (diff / (rows - 4) > 30) break;
  }
  return k;
}

/** Marks on the header: runs of pixels that differ from the column's own background (its top rows), grouped
 * left-to-right so "PS symbol + PS4 wordmark" is one lockup. */
function findFrontLogos(img: RawImage, x0: number, x1: number, depthAt: (x: number) => number, edgeMarginPct: number): Logo[] {
  const frontW = x1 - x0;
  const flags: boolean[] = new Array(frontW).fill(false);
  const colTop = new Int32Array(frontW).fill(-1);
  const colBottom = new Int32Array(frontW).fill(-1);
  const samples: [number, number, number][][] = Array.from({ length: frontW }, () => []);
  for (let x = x0; x < x1; x++) {
    // Stay clear of the border and of a curved edge's own line, which would otherwise read as a logo.
    const depth = depthAt(x) - Math.max(3, Math.round((img.height * edgeMarginPct) / 100));
    if (depth < 8) continue;
    const bg = meanAround(img, x, 2);
    let count = 0;
    for (let y = 4; y < depth; y++) {
      const c = pixelAt(img, x, y);
      if (colorDistance(c, bg) <= MARK_DISTANCE) continue;
      count++;
      if (colTop[x - x0] < 0) colTop[x - x0] = y;
      colBottom[x - x0] = y;
      if (count % 4 === 0) samples[x - x0].push(c);
    }
    flags[x - x0] = count >= 2;
  }
  const logos: Logo[] = [];
  // A wide gap, so a symbol and its wordmark (or the letters of one wordmark) stay one logo.
  for (const [a, b] of runsOf(flags, Math.round(frontW * LOGO_GAP_FRACTION))) {
    let top = Infinity;
    let bottom = -1;
    const colors: [number, number, number][] = [];
    for (let i = a; i <= b; i++) {
      if (colTop[i] >= 0) top = Math.min(top, colTop[i]);
      bottom = Math.max(bottom, colBottom[i]);
      colors.push(...samples[i]);
    }
    const heightPct = (100 * (bottom - top + 1)) / img.height;
    const widthPct = (100 * (b - a + 1)) / frontW;
    if (heightPct < 0.8 || widthPct < 0.4) continue; // dust, not a logo
    logos.push({ widthPct, heightPct, xPct: (100 * a) / frontW, yPct: (100 * top) / img.height, hex: medianColor(colors) ?? '#000000' });
  }
  return logos;
}

/** PS1-style front: a vertical strip down the left edge of the front cover. Its wordmark is too big for a
 * row-colour test (it covers half the strip's width), so find the strip's right edge as the strongest full-height
 * seam near the front's left edge instead. */
function measureLeftStrip(img: RawImage, frontX0: number, frontX1: number): Branding {
  const frontW = frontX1 - frontX0;
  const profile = smooth(verticalSeamProfile(toGray(img), img.width, img.height));
  let best = -1;
  let bestValue = 0;
  for (let x = frontX0 + Math.round(frontW * 0.05); x < frontX0 + Math.round(frontW * 0.3); x++) {
    if (profile[x] > bestValue) {
      bestValue = profile[x];
      best = x;
    }
  }
  if (best < 0) return emptyBranding();
  const widthPct = (100 * (best - frontX0)) / frontW;
  const hex = colorToHex(meanAround(img, frontX0 + Math.max(1, Math.round((best - frontX0) * 0.1)), 2));
  const band: Band = { shape: 'strip', widthPct, heightPct: 100, heightMinPct: 100, xPct: 0, yPct: 0, hex, hex2: null, gradient: null, borderPct: null, borderHex: null };
  return { ...emptyBranding(), frontBand: band };
}

function emptyBranding(): Branding {
  return { frontBand: null, frontLogos: [], spineBand: null, spineLogos: [] };
}

/** Second colour for a band, and which way it runs: the larger of the left→right and top→bottom colour drift, when
 * either is big enough to be a gradient and not JPEG noise. `left`/`right` are the colours at the band's two ends
 * along its top edge; `band` carries the top and bottom colours of a vertical drift. */
function bandGradient(
  left: [number, number, number],
  right: [number, number, number],
  band: HeaderBand,
): { hex: string; hex2: string | null; gradient: 'horizontal' | 'vertical' | null } {
  const top = hexToColor(band.colorHex);
  const bottom = hexToColor(band.endColorHex);
  const horizontal = colorDistance(left, right);
  const vertical = colorDistance(top, bottom);
  if (Math.max(horizontal, vertical) <= GRADIENT_DRIFT_THRESHOLD) return { hex: colorToHex(left), hex2: null, gradient: null };
  if (horizontal >= vertical) return { hex: colorToHex(left), hex2: colorToHex(right), gradient: 'horizontal' };
  return { hex: band.colorHex, hex2: band.endColorHex, gradient: 'vertical' };
}

function hexToColor(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/**
 * Front band, front logos, spine band and spine logos for a standard back | spine | front wrap. `band` is the header
 * pass the case measurements already ran on the right-hand slice of the front, or null if it found nothing.
 */
function measureBranding(img: RawImage, x1: number, x2: number, band: HeaderBand | null): Branding {
  const out = emptyBranding();
  const { height } = img;

  // ── Front band: per-column depth across the whole front, not just the slice used for colour.
  const frontStart = x2 + spineLeakColumns(img, x2);
  const raw = columnBandDepths(img, frontStart, img.width);
  // With an estimated fold, the first columns can still be the spine's cap, which is deeper than any header;
  // drop leading columns that are much deeper than the typical column so they aren't read as front branding.
  // Logos shorten many columns, so use a high percentile (the band's own depth), not the median.
  const positive = raw.depths.filter((d) => d > 0).sort((a, b) => a - b);
  const typical = positive.length ? positive[Math.floor(positive.length * 0.75)] : 0;
  let skip = 0;
  while (skip < raw.depths.length - 1 && typical > 0 && raw.depths[skip] > typical * 1.5) skip++;
  const xs = raw.xs.slice(skip);
  const frontX0 = xs[0] ?? frontStart;
  const frontW = img.width - frontX0;
  const minDepth = (MIN_HEADER_DEPTH_PCT / 100) * height;
  // Only columns inside the band's own colour count: beside a tab, the artwork's jumps are not a band's edge.
  const step = xs.length > 1 ? xs[1] - xs[0] : 1;
  const tops = xs.map((x) => meanAround(img, x, 2));
  const segment = pickBandSegment(tops, raw.depths.slice(skip).map((d) => d >= minDepth), Math.max(1, Math.round((frontW * 0.03) / step)));
  const depths = raw.depths.slice(skip).map((d, i) => (segment && i >= segment[0] && i <= segment[1] ? d : 0));
  const edge = edgeDepths(xs, depths, frontW);
  const nearest = (values: number[], x: number) => {
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    return values[best] ?? 0;
  };
  const coverage = segment ? (segment[1] - segment[0] + 1) / xs.length : 0;
  const pctH = (px: number) => (100 * px) / height;
  if (band && coverage >= 0.6) {
    const [l, c, r] = [0.05, 0.5, 0.95].map((f) => pctH(nearest(edge, frontX0 + f * frontW))) as [number, number, number];
    const spread = Math.max(l, c, r) - Math.min(l, c, r);
    const shape = spread <= 1.5 ? 'flat' : c > Math.max(l, r) + 1 ? 'arched' : c < Math.min(l, r) - 1 ? 'dipped' : 'sloped';
    const colors = bandGradient(meanAround(img, frontX0 + Math.round(frontW * 0.03), 2), meanAround(img, frontX0 + Math.round(frontW * 0.97), 2), band);
    const border = findBorderAlongEdge(img, xs, depths, edge);
    out.frontBand = {
      shape,
      widthPct: 100,
      heightPct: Math.max(l, c, r),
      heightMinPct: Math.min(l, c, r),
      xPct: 0,
      yPct: 0,
      ...colors,
      borderPct: border?.thicknessPct ?? null,
      borderHex: border?.hex ?? null,
    };
  } else if (segment && coverage > 0.03 && coverage < 0.6) {
    // A block covering part of the width. Its edge comes straight from where the band's colour stops.
    const tabX0 = xs[segment[0]];
    const tabX1 = xs[segment[1]] + step;
    const deepest = pctH(Math.max(...edge));
    const mid = Math.round((tabX0 + tabX1) / 2);
    // The band the case pass found is on the artwork when the header is only a tab, so read the tab on its own.
    const tabSpan = tabX1 - tabX0;
    const tabBand =
      findHeaderBand(img, Math.round(tabX0 + tabSpan * 0.6), Math.round(tabX1)) ??
      { row: 0, shape: 'flat' as const, colorHex: colorToHex(meanAround(img, mid, 2)), endColorHex: colorToHex(meanAround(img, mid, 2)) };
    const border = findBorderAlongEdge(img, xs, depths, edge);
    out.frontBand = {
      shape: 'tab',
      widthPct: (100 * Math.max(0, tabX1 - tabX0)) / frontW,
      heightPct: deepest,
      heightMinPct: deepest,
      xPct: (100 * (tabX0 - frontX0)) / frontW,
      yPct: 0,
      ...bandGradient(meanAround(img, Math.round(tabX0) + 3, 2), meanAround(img, Math.round(tabX1) - 3, 2), tabBand),
      borderPct: border?.thicknessPct ?? null,
      borderHex: border?.hex ?? null,
    };
  }
  // A curved or sloped edge moves between samples, so keep further from it than from a flat one.
  const curved = out.frontBand !== null && out.frontBand.heightPct - out.frontBand.heightMinPct > 1.5;
  if (out.frontBand) out.frontLogos = findFrontLogos(img, frontX0, img.width, (x) => nearest(edge, x), curved ? 3 : 1.2);

  // ── Spine band: sample a strip near the spine's left edge, clear of a centred logo, to find where its colour stops.
  const spineW = x2 - x1;
  const edgeX0 = x1 + Math.round(spineW * 0.06);
  const edgeX1 = x1 + Math.round(spineW * 0.22);
  if (edgeX1 <= edgeX0) return out;
  const foundCap = findHeaderBand(img, edgeX0, edgeX1, 0.4);
  // A "cap" under 3% of the length is a bevel or a mark at the very top, not a cap.
  const cap = foundCap && pctH(foundCap.row) >= 3 ? foundCap : null;
  const topColor = rowMedianColor(img, edgeX0, edgeX1, 2);
  let fullLength = false;
  if (!cap) {
    let same = 0;
    let rows = 0;
    for (let y = 0; y < height; y += 4) {
      rows++;
      if (colorDistance(rowMedianColor(img, edgeX0, edgeX1, y), topColor) <= 40) same++;
    }
    fullLength = same / rows >= 0.9;
  }
  if (cap || fullLength) {
    const border = cap ? (findTrailingLine(img, edgeX0, edgeX1, cap.row) ?? findEdgeLine(img, edgeX0, edgeX1, cap.row)) : null;
    const inner = cap ? insideBand(img, edgeX0, edgeX1, cap) : null;
    const gradient =
      inner && colorDistance(hexToColor(inner.colorHex), hexToColor(inner.endColorHex)) > GRADIENT_DRIFT_THRESHOLD
        ? ({ hex: inner.colorHex, hex2: inner.endColorHex, gradient: 'vertical' } as const)
        : { hex: colorToHex(topColor), hex2: null, gradient: null };
    out.spineBand = {
      shape: 'flat',
      widthPct: 100,
      heightPct: cap ? pctH(cap.row) : 100,
      heightMinPct: cap ? pctH(cap.row) : 100,
      xPct: 0,
      yPct: 0,
      ...gradient,
      borderPct: border?.thicknessPct ?? null,
      borderHex: border?.hex ?? null,
    };
  }

  // ── Spine logos: pixels that differ from the band's colour, down the cap (or the top 40% if it runs full length).
  if (out.spineBand) {
    const markRows = cap ? cap.row : Math.round(height * 0.4);
    const bgSamples: [number, number, number][] = [];
    for (let y = 4; y < markRows - 2; y += 4) bgSamples.push(rowMedianColor(img, edgeX0, edgeX1, y));
    const bg = hexToColor(medianColor(bgSamples) ?? out.spineBand.hex);
    const innerX0 = x1 + Math.round(spineW * 0.03);
    const innerX1 = x2 - Math.round(spineW * 0.03);
    const flags: boolean[] = new Array(markRows).fill(false);
    const rowMin = new Int32Array(markRows).fill(innerX1);
    const rowMax = new Int32Array(markRows).fill(innerX0);
    const samples: [number, number, number][][] = Array.from({ length: markRows }, () => []);
    for (let y = 4; y < markRows - 2; y++) {
      let count = 0;
      for (let x = innerX0; x < innerX1; x++) {
        const c = pixelAt(img, x, y);
        if (colorDistance(c, bg) <= MARK_DISTANCE) continue;
        count++;
        rowMin[y] = Math.min(rowMin[y], x);
        rowMax[y] = Math.max(rowMax[y], x);
        if (count % 3 === 0) samples[y].push(c);
      }
      flags[y] = count >= 2;
    }
    // On a spine whose colour runs its whole length the title sits on the band too, so group tightly and (below) keep
    // only the first logo: anything after it is the title.
    for (const [a, b] of runsOf(flags, Math.round(height * (cap ? LOGO_GAP_FRACTION * 0.4 : 0.015)))) {
      const heightPct = pctH(b - a + 1);
      if (heightPct < 0.6) continue;
      let xMin = innerX1;
      let xMax = innerX0;
      for (let y = a; y <= b; y++) {
        xMin = Math.min(xMin, rowMin[y]);
        xMax = Math.max(xMax, rowMax[y]);
      }
      out.spineLogos.push({
        widthPct: (100 * (xMax - xMin + 1)) / spineW,
        heightPct,
        xPct: (100 * (xMin - x1)) / spineW,
        yPct: pctH(a),
        hex: medianColor(samples.slice(a, b + 1).flat()) ?? '#000000',
      });
    }
  }
  if (!cap) out.spineLogos = out.spineLogos.slice(0, 1);
  return out;
}

/** The front band for the case report, from the same reading the branding report uses: a tab's own height (the
 * right-hand slice the case pass samples is artwork beside a tab), colours that ignore a thin border at the band's foot
 * and see a left-to-right gradient. Falls back to the header pass alone. Returns false when there is no band. */
function applyFrontBand(result: ImageResult, band: HeaderBand | null, heightPx: number): boolean {
  const front = result.branding?.frontBand;
  if (front?.shape === 'tab') result.bandHeightPct = front.heightPct;
  else if (band) result.bandHeightPct = (100 * band.row) / heightPx;
  if (front) {
    result.bandShape = front.gradient ? 'gradient' : 'flat';
    result.bandColorHex = front.hex;
    result.bandEndColorHex = front.hex2;
    return true;
  }
  if (!band) return false;
  result.bandShape = band.shape;
  result.bandColorHex = band.colorHex;
  result.bandEndColorHex = band.shape === 'gradient' ? band.endColorHex : null;
  return true;
}

/** `knownFold`: where the seams are, when the layout is known rather than found — two x positions (back|spine, spine|front)
 * or, for a jewel case, three (spine | back | spine | front). */
async function measure(file: string, group: string, knownFold?: number[], kind: 'scan' | 'app' = 'scan'): Promise<ImageResult> {
  const image = sharp(file);
  const meta = await image.metadata();
  const widthPx = meta.width!;
  const heightPx = meta.height!;
  const { dpi, confidence } = dpiConfidence(meta.density);

  const notes: string[] = [];
  if (confidence !== 'ok') {
    notes.push(`DPI is ${meta.density ?? 'missing'}, not ${REQUIRED_DPI}; rejected.`);
  }
  const profileNote = colourProfileNote(meta.icc);
  if (profileNote) notes.push(profileNote);

  const toMm = (px: number) => (dpi ? (px / dpi) * MM_PER_INCH : null);
  const result: ImageResult = {
    file,
    kind,
    widthPx,
    heightPx,
    dpi,
    dpiConfidence: confidence,
    widthMm: toMm(widthPx),
    heightMm: toMm(heightPx),
    backMm: null,
    spineMm: null,
    frontMm: null,
    spine2Mm: null,
    spineSource: 'none',
    bandHeightPct: null,
    bandShape: 'none',
    bandColorHex: null,
    bandEndColorHex: null,
    spineCapPct: null,
    branding: null,
    notes,
  };

  if (confidence !== 'ok') return result;

  // A full wrap (back+spine+front laid side by side) is always wider than a single panel is tall; a
  // portrait image here is almost certainly a single front- or back-cover scan, not a wrap, and treating
  // it as one would silently invent a nonsense back/spine/front split.
  if (widthPx < heightPx) {
    notes.push('Image is portrait (taller than wide) — likely a single front/back panel, not a full wrap. Skipping spine/band analysis.');
    return result;
  }

  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: RawImage = { width: info.width, height: info.height, channels: info.channels, data };

  if (JEWEL_CASE_GROUPS.has(group.toLowerCase())) {
    if (!dpi) return result;
    const gray = toGray(img);
    const [x1, x2, x3] = knownFold && knownFold.length === 3 ? knownFold : findJewelCaseSeams(gray, img.width, img.height, dpi);
    if (knownFold && knownFold.length === 3) {
      result.spineSource = 'known';
    } else {
      result.spineSource = 'estimated';
      notes.push(
        `Jewel case (spine | back | spine | front): seams refined from ${group}'s known CD/PS1 tray-card proportions (case-research.md) by searching nearby for the nearest real edge, not detected outright.`,
      );
    }
    result.spineMm = toMm(x1);
    result.backMm = toMm(x2 - x1);
    result.spine2Mm = toMm(x3 - x2);
    result.frontMm = toMm(img.width - x3);

    // Not attempted: branding-spec.md documents PS1's branding as a vertical strip on the LEFT edge of the
    // front cover (15.5% W), not a horizontal band at the top like PS3/4/5 — findHeaderBand looks for the
    // wrong shape on the wrong axis here, and would also be reading the one region (the front's right
    // side) deliberately cropped to avoid a left-aligned mark on every other case.
    notes.push("Header band not checked: PS1's branding is a vertical left-edge strip (branding-spec.md), not a horizontal top band.");
    result.branding = measureLeftStrip(img, x3, img.width);
    return result;
  }

  const gray = toGray(img);
  let fold = findFoldLines(gray, img.width, img.height);
  if (knownFold) {
    fold = [knownFold[0], knownFold[1]];
    result.spineSource = 'known';
  } else if (fold) {
    result.spineSource = 'detected';
  } else {
    const knownSpineMm = KNOWN_SPINE_MM[group.toLowerCase()];
    if (knownSpineMm && dpi) {
      const spinePx = (knownSpineMm / MM_PER_INCH) * dpi;
      const sidePx = (img.width - spinePx) / 2;
      fold = [Math.round(sidePx), Math.round(sidePx + spinePx)];
      result.spineSource = 'estimated';
      notes.push(`Fold lines not detected; estimated from ${group}'s known ${knownSpineMm} mm spine, assuming equal front/back width.`);
    } else {
      notes.push('Could not confidently locate the back|spine and spine|front fold lines, and no known spine width for this folder to fall back on.');
      return result;
    }
  }

  const [x1, x2] = fold;
  result.backMm = toMm(x1);
  result.spineMm = toMm(x2 - x1);
  result.frontMm = toMm(img.width - x2);

  // Header logos are near-universally left- or centre-aligned (see branding-spec.md); sampling only the
  // right-hand slice of the front panel avoids the logo mark entirely on every case tested so far, since a
  // logo pulling even a large minority of a row's pixels can still tip the row median (seen in testing:
  // PS4's wordmark did exactly this across ~45% of the front width).
  const bandSlice: [number, number] = [x2 + Math.round((img.width - x2) * 0.6), img.width];
  const band = findHeaderBand(img, bandSlice[0], bandSlice[1]);
  result.branding = measureBranding(img, x1, x2, band);
  if (!applyFrontBand(result, band, img.height)) {
    notes.push('No header band detected on the front panel (may be sloped/curved, or none).');
  }

  result.spineCapPct = result.branding.spineBand && result.branding.spineBand.heightPct < 100 ? result.branding.spineBand.heightPct : null;

  return result;
}


/** Contiguous [start, end] runs of true values, merging gaps of up to `gap` columns. */
function runsOf(flags: boolean[], gap = 3): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  let last = -1;
  for (let i = 0; i < flags.length; i++) {
    if (!flags[i]) continue;
    if (start < 0) start = i;
    else if (i - last > gap + 1) {
      runs.push([start, last]);
      start = i;
    }
    last = i;
  }
  if (start >= 0) runs.push([start, last]);
  return runs;
}

/** Per column: how far down from the top the printed area reaches (tolerating small gaps, e.g. a logo
 * cut-out), and the last printed row anywhere in the column. */
function columnExtents(alpha: Uint8Array, width: number, height: number): { top: Int32Array; bottom: Int32Array } {
  const top = new Int32Array(width);
  const bottom = new Int32Array(width).fill(-1);
  const maxGap = 8;
  for (let x = 0; x < width; x++) {
    let gapRows = 0;
    let reachedGap = false;
    for (let y = 0; y < height; y++) {
      if (alpha[y * width + x] <= ALPHA_OPAQUE) {
        if (++gapRows > maxGap) reachedGap = true;
        continue;
      }
      gapRows = 0;
      bottom[x] = y;
      if (!reachedGap) top[x] = y + 1;
    }
  }
  return { top, bottom };
}

/**
 * Measures a fan-made template.png: a transparent canvas with only the branding printed on it.
 *
 * Layout comes from the alpha channel, colour and header-band height from the same findHeaderBand pass the
 * scans use (transparent pixels flattened onto magenta so the band's lower edge is a hard jump), sampled from
 * the same right-hand slice of the front panel — so the numbers are directly comparable with the scans'.
 *   - Standard wraps: the spine is the taller strip of branding sticking down past the header band; back and
 *     front are what's left either side. No such strip (or an asymmetric one) falls back to KNOWN_SPINE_MM,
 *     exactly as for scans.
 *   - Jewel cases: two printed runs at the top (spine flap | ... | flap + front branding strip); the flap
 *     ends where the run's bottom edge steps down to full height.
 *   - DPI: like scans, anything not tagged exactly 300 is rejected by the caller. A 300-tagged width that's
 *     still implausible is rescaled to the same folder's scan summary width if there are scans, otherwise
 *     the file is skipped — mm values are never taken from metadata we can see is wrong.
 */
async function measureTemplate(file: string, group: string, scanWidthMm: number | null): Promise<ImageResult> {
  const meta = await sharp(file).metadata();
  const widthPx = meta.width!;
  const heightPx = meta.height!;
  const notes: string[] = [];
  const profileNote = colourProfileNote(meta.icc);
  if (profileNote) notes.push(profileNote);

  let dpi = REQUIRED_DPI;
  const widthMm = (widthPx / dpi) * MM_PER_INCH;
  let usable = true;
  if (widthMm < PLAUSIBLE_WRAP_WIDTH_MM[0] || widthMm > PLAUSIBLE_WRAP_WIDTH_MM[1]) {
    if (scanWidthMm) {
      dpi = (widthPx * MM_PER_INCH) / scanWidthMm;
      notes.push(
        `Implausible width at ${REQUIRED_DPI} DPI (${widthMm.toFixed(0)} mm); rescaled to ${group}'s scan summary width ${scanWidthMm.toFixed(1)} mm (effective ${dpi.toFixed(0)} DPI). Percentages are unaffected; mm values assume the template is a full wrap at scan size.`,
      );
    } else {
      notes.push(`Implausible width at ${REQUIRED_DPI} DPI (${widthMm.toFixed(0)} mm) and no ${group} scans to rescale from; skipped.`);
      usable = false;
    }
  }
  const toMm = (px: number) => (px / dpi) * MM_PER_INCH;

  const result: ImageResult = {
    file,
    kind: 'template',
    widthPx,
    heightPx,
    dpi,
    dpiConfidence: 'ok',
    widthMm: toMm(widthPx),
    heightMm: toMm(heightPx),
    backMm: null,
    spineMm: null,
    frontMm: null,
    spine2Mm: null,
    spineSource: 'none',
    bandHeightPct: null,
    bandShape: 'none',
    bandColorHex: null,
    bandEndColorHex: null,
    spineCapPct: null,
    branding: null,
    notes,
  };
  if (!usable) return result;
  if (widthPx < heightPx) {
    notes.push('Template is portrait (taller than wide) — not a full wrap. Skipping.');
    return result;
  }

  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = new Uint8Array(width * height);
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255;
    alpha[i] = data[i * 4 + 3];
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(data[i * 4 + c] * a + TEMPLATE_FLATTEN_RGB[c] * (1 - a));
  }
  const img: RawImage = { width, height, channels: 3, data: rgb };
  const { top, bottom } = columnExtents(alpha, width, height);
  const printed = Array.from(top, (t) => t > 0);

  if (JEWEL_CASE_GROUPS.has(group.toLowerCase())) {
    const runs = runsOf(printed);
    if (runs.length !== 2 || runs[0][0] > width * 0.01) {
      notes.push(`Jewel case layout not recognised: expected 2 printed runs starting at the left edge (spine flap | flap + front branding), found ${runs.length}.`);
      return result;
    }
    const [[, a1], [b0, b1]] = runs;
    const x1 = a1 + 1;
    const x2 = b0;
    let x3 = b0;
    while (x3 <= b1 && bottom[x3] < height - 4) x3++; // flap ends where the run reaches full height
    if (x3 > b1) {
      notes.push('Second spine flap has no step in its bottom edge, so its width could not be measured.');
      return result;
    }
    result.spineSource = 'detected';
    result.spineMm = toMm(x1);
    result.backMm = toMm(x2 - x1);
    result.spine2Mm = toMm(x3 - x2);
    result.frontMm = toMm(width - x3);
    result.branding = measureLeftStrip(img, x3, width);
    notes.push('Jewel case, read from alpha.');
    return result;
  }

  const headerRows = median(Array.from(top).filter((t) => t > 0));
  // A printed area covering most of the sheet is a boxed-cartridge layout (background fills it), not a thin header
  // band with a spine strip sticking down past it.
  const isHeaderLayout = headerRows < height * 0.3;
  const spineRuns = isHeaderLayout ? runsOf(Array.from(top, (t) => t > headerRows * 1.3 && t > headerRows + height * 0.02)) : [];
  const spineRun = spineRuns.sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
  const [lo, hi] = SPINE_FRACTION_RANGE;
  let fold: [number, number] | null = null;
  if (spineRun) {
    const [s0, s1] = spineRun;
    const spinePx = s1 + 1 - s0;
    const back = s0;
    // Widest spine researched is ~25 mm (VHS); anything wider is background art, not a spine strip.
    const plausible = toMm(spinePx) <= 25;
    const front = width - (s1 + 1);
    if (plausible && spinePx >= lo * width && spinePx <= hi * width && back > 0 && front > 0 && Math.abs(back - front) / ((back + front) / 2) <= SYMMETRY_TOLERANCE) {
      fold = [s0, s1 + 1];
      result.spineSource = 'detected';
    }
  }
  if (!fold) {
    const knownSpineMm = KNOWN_SPINE_MM[group.toLowerCase()];
    if (!knownSpineMm) {
      notes.push('No symmetric spine branding strip found and no known spine width for this folder; not a standard back|spine|front wrap with a header.');
      return result;
    }
    const spinePx = (knownSpineMm / MM_PER_INCH) * dpi;
    const sidePx = (width - spinePx) / 2;
    fold = [Math.round(sidePx), Math.round(sidePx + spinePx)];
    result.spineSource = 'estimated';
    notes.push(`No symmetric spine strip found; estimated from ${group}'s known ${knownSpineMm} mm spine, assuming equal front/back width.`);
  }
  const [x1, x2] = fold;
  result.backMm = toMm(x1);
  result.spineMm = toMm(x2 - x1);
  result.frontMm = toMm(width - x2);

  // Same slice of the front panel the scans sample, but of the printed part only: a template whose header is
  // just a small tab (Switch) has nothing to sample across the rest of the front.
  const frontPrinted = runsOf(printed.map((p, x) => p && x >= x2))[0];
  if (!frontPrinted) {
    notes.push('Nothing printed on the front panel: no header band.');
    return result;
  }
  const [f0, f1] = frontPrinted;
  const bandSlice: [number, number] = [f0 + Math.round((f1 - f0) * 0.6), f1 + 1];
  const band = findHeaderBand(img, bandSlice[0], bandSlice[1]);
  result.branding = measureBranding(img, x1, x2, band);
  result.spineCapPct = result.branding.spineBand && result.branding.spineBand.heightPct < 100 ? result.branding.spineBand.heightPct : null;
  if (!applyFrontBand(result, band, height)) {
    notes.push('No header band detected on the front panel.');
  }
  return result;
}

const fmt = (v: number | null, digits = 1) => (v === null ? '—' : v.toFixed(digits));
/** The single most frequent value (exact, unrounded) if one value repeats and wins outright; otherwise the median. */
function modeOrMedian(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 1 && ranked[0][1] > (ranked[1]?.[1] ?? 0) ? ranked[0][0] : median(values);
}
const modeOrMedianOrNull = (values: (number | null)[]) => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? modeOrMedian(present) : null;
};

const appLabel = (r: ImageResult) => (r.kind === 'app' ? 'app (rendered)' : basename(r.file));
const deltaNum = (a: number | null, b: number | null) => (a === null || b === null ? '—' : `${a - b >= 0 ? '+' : ''}${(a - b).toFixed(1)}`);
const deltaStr = (a: string | null, b: string | null) => (a === null || b === null ? '—' : a === b ? '=' : '≠');
/** How far apart two colours are (0 = identical, 441 = black vs white). */
const deltaHex = (a: string | null, b: string | null) => (a && b ? String(Math.round(colorDistance(hexToColor(a), hexToColor(b)))) : '—');

function buildReport(groups: Map<string, ImageResult[]>): string {
  const lines: string[] = ['# Cover scan measurements', ''];
  lines.push(
    "Generated by `scripts/measure-covers.ts`. Assumes each source image is a single, " +
      'pre-cropped full wrap (back | spine | front) with no border beyond the trim edge. ' +
      'Fold lines are found by edge detection, not assumed; header bands are detected as either ' +
      'a flat colour or a smooth vertical gradient (by where real cover art/photo texture starts, ' +
      "not by colour alone) — sloped/curved headers still need a follow-up pass. " +
      'All colours are sRGB: an embedded ICC profile is converted to sRGB when the image is read (flagged in Notes), and an image with no profile is assumed to be sRGB already. ' +
      `Scans and templates whose embedded DPI isn't exactly ${REQUIRED_DPI} are rejected outright and don't appear below (see stderr). ` +
      'Rows named `template.*` are fan-made transparent templates: their layout is read from the alpha channel and ' +
      'their header band/colours with the same code as the scans. Each table has one summary row across every row in it, template included: the mode (most frequent exact value) where one value repeats and wins outright, otherwise the median. ' +
      'If `npm run compare:covers` has been run, a table also shows `app (rendered)`, the app\'s own render of that case measured with its fold positions known, and `app − Mode` (mm or percentage points; `=`/`≠` for shapes; a colour distance, 0 to 441, for colours). It is never part of the Mode.',
  );
  lines.push('');

  for (const name of [...groups.keys()].sort()) {
    const results = groups.get(name)!.filter((r) => r.kind !== 'app');
    const app = groups.get(name)!.find((r) => r.kind === 'app');
    if (!results.length && !app) continue;
    lines.push(`## ${name}  (n=${results.length})`);
    lines.push('');
    lines.push(
      '| File | DPI | Width mm | Height mm | Back mm | Spine mm | Spine 2 mm | Front mm | Spine source | Band % H | Band shape | Band colour | Band end colour | Spine cap % L | Notes |',
    );
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    const rowFor = (r: ImageResult) =>
      `| ${appLabel(r)} | ${r.dpi ? r.dpi.toFixed(0) : '—'} | ${fmt(r.widthMm)} | ${fmt(r.heightMm)} ` +
      `| ${fmt(r.backMm)} | ${fmt(r.spineMm)} | ${fmt(r.spine2Mm)} | ${fmt(r.frontMm)} | ${r.spineSource} | ${fmt(r.bandHeightPct)} ` +
      `| ${r.bandShape} | ${r.bandColorHex ?? '—'} | ${r.bandEndColorHex ?? '—'} | ${fmt(r.spineCapPct)} | ${r.notes.join('; ')} |`;
    for (const r of results) lines.push(rowFor(r));
    lines.push(
      `| **Mode** | | **${fmt(modeOrMedianOrNull(results.map((r) => r.widthMm)))}** ` +
        `| **${fmt(modeOrMedianOrNull(results.map((r) => r.heightMm)))}** ` +
        `| **${fmt(modeOrMedianOrNull(results.map((r) => r.backMm)))}** ` +
        `| **${fmt(modeOrMedianOrNull(results.map((r) => r.spineMm)))}** ` +
        `| **${fmt(modeOrMedianOrNull(results.map((r) => r.spine2Mm)))}** ` +
        `| **${fmt(modeOrMedianOrNull(results.map((r) => r.frontMm)))}** | ` +
        `| **${fmt(modeOrMedianOrNull(results.map((r) => r.bandHeightPct)))}** | | ` +
        `**${modeOrMedianHexColor(results.map((r) => r.bandColorHex)) ?? '—'}** ` +
        `| **${modeOrMedianHexColor(results.map((r) => r.bandEndColorHex)) ?? '—'}** ` +
        `| **${fmt(modeOrMedianOrNull(results.map((r) => r.spineCapPct)))}** | |`,
    );
    if (app && results.length) {
      lines.push(rowFor(app));
      const m = (pick: (r: ImageResult) => number | null) => modeOrMedianOrNull(results.map(pick));
      lines.push(
        `| *app − Mode* | | ${deltaNum(app.widthMm, m((r) => r.widthMm))} | ${deltaNum(app.heightMm, m((r) => r.heightMm))} ` +
          `| ${deltaNum(app.backMm, m((r) => r.backMm))} | ${deltaNum(app.spineMm, m((r) => r.spineMm))} | ${deltaNum(app.spine2Mm, m((r) => r.spine2Mm))} ` +
          `| ${deltaNum(app.frontMm, m((r) => r.frontMm))} | | ${deltaNum(app.bandHeightPct, m((r) => r.bandHeightPct))} ` +
          `| ${deltaStr(app.bandShape, modeString(results.map((r) => r.bandShape)))} | ${deltaHex(app.bandColorHex, modeOrMedianHexColor(results.map((r) => r.bandColorHex)))} ` +
          `| ${deltaHex(app.bandEndColorHex, modeOrMedianHexColor(results.map((r) => r.bandEndColorHex)))} | ${deltaNum(app.spineCapPct, m((r) => r.spineCapPct))} | |`,
      );
    } else if (app) {
      lines.push(rowFor(app));
    }
    const detected = results.filter((r) => r.spineSource === 'detected').length;
    const estimated = results.filter((r) => r.spineSource === 'estimated').length;
    lines.push('');
    lines.push(`Fold lines detected from the image in ${detected}/${results.length}; estimated from a known spine width in ${estimated}/${results.length}.`);
    lines.push('');
  }

  return lines.join('\n');
}

/** How many logos per panel get their own columns. Further logos are counted in the Notes column. */
const LOGO_COLUMNS = 2;

interface BrandingColumn {
  header: string;
  get: (r: ImageResult, b: Branding) => number | string | null;
  kind: 'num' | 'str' | 'hex';
}

function bandColumns(prefix: string, panelW: string, panelH: string, pick: (b: Branding) => Band | null): BrandingColumn[] {
  const col = (name: string, kind: BrandingColumn['kind'], get: (band: Band) => number | string | null): BrandingColumn => ({
    header: `${prefix} ${name}`,
    kind,
    get: (_, b) => {
      const band = pick(b);
      return band ? get(band) : null;
    },
  });
  return [
    col('shape', 'str', (x) => x.shape),
    col(`width % ${panelW}`, 'num', (x) => x.widthPct),
    col(`height % ${panelH}`, 'num', (x) => x.heightPct),
    col(`min height % ${panelH}`, 'num', (x) => x.heightMinPct),
    col(`x % ${panelW}`, 'num', (x) => x.xPct),
    col(`y % ${panelH}`, 'num', (x) => x.yPct),
    col('colour', 'hex', (x) => x.hex),
    col('colour 2', 'hex', (x) => x.hex2),
    col('gradient', 'str', (x) => x.gradient),
    col(`border % ${panelH}`, 'num', (x) => x.borderPct),
    col('border colour', 'hex', (x) => x.borderHex),
  ];
}

function logoColumns(prefix: string, panelW: string, panelH: string, pick: (b: Branding) => Logo[]): BrandingColumn[] {
  return Array.from({ length: LOGO_COLUMNS }, (_, i): BrandingColumn[] => {
    const col = (name: string, kind: BrandingColumn['kind'], get: (logo: Logo) => number | string): BrandingColumn => ({
      header: `${prefix} logo ${i + 1} ${name}`,
      kind,
      get: (_, b) => {
        const logo = pick(b)[i];
        return logo ? get(logo) : null;
      },
    });
    return [
      col(`width % ${panelW}`, 'num', (l) => l.widthPct),
      col(`height % ${panelH}`, 'num', (l) => l.heightPct),
      col(`x % ${panelW}`, 'num', (l) => l.xPct),
      col(`y % ${panelH}`, 'num', (l) => l.yPct),
      col('colour', 'hex', (l) => l.hex),
    ];
  }).flat();
}

const BRANDING_COLUMNS: BrandingColumn[] = [
  { header: 'Spine source', get: (r) => r.spineSource, kind: 'str' },
  ...bandColumns('Front band', 'W', 'H', (b) => b.frontBand),
  ...logoColumns('Front', 'W', 'H', (b) => b.frontLogos),
  ...bandColumns('Spine band', 'S', 'L', (b) => b.spineBand),
  ...logoColumns('Spine', 'S', 'L', (b) => b.spineLogos),
];

/** The most frequent string if one wins outright, else the first seen. */
function modeString(values: (string | null)[]): string | null {
  const present = values.filter((v): v is string => v !== null);
  if (!present.length) return null;
  const counts = new Map<string, number>();
  for (const v of present) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** The whole of branding-spec.md: what is printed on the front header and spine, per folder, one column per
 * attribute so the Mode row can be taken column by column. */
function buildBrandingReport(groups: Map<string, ImageResult[]>): string {
  const lines: string[] = ['# Branding measurements', ''];
  lines.push(
    'Generated by `scripts/measure-covers.ts` from the images in `scans/` — the real scans and the fan-made `template.png` ' +
      'files together, the same rows as `scans-report.md`. Nothing here is hand-written: add scans and re-run to update it.',
  );
  lines.push('');
  lines.push(
    'Every panel is described the same way. A **band** is the solid coloured area that carries the logo: across the top of ' +
      'the front, or down the left edge for PS1 (a *strip*), and the coloured cap at the top of the spine. A **logo** is a ' +
      'group of printed marks on it, numbered left to right on the front and top to bottom on the spine. Sizes and positions ' +
      'are percentages of the panel they sit on — the front is **W** (width) by **H** (height), the spine is **S** (width) by ' +
      '**L** (length) — and position is the top-left corner, measured from the panel\'s top-left trim corner.',
  );
  lines.push('');
  lines.push(
    '- **shape**: `flat`, `sloped`, `arched` or `dipped` for a full-width band (how its lower edge runs), `tab` for a block covering only part of the width, `strip` for a vertical strip. Spine bands are `flat`.',
  );
  lines.push(
    '- **height / min height**: how far the band reaches down. They differ only when the lower edge is not flat: height is the deepest point, min height the shallowest (measured at 5%, 50% and 95% of the width). A spine band as tall as the spine (100) has the same colour along its whole length.',
  );
  lines.push('- **colour / colour 2 / gradient**: the band\'s colour, and for a gradient its other end, with the direction it runs (`horizontal` or `vertical`).');
  lines.push('- **border**: the thin line along the band\'s lower edge, as a height and a colour.');
  lines.push('- **logo colour**: the median colour of the logo\'s pixels.');
  lines.push('');
  lines.push(
    'Each table ends in one **Mode** row across every row in it, template included: the most frequent exact value where ' +
      'one value repeats and wins outright, otherwise the median. Detection is approximate: a logo touching the band\'s ' +
      "edge, a fold line that was estimated instead of detected (see Spine source), or artwork close to the band colour " +
      'can move a number. All colours are sRGB: an embedded ICC profile is converted to sRGB when the image is read (flagged in Notes), and an image with no profile is assumed to be sRGB already. ' +
      `Scans and templates whose DPI isn't exactly ${REQUIRED_DPI} are rejected, and images whose layout wasn't located have no row. ` +
      'If `npm run compare:covers` has been run, a table also shows `app (rendered)`, the app\'s own render of that case, and `app − Mode` (percentage points; `=`/`≠` for text; a colour distance, 0 to 441, for colours). It is never part of the Mode.',
  );
  lines.push('');

  const fmtCell = (v: number | string | null) => (v === null ? '—' : typeof v === 'number' ? v.toFixed(1) : v);
  for (const name of [...groups.keys()].sort()) {
    const rows = groups.get(name)!.filter((r) => r.branding && r.kind !== 'app');
    const app = groups.get(name)!.find((r) => r.kind === 'app' && r.branding);
    if (!rows.length && !app) continue;
    lines.push(`## ${name}  (n=${rows.length})`, '');
    lines.push(`| File | ${BRANDING_COLUMNS.map((c) => c.header).join(' | ')} | Notes |`);
    lines.push(`| :--- | ${BRANDING_COLUMNS.map(() => ':---').join(' | ')} | :--- |`);
    const brandingRow = (r: ImageResult) => {
      const b = r.branding!;
      const extra: string[] = r.notes.filter((n) => n.startsWith('Colour profile'));
      if (b.frontLogos.length > LOGO_COLUMNS) extra.push(`${b.frontLogos.length - LOGO_COLUMNS} more front logo(s) not shown`);
      if (b.spineLogos.length > LOGO_COLUMNS) extra.push(`${b.spineLogos.length - LOGO_COLUMNS} more spine logo(s) not shown`);
      return `| ${appLabel(r)} | ${BRANDING_COLUMNS.map((c) => fmtCell(c.get(r, b))).join(' | ')} | ${extra.join('; ')} |`;
    };
    for (const r of rows) lines.push(brandingRow(r));
    const summary = BRANDING_COLUMNS.map((c) => {
      const values = rows.map((r) => c.get(r, r.branding!));
      if (c.kind === 'num') return fmtCell(modeOrMedianOrNull(values as (number | null)[]));
      if (c.kind === 'hex') return modeOrMedianHexColor(values as (string | null)[]) ?? '—';
      return modeString(values as (string | null)[]) ?? '—';
    });
    if (rows.length) lines.push(`| **Mode** | ${summary.map((v) => `**${v}**`).join(' | ')} | |`);
    if (app) {
      lines.push(brandingRow(app));
      if (rows.length) {
        const delta = BRANDING_COLUMNS.map((c, i) => {
          const a = c.get(app, app.branding!);
          const m = summary[i] === '—' ? null : summary[i];
          if (c.kind === 'num') return deltaNum(a as number | null, m === null ? null : Number(m));
          if (c.kind === 'hex') return deltaHex(a as string | null, m);
          return deltaStr(a as string | null, m);
        });
        lines.push(`| *app − Mode* | ${delta.join(' | ')} | |`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) flags.set(args[i], args[++i]);
    else positional.push(args[i]);
  }
  const out = flags.get('--out') ?? DEFAULT_OUT;
  const brandingOut = flags.get('--branding-out') ?? DEFAULT_BRANDING_OUT;
  const source = positional[0] ?? DEFAULT_SOURCE;

  const files = findImages(source);
  if (!files.length) {
    console.error(`No images found under ${source}`);
    process.exit(1);
  }

  const isTemplate = (f: string) => basename(f).split('.')[0].toLowerCase() === TEMPLATE_BASENAME;
  const groups = new Map<string, ImageResult[]>();
  const add = (group: string, r: ImageResult) => groups.set(group, [...(groups.get(group) ?? []), r]);
  let rejected = 0;
  for (const file of files.filter((f) => !isTemplate(f))) {
    const group = basename(dirname(file));
    const result = await measure(file, group);
    if (result.dpiConfidence !== 'ok') {
      rejected++;
      console.error(`Rejected ${file}: DPI is ${result.dpi ?? 'missing'}, not ${REQUIRED_DPI}.`);
      continue;
    }
    add(group, result);
  }

  // Templates go last so each can be rescaled against its folder's scans if its DPI metadata is unusable.
  for (const file of files.filter(isTemplate)) {
    const group = basename(dirname(file));
    const density = (await sharp(file).metadata()).density;
    if (dpiConfidence(density).confidence !== 'ok') {
      rejected++;
      console.error(`Rejected ${file}: DPI is ${density ?? 'missing'}, not ${REQUIRED_DPI}.`);
      continue;
    }
    const scanWidth = modeOrMedianOrNull((groups.get(group) ?? []).map((r) => r.widthMm));
    const result = await measureTemplate(file, group, scanWidth);
    if (result.spineSource === 'none' && result.backMm === null && result.notes.some((n) => n.endsWith('skipped.'))) {
      console.error(`Skipped template ${file}: ${result.notes.join(' ')}`);
      continue;
    }
    add(group, result);
  }

  if (rejected) console.error(`Rejected ${rejected}/${files.length} file(s) for not being ${REQUIRED_DPI} DPI; left out of the report.`);

  // The app's own renders (scripts/compare-covers.ts), measured with their fold positions known.
  const appDir = flags.get('--app-dir') ?? DEFAULT_APP_DIR;
  const appGroups = existsSync(appDir) ? readdirSync(appDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  for (const group of appGroups) {
    const png = join(appDir, group, 'app.png');
    const meta = join(appDir, group, 'app.json');
    if (!existsSync(png) || !existsSync(meta)) continue;
    const { x1, x2, x3 } = JSON.parse(readFileSync(meta, 'utf8')) as { x1: number; x2: number; x3?: number };
    add(group, await measure(png, group, x3 === undefined ? [x1, x2] : [x1, x2, x3], 'app'));
  }

  const report = buildReport(groups);
  writeFileSync(out, report);
  console.error(`Wrote ${out}`);
  writeFileSync(brandingOut, buildBrandingReport(groups));
  console.error(`Wrote ${brandingOut}`);
}

export { measure, findImages };

// Run only when invoked directly, so scripts/compare-covers.ts can import measure().
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
