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
 *   node scripts/measure-covers.ts scans --out case-scan-report.md
 *   node scripts/measure-covers.ts "scans/**\/*.jpg" --out case-scan-report.md
 *
 * Source defaults to `./scans` and `--out` defaults to `scans-report.md` when omitted.
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
import { statSync, globSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import sharp from 'sharp';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp']);
const MM_PER_INCH = 25.4;
const DEFAULT_SOURCE = './scans';
const DEFAULT_OUT = 'scans-report.md';
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

type DpiConfidence = 'ok' | 'wrong' | 'missing';

interface ImageResult {
  file: string;
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
  spineSource: 'detected' | 'estimated' | 'none';
  bandHeightPct: number | null;
  bandShape: 'flat' | 'gradient' | 'none';
  bandColorHex: string | null;
  bandEndColorHex: string | null;
  spineCapPct: number | null;
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
      const bottomColor = rowMedianColor(img, x0, x1, row - 1);
      const shape = colorDistance(topColor, bottomColor) > GRADIENT_DRIFT_THRESHOLD ? 'gradient' : 'flat';
      return { row, shape, colorHex: colorToHex(topColor), endColorHex: colorToHex(bottomColor) };
    }
    prevColor = color;
  }
  return null;
}

/** Median colour across a group's per-image band colours, computed per channel (not by averaging hex
 * strings), consistent with every other median in this file. */
