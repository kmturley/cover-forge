/**
 * Renders the app's own cover for each platform that has scans, and compares it with the real scans and the fan-made
 * template, so differences between what the app draws and what retail covers look like can be seen without opening
 * the app and the images separately.
 *
 * For every folder under `scans/` that matches a game-case template it writes, under `compare/` (git-ignored):
 *   <platform>/app.png        the app's render (Branded on, no artwork), cropped to trim, 300 DPI
 *   <platform>/app.json       where its back|spine and spine|front folds are, in pixels
 *   <platform>.png            header and spine area, stacked: app, template, then an overlay of the app against the
 *                             template (red = only the app prints it, cyan = only the template does, yellow = both
 *                             print but in different colours, e.g. a logo in the wrong place or size). With --scans,
 *                             each scan follows too.
 *   <platform>-full.png       the whole wrap of each of those, in a grid
 * then re-runs scripts/measure-covers.ts, which finds `compare/<platform>/app.json` and adds an `app (rendered)` row
 * and an `app − Mode` row to scans-report.md and branding-spec.md, measured with the same code as the scans.
 *
 * Usage:
 *   npm run compare:covers                  # every platform
 *   npm run compare:covers -- ps4 wii       # only these folders
 *   npm run compare:covers -- --scans       # also put each real scan in the images (slower, larger files)
 *   npm run compare:covers -- --no-reports  # images only; don't refresh the two reports
 *
 * By default the images hold only the app render, the template and their overlay: that is what the app is meant to
 * match, it is quick, and the files stay small. The reports still measure the app against the scans' Mode either way.
 *
 * The render is the app's real `renderCover`, run in Node with a Skia canvas (@napi-rs/canvas) rather than a browser.
 * Shapes, gradients and brand icons are exact; text (the "Wii U" / "NINTENDO" wordmarks and so on) is laid out by
 * Skia with whatever Helvetica this machine has, so its width can differ a little from Chrome's.
 */
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { renderCover } from '../src/engine/CanvasRenderer.ts';
import { BASE_BACKGROUND } from '../src/engine/resolve.ts';
import { buildTemplateById, canvasSizePx, variantsFor } from '../src/templates/index.ts';
import type { TemplateConfig } from '../src/types/template.ts';

(globalThis as { Path2D?: unknown }).Path2D = Path2D;

const SCANS = 'scans';
const OUT = 'compare';
const IMAGE_EXTS = /\.(jpe?g|png|tiff?|webp)$/i;
/** Scan folder names that differ from the app's variant id. */
const FOLDER_TO_VARIANT: Record<string, string> = { wiiu: 'wii-u', psvita: 'ps-vita', xbox360: 'xbox-360', xboxone: 'xbox-one', xboxseriesx: 'xbox-series' };
/** How much of the wrap's height the stacked strip shows: the header, spine cap and logos. */
const STRIP_FRACTION = 0.4;
const ROW_WIDTH = 1800;
const LABEL_H = 26;

const shared = { panels: {}, spine: { fontFamily: 'Helvetica, Arial, sans-serif', color: '#ffffff' } };

interface Source {
  label: string;
  /** PNG, RGBA, at the app wrap's pixel size; a template keeps its transparency. */
  png: Buffer;
}

/** The app's wrap laid out like a scan: panels side by side, bleed cropped away. A jewel case's tray card and
 * booklet are separate pieces in the app, so they are placed in the order the scans use. */