function medianHexColor(hexes: (string | null)[]): string | null {
  const parsed = hexes.filter((h): h is string => h !== null).map((h): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
  if (!parsed.length) return null;
  return colorToHex([median(parsed.map((c) => c[0])), median(parsed.map((c) => c[1])), median(parsed.map((c) => c[2]))]);
}

async function measure(file: string, group: string): Promise<ImageResult> {
  const image = sharp(file);
  const meta = await image.metadata();
  const widthPx = meta.width!;
  const heightPx = meta.height!;
  const { dpi, confidence } = dpiConfidence(meta.density);

  const notes: string[] = [];
  if (confidence !== 'ok') {
    notes.push(`DPI is ${meta.density ?? 'missing'}, not ${REQUIRED_DPI}; rejected.`);
  }

  const toMm = (px: number) => (dpi ? (px / dpi) * MM_PER_INCH : null);
  const result: ImageResult = {
    file,
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
    const [x1, x2, x3] = findJewelCaseSeams(gray, img.width, img.height, dpi);
    result.spineSource = 'estimated';
    notes.push(
      `Jewel case (spine | back | spine | front): seams refined from ${group}'s known CD/PS1 tray-card proportions (case-research.md) by searching nearby for the nearest real edge, not detected outright.`,
    );
    result.spineMm = toMm(x1);
    result.backMm = toMm(x2 - x1);
    result.spine2Mm = toMm(x3 - x2);
    result.frontMm = toMm(img.width - x3);

    // Not attempted: branding-spec.md documents PS1's branding as a vertical strip on the LEFT edge of the
    // front cover (15.5% W), not a horizontal band at the top like PS3/4/5 — findHeaderBand looks for the
    // wrong shape on the wrong axis here, and would also be reading the one region (the front's right
    // side) deliberately cropped to avoid a left-aligned mark on every other case.
    notes.push("Header band not checked: PS1's branding is a vertical left-edge strip (branding-spec.md), not a horizontal top band.");
    return result;
  }

  const gray = toGray(img);
  let fold = findFoldLines(gray, img.width, img.height);
  if (fold) {
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
  const band = findHeaderBand(img, x2 + Math.round((img.width - x2) * 0.6), img.width);
  if (band) {
    result.bandHeightPct = (100 * band.row) / img.height;
    result.bandShape = band.shape;
    result.bandColorHex = band.colorHex;
    result.bandEndColorHex = band.shape === 'gradient' ? band.endColorHex : null;
  } else {
    notes.push('No header band detected on the front panel (may be sloped/curved, or none).');
  }

  const spineCap = findHeaderBand(img, x1, x2, 0.3);
  if (spineCap) result.spineCapPct = (100 * spineCap.row) / img.height;

  return result;
}

const fmt = (v: number | null, digits = 1) => (v === null ? '—' : v.toFixed(digits));
const medianOrNull = (values: (number | null)[]) => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? median(present) : null;
};

function buildReport(groups: Map<string, ImageResult[]>): string {
  const lines: string[] = ['# Cover scan measurements', ''];
  lines.push(
    "Generated by `scripts/measure-covers.ts`. Assumes each source image is a single, " +
      'pre-cropped full wrap (back | spine | front) with no border beyond the trim edge. ' +
      'Fold lines are found by edge detection, not assumed; header bands are detected as either ' +
      'a flat colour or a smooth vertical gradient (by where real cover art/photo texture starts, ' +
      "not by colour alone) — sloped/curved headers still need a follow-up pass. " +
      `Files whose embedded DPI isn't exactly ${REQUIRED_DPI} are rejected outright and don't appear below (see stderr).`,
  );
  lines.push('');

  for (const name of [...groups.keys()].sort()) {
    const results = groups.get(name)!;
    lines.push(`## ${name}  (n=${results.length})`);
    lines.push('');
    lines.push(
      '| File | DPI | Width mm | Height mm | Back mm | Spine mm | Spine 2 mm | Front mm | Spine source | Band % H | Band shape | Band colour | Band end colour | Spine cap % L | Notes |',
    );
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const r of results) {
      lines.push(
        `| ${basename(r.file)} | ${r.dpi ? r.dpi.toFixed(0) : '—'} | ${fmt(r.widthMm)} | ${fmt(r.heightMm)} ` +
          `| ${fmt(r.backMm)} | ${fmt(r.spineMm)} | ${fmt(r.spine2Mm)} | ${fmt(r.frontMm)} | ${r.spineSource} | ${fmt(r.bandHeightPct)} ` +
          `| ${r.bandShape} | ${r.bandColorHex ?? '—'} | ${r.bandEndColorHex ?? '—'} | ${fmt(r.spineCapPct)} | ${r.notes.join('; ')} |`,
      );
    }
    lines.push(
      `| **Median** | | **${fmt(medianOrNull(results.map((r) => r.widthMm)))}** ` +
        `| **${fmt(medianOrNull(results.map((r) => r.heightMm)))}** ` +
        `| **${fmt(medianOrNull(results.map((r) => r.backMm)))}** ` +
        `| **${fmt(medianOrNull(results.map((r) => r.spineMm)))}** ` +
        `| **${fmt(medianOrNull(results.map((r) => r.spine2Mm)))}** ` +
        `| **${fmt(medianOrNull(results.map((r) => r.frontMm)))}** | ` +
        `| **${fmt(medianOrNull(results.map((r) => r.bandHeightPct)))}** | | ` +
        `**${medianHexColor(results.map((r) => r.bandColorHex)) ?? '—'}** ` +
        `| **${medianHexColor(results.map((r) => r.bandEndColorHex)) ?? '—'}** ` +
        `| **${fmt(medianOrNull(results.map((r) => r.spineCapPct)))}** | |`,
    );
    const detected = results.filter((r) => r.spineSource === 'detected').length;
    const estimated = results.filter((r) => r.spineSource === 'estimated').length;
    lines.push('');
    lines.push(`Fold lines detected from the image in ${detected}/${results.length}; estimated from a known spine width in ${estimated}/${results.length}.`);
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : DEFAULT_OUT;
  const source = args.filter((a, i) => a !== '--out' && i !== outIdx + 1)[0] ?? DEFAULT_SOURCE;

  const files = findImages(source);
  if (!files.length) {
    console.error(`No images found under ${source}`);
    process.exit(1);
  }

  const groups = new Map<string, ImageResult[]>();
  let rejected = 0;
  for (const file of files) {
    const group = basename(dirname(file));
    const result = await measure(file, group);
    if (result.dpiConfidence !== 'ok') {
      rejected++;
      console.error(`Rejected ${file}: DPI is ${result.dpi ?? 'missing'}, not ${REQUIRED_DPI}.`);
      continue;
    }
    groups.set(group, [...(groups.get(group) ?? []), result]);
  }
  if (rejected) console.error(`Rejected ${rejected}/${files.length} file(s) for not being ${REQUIRED_DPI} DPI; left out of the report.`);

  const report = buildReport(groups);
  writeFileSync(out, report);
  console.error(`Wrote ${out}`);
}

main();