function renderAppWrap(t: TemplateConfig): { png: Buffer; width: number; height: number; x1: number; x2: number; x3?: number } {
  const { width, height } = canvasSizePx(t);
  const full = createCanvas(width, height);
  renderCover(full.getContext('2d') as unknown as CanvasRenderingContext2D, { template: t, item: null, shared, banner: true, showGuides: false } as never, t.dpiScale);

  const byId = new Map(t.panels.map((p) => [p.id, p]));
  const order = (t.variantId === 'ps1' ? ['spine', 'back', 'spineRight', 'front'] : ['back', 'spine', 'front']).map((id) => byId.get(id as never)!);
  const px = t.dpiScale;
  const wrapW = Math.round(order.reduce((s, p) => s + p.widthMm * px, 0));
  const wrapH = Math.round(Math.max(...order.map((p) => p.heightMm * px)));
  const wrap = createCanvas(wrapW, wrapH);
  const wctx = wrap.getContext('2d');
  let x = 0;
  let x1 = 0;
  let x2 = 0;
  let x3 = 0;
  order.forEach((p, i) => {
    const sw = Math.round(p.widthMm * px);
    wctx.drawImage(full, Math.round(p.xMm * px), Math.round(p.yMm * px), sw, Math.round(p.heightMm * px), x, 0, sw, Math.round(p.heightMm * px));
    x += sw;
    if (i === 0) x1 = x;
    if (i === 1) x2 = x;
    if (i === 2) x3 = x;
  });
  return { png: wrap.toBuffer('image/png'), width: wrapW, height: wrapH, x1, x2, x3: t.variantId === 'ps1' ? x3 : undefined };
}

/** A scan or template resized onto the app wrap's pixel grid (a few mm of size difference becomes a slight stretch). */
const fit = (file: string, width: number, height: number): Promise<Buffer> =>
  sharp(file, { limitInputPixels: false }).resize(width, height, { fit: 'fill' }).ensureAlpha().png().toBuffer();

/** Red where only the app prints, cyan where only the template does, yellow where both print but in different colours
 * (a logo in the wrong place or size shows up here), dark grey where both print the same. */
async function overlay(app: Buffer, template: Buffer, width: number, height: number): Promise<{ png: Buffer; score: Score }> {
  const a = await sharp(app).ensureAlpha().raw().toBuffer();
  const t = await sharp(template).ensureAlpha().raw().toBuffer();
  const bg = parseInt(BASE_BACKGROUND.replace('#', ''), 16);
  const [br, bgc, bb] = [(bg >> 16) & 255, (bg >> 8) & 255, bg & 255];
  const out = Buffer.alloc(width * height * 3);
  const score: Score = { onlyApp: 0, onlyTemplate: 0, differs: 0, same: 0 };
  // Only the header and spine cap area is branding: the top STRIP_FRACTION of the wrap.
  const rows = Math.round(height * STRIP_FRACTION);
  for (let i = 0; i < width * height; i++) {
    const appPrints = Math.abs(a[i * 4] - br) + Math.abs(a[i * 4 + 1] - bgc) + Math.abs(a[i * 4 + 2] - bb) > 40;
    const tplPrints = t[i * 4 + 3] > 128;
    const differs = Math.abs(a[i * 4] - t[i * 4]) + Math.abs(a[i * 4 + 1] - t[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - t[i * 4 + 2]) > 150;
    if (i < width * rows) {
      if (appPrints && tplPrints) score[differs ? 'differs' : 'same']++;
      else if (appPrints) score.onlyApp++;
      else if (tplPrints) score.onlyTemplate++;
    }
    const [r, g, b] = appPrints && tplPrints ? (differs ? [255, 215, 0] : [90, 90, 90]) : appPrints ? [255, 60, 60] : tplPrints ? [60, 200, 255] : [24, 24, 24];
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return { png: await sharp(out, { raw: { width, height, channels: 3 } }).png().toBuffer(), score };
}

/** Pixel counts over the branding area; `match` is the share of everything either side prints that agrees. */
interface Score { onlyApp: number; onlyTemplate: number; differs: number; same: number }
const matchPct = (s: Score) => (100 * s.same) / Math.max(1, s.same + s.differs + s.onlyApp + s.onlyTemplate);

async function strip(source: { label: string; png: Buffer }, width: number, height: number, rowH: number, canvasW: number) {
  const img = await loadImage(await sharp(source.png).flatten({ background: '#808080' }).resize(canvasW, Math.round((height * canvasW) / width)).png().toBuffer());
  return { label: source.label, img, rowH };
}

/** Full-resolution crops of the front header (left and right halves) and the top of the spine, for pixel-level checks:
 * app, template and overlay one above the other for the header, side by side for the spine. */
async function zoom(folder: string, app: { png: Buffer; width: number; height: number; x1: number; x2: number; x3?: number }, template: Buffer, overlayPng: Buffer): Promise<void> {
  const flat = (b: Buffer) => sharp(b).flatten({ background: '#808080' }).png().toBuffer();
  const sources = [await flat(app.png), await flat(template), overlayPng];
  // A jewel case wraps as spine | back | spine | front: the front starts at the third fold and the first spine is 0..x1.
  const frontStart = app.x3 ?? app.x2;
  const spineLeft = app.x3 ? 0 : app.x1;
  const frontW = app.width - frontStart;
  const headH = Math.round(app.height * 0.16);
  const crop = async (b: Buffer, left: number, width: number, height: number, scale: number) =>
    loadImage(await sharp(b).extract({ left, top: 0, width, height }).resize(Math.round(width * scale), Math.round(height * scale), { kernel: 'lanczos3' }).png().toBuffer());
  const halves = [Math.round(frontW / 2), frontW - Math.round(frontW / 2)];
  const scale = 1800 / halves[0];
  const rowH = Math.round(headH * scale);
  const spineW = app.x3 ? app.x1 : app.x2 - app.x1;
  const spineH = Math.round(app.height * 0.3);
  const spineScale = (rowH * 3 + 4 * LABEL_H) / spineH;
  const headW = 1800;
  const sw = Math.round(spineW * spineScale);
  const canvas = createCanvas(headW + sw * 3 + 20, 2 * (3 * rowH + 3 * LABEL_H) + 12);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '15px Helvetica, Arial, sans-serif';
  const names = ['app', 'template', 'overlay'];
  for (let h = 0; h < 2; h++) {
    const left = h === 0 ? frontStart : frontStart + halves[0];
    for (let r = 0; r < 3; r++) {
      const y = h * (3 * rowH + 3 * LABEL_H + 12) + r * (rowH + LABEL_H);
      ctx.fillStyle = '#222';
      ctx.fillRect(0, y, headW, LABEL_H);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${names[r]} - front ${h === 0 ? 'left' : 'right'} half`, 8, y + 18);
      ctx.drawImage(await crop(sources[r], left, halves[h], headH, scale), 0, y + LABEL_H);
    }
  }
  for (let r = 0; r < 3; r++) {
    const x = headW + 10 + r * sw;
    ctx.fillStyle = '#fff';
    ctx.fillText(names[r], x + 4, 18);
    ctx.drawImage(await crop(sources[r], spineLeft, spineW, spineH, spineScale), x, LABEL_H);
  }
  writeFileSync(join(OUT, `${folder}-zoom.png`), canvas.toBuffer('image/png'));
}

async function compare(folder: string, includeScans: boolean): Promise<void> {
  const variant = FOLDER_TO_VARIANT[folder] ?? folder;
  const t = buildTemplateById(`game-case-${variant}`);
  const files = readdirSync(join(SCANS, folder)).filter((f) => IMAGE_EXTS.test(f));
  const templateFile = files.find((f) => /^template\./i.test(f));
  const scanFiles = includeScans ? files.filter((f) => f !== templateFile).sort() : [];

  const app = renderAppWrap(t);
  mkdirSync(join(OUT, folder), { recursive: true });
  await sharp(app.png).withMetadata({ density: 300 }).png().toFile(join(OUT, folder, 'app.png'));
  writeFileSync(join(OUT, folder, 'app.json'), JSON.stringify({ x1: app.x1, x2: app.x2, x3: app.x3 }));

  const sources: Source[] = [{ label: `app (rendered)  ${t.name}`, png: app.png }];
  let templatePng: Buffer | null = null;
  if (templateFile) {
    templatePng = await fit(join(SCANS, folder, templateFile), app.width, app.height);
    sources.push({ label: 'template (fan-made)', png: templatePng });
  }
  for (const f of scanFiles) sources.push({ label: f, png: await fit(join(SCANS, folder, f), app.width, app.height) });

  // Stacked header strips.
  const rows = await Promise.all(sources.map((s) => strip(s, app.width, app.height, 0, ROW_WIDTH)));
  const diff = templatePng ? await overlay(app.png, templatePng, app.width, app.height) : null;
  const diffRow = diff ? await strip({ label: 'overlay: red = only the app prints, cyan = only the template prints, yellow = both print but differ, grey = same', png: diff.png }, app.width, app.height, 0, ROW_WIDTH) : null;
  if (diff) console.error(`${folder}: match ${matchPct(diff.score).toFixed(1)}% (only app ${diff.score.onlyApp}, only template ${diff.score.onlyTemplate}, colour differs ${diff.score.differs})`);
  const all = diffRow ? [...rows.slice(0, 2), diffRow, ...rows.slice(2)] : rows;
  const rowImgH = Math.round(all[0].img.height * STRIP_FRACTION);
  const canvas = createCanvas(ROW_WIDTH, all.length * (rowImgH + LABEL_H));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  all.forEach((r, i) => {
    const y = i * (rowImgH + LABEL_H);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, y, ROW_WIDTH, LABEL_H);
    ctx.fillStyle = '#fff';
    ctx.font = '15px Helvetica, Arial, sans-serif';
    ctx.fillText(r.label, 8, y + 18);
    ctx.drawImage(r.img, 0, 0, r.img.width, rowImgH, 0, y + LABEL_H, ROW_WIDTH, rowImgH);
  });
  writeFileSync(join(OUT, `${folder}.png`), canvas.toBuffer('image/png'));

  // Whole wraps in a grid, two across.
  const cellW = 1000;
  const cellImgH = Math.round((app.height * cellW) / app.width);
  const cols = 2;
  const full = createCanvas(cols * cellW, Math.ceil(rows.length / cols) * (cellImgH + LABEL_H));
  const fctx = full.getContext('2d');
  fctx.fillStyle = '#111';
  fctx.fillRect(0, 0, full.width, full.height);
  for (const [i, s] of sources.entries()) {
    const img = await loadImage(await sharp(s.png).flatten({ background: '#808080' }).resize(cellW, cellImgH).png().toBuffer());
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * (cellImgH + LABEL_H);
    fctx.fillStyle = '#222';
    fctx.fillRect(x, y, cellW, LABEL_H);
    fctx.fillStyle = '#fff';
    fctx.font = '15px Helvetica, Arial, sans-serif';
    fctx.fillText(s.label, x + 8, y + 18);
    fctx.drawImage(img, x, y + LABEL_H);
  }
  writeFileSync(join(OUT, `${folder}-full.png`), full.toBuffer('image/png'));
  if (diff && templatePng) await zoom(folder, app, templatePng, diff.png);
  console.error(`${folder}: app vs ${sources.length - 1} image(s) -> ${join(OUT, `${folder}.png`)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  const refresh = !args.includes('--no-reports');
  const includeScans = args.includes('--scans');
  const known = new Set(variantsFor('game-case').map((v) => v.id));
  const folders = readdirSync(SCANS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (only.length === 0 || only.includes(d.name)))
    .map((d) => d.name)
    .sort();

  mkdirSync(OUT, { recursive: true });
  for (const folder of folders) {
    if (!known.has(FOLDER_TO_VARIANT[folder] ?? folder)) {
      console.error(`${folder}: no matching game-case template in the app, skipped.`);
      continue;
    }
    await compare(folder, includeScans);
  }
  if (refresh && existsSync(OUT)) execFileSync(process.execPath, ['--import', 'tsx', 'scripts/measure-covers.ts'], { stdio: 'inherit' }); // same runner as npm run measure:covers
}

await main();
