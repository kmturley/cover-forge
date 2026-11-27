/**
 * Checks that each template's 3D preview matches its 2D print: opens every template in the running dev server with a grid
 * test cover, screenshots the 2D sheet and the 3D model from fixed angles (front, rear, both sides, three corners, the
 * top and each top corner from above), and puts them side by side on one contact sheet per template. Gaps, stretching,
 * misaligned panels and artwork on the wrong face are easy to spot against the grid.
 *
 * It writes, under `compare/previews/` (git-ignored):
 *   <template>/2d.png, <template>/3d-<view>.png   the single captures
 *   <template>.png                                the contact sheet: the 2D sheet above, the 3D views below
 *   index.html                                    every contact sheet on one page, with any page errors
 *
 * Usage (with `npm run dev` running in another terminal):
 *   npm run check:previews                         # every template
 *   npm run check:previews -- minidisc cd-         # only templates whose id or name contains one of these
 *   npm run check:previews -- --list               # list the template ids and stop
 *   npm run check:previews -- --cover art.png      # use your own front cover instead of the grid
 *   npm run check:previews -- --views front,rear   # only these views (front, rear, left, right, front-left, rear-left, rear-right, top,
 *                                                  # top-front-left, top-front-right, top-rear-left, top-rear-right)
 *   npm run check:previews -- --scale 2            # capture at 2× pixel density, to zoom into corners
 *   npm run check:previews -- --url http://localhost:5174 --out /tmp/previews --jobs 1
 *
 * It needs Playwright, which is not a dependency of the app. If `import('playwright')` fails, install it once with
 * `npm i -D playwright && npx playwright install chromium`, or point PLAYWRIGHT_MODULE at an existing copy's index.mjs.
 * The camera is placed through a dev-only hook in src/three/PreviewScene.tsx (`window.__coverForge3D`), so it only works
 * against the dev server, not a production build.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { LIBRARY } from '../src/templates/library';

type Vec3 = [number, number, number];

/** Camera positions, at the preview's own scale (every model is normalised to the same size), looking at the centre. */
const R = 3.2;
const VIEWS: Record<string, Vec3> = {
  front: [0, 0, R],
  rear: [0, 0, -R],
  left: [-R, 0, 0],
  right: [R, 0, 0],
  'front-left': [-R * 0.7, 0.25, R * 0.7],
  'rear-left': [-R * 0.7, 0.25, -R * 0.7],
  'rear-right': [R * 0.7, 0.25, -R * 0.7],
  top: [0.001, R, 0.4],
  // From above each top corner, where the front, spines, back and the case's rounded edges meet: gaps and overhangs show here.
  'top-front-left': [-R * 0.5, R * 0.47, R * 0.6],
  'top-front-right': [R * 0.5, R * 0.47, R * 0.6],
  'top-rear-left': [-R * 0.5, R * 0.47, -R * 0.6],
  'top-rear-right': [R * 0.5, R * 0.47, -R * 0.6],
};

function parseArgs(argv: string[]) {
  const opts = { url: 'http://localhost:5173', out: 'compare/previews', cover: '', views: Object.keys(VIEWS), jobs: 2, scale: 1, list: false, filters: [] as string[] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--url') opts.url = next().replace(/\/$/, '');
    else if (a === '--out') opts.out = next();
    else if (a === '--cover') opts.cover = resolve(next());
    else if (a === '--views') opts.views = next().split(',').map((v) => v.trim()).filter(Boolean);
    else if (a === '--jobs') opts.jobs = Math.max(1, Number(next()) || 1);
    else if (a === '--scale') opts.scale = Math.min(4, Math.max(1, Number(next()) || 1));
    else if (a === '--list') opts.list = true;
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`);
    else opts.filters.push(a.toLowerCase());
  }
  const unknown = opts.views.filter((v) => !VIEWS[v]);
  if (unknown.length) throw new Error(`Unknown view(s): ${unknown.join(', ')}. Views: ${Object.keys(VIEWS).join(', ')}`);
  return opts;
}

/** A square cover with a 10 × 10 grid, thicker centre lines and a border, so offsets and stretching show at a glance. */
async function gridCover(file: string): Promise<void> {
  const S = 1000;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="100%" height="100%" fill="#f4d03f"/>`;
  for (let i = 0; i <= 10; i++) {
    const w = i % 5 ? 3 : 8;
    svg += `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="${S}" stroke="#c0392b" stroke-width="${w}"/>`;
    svg += `<line x1="0" y1="${i * 100}" x2="${S}" y2="${i * 100}" stroke="#2471a3" stroke-width="${w}"/>`;
  }
  svg += `<rect x="4" y="4" width="${S - 8}" height="${S - 8}" fill="none" stroke="#000" stroke-width="8"/>`;
  svg += `<text x="500" y="545" font-size="140" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold">GRID</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPlaywright(): Promise<any> {
  try {
    return await import('playwright');
  } catch {
    const path = process.env.PLAYWRIGHT_MODULE;
    if (path) return import(path);
    throw new Error('Playwright not found. Install it with `npm i -D playwright && npx playwright install chromium`, or set PLAYWRIGHT_MODULE to its index.mjs.');
  }
}

const png = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const entries = LIBRARY.filter((e) => !opts.filters.length || opts.filters.some((f) => e.id.toLowerCase().includes(f) || e.name.toLowerCase().includes(f)));
  if (opts.list) {
    for (const e of LIBRARY) console.log(`${e.id.padEnd(28)} ${e.name}`);
    return;
  }
  if (!entries.length) throw new Error(`No templates match ${opts.filters.join(', ')}. Try --list.`);

  const out = resolve(opts.out);
  mkdirSync(out, { recursive: true });
  const cover = opts.cover || join(out, 'grid-cover.png');
  if (!opts.cover) await gridCover(cover);

  const res = await fetch(opts.url).catch(() => null);
  if (!res?.ok) throw new Error(`No dev server at ${opts.url}. Start it with \`npm run dev\` (or pass --url).`);

  const { chromium } = await loadPlaywright();
  // SwiftShader gives headless Chromium WebGL without a GPU.
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = new Map<string, { id: string; name: string; errors: string[] }>();

  /** Captures one template; returns what went wrong (page errors, or the step that timed out), empty if all went well. */
  async function check(entry: (typeof LIBRARY)[number]): Promise<string[]> {
    const dir = join(out, entry.id);
    mkdirSync(dir, { recursive: true });
    const errors: string[] = [];
    // A fresh context each time: no queue or settings carried over from the last template.
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: opts.scale });
    const page = await context.newPage();
    // Software WebGL is slow, more so with several pages at once: allow longer than Playwright's 30 s per step.
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e: Error) => errors.push(e.message));
    page.on('console', (m: { type(): string; text(): string }) => {
      if (m.type() === 'error' && !/GPU stall/.test(m.text())) errors.push(m.text());
    });
    try {
      await page.goto(`${opts.url}/?template=${encodeURIComponent(entry.id)}&view=3d`);
      await page.getByText('Not found? Add your own').click();
      await page.locator('.custom-entry input[type=text]').first().fill('Grid Test');
      await page.locator('input[aria-label="Front cover image"]').setInputFiles(cover);
      await page.locator('.custom-entry button[type=submit]').click();
      await page.waitForFunction(() => 'setCamera' in ((window as unknown as { __coverForge3D?: object }).__coverForge3D ?? {}), null, { timeout: 15000 });
      // Artwork and images load after the model appears.
      await page.waitForTimeout(2500);
      for (const view of opts.views) {
        await page.evaluate((p: Vec3) => (window as unknown as { __coverForge3D: { setCamera(p: Vec3): void } }).__coverForge3D.setCamera(p), VIEWS[view]);
        await page.waitForTimeout(500);
        await page.locator('.three-wrap').screenshot({ path: join(dir, `3d-${view}.png`) });
      }
      await page.getByRole('button', { name: '2D', exact: true }).first().click();
      await page.locator('.viewport .editor-canvas').first().waitFor({ state: 'attached' });
      await page.waitForTimeout(1500);
      await page.locator('.viewport').screenshot({ path: join(dir, '2d.png') });

      const html = `<body style="margin:0;background:#22252b;color:#e6e6e6;font:14px system-ui,sans-serif">
        <h2 style="margin:10px 12px 4px;font-size:18px">${esc(entry.name)} <span style="color:#9aa0a6;font-weight:400">${esc(entry.id)} · ${esc(entry.caseLabel)} · ${esc(entry.detail)}</span></h2>
        <div style="padding:4px 12px"><div style="color:#9aa0a6">2D</div><img src="${png(join(dir, '2d.png'))}" style="max-width:1780px;max-height:700px"></div>
        <div style="display:grid;grid-template-columns:repeat(4,440px);gap:8px;padding:8px 12px">
        ${opts.views.map((v) => `<div><div style="color:#9aa0a6">3D ${v}</div><img src="${png(join(dir, `3d-${v}.png`))}" style="width:440px"></div>`).join('')}
        </div></body>`;
      const sheet = await context.newPage();
      await sheet.setViewportSize({ width: 1800, height: 800 });
      await sheet.setContent(html);
      await sheet.screenshot({ path: join(out, `${entry.id}.png`), fullPage: true });
    } catch (e) {
      errors.push(`check failed: ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
    return errors;
  }
  const record = (entry: (typeof LIBRARY)[number], errors: string[], note = '') => {
    results.set(entry.id, { id: entry.id, name: entry.name, errors });
    console.log(`${errors.length ? '✗' : '✓'} ${entry.id}${note}${errors.length ? `  (${errors[0]})` : ''}`);
  };

  const queue = [...entries];
  const timedOut: (typeof LIBRARY)[number][] = [];
  await Promise.all(Array.from({ length: Math.min(opts.jobs, queue.length) }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const errors = await check(e);
      // A step that timed out is usually the machine being busy: tried again on its own at the end.
      if (opts.jobs > 1 && errors.some((m) => m.startsWith('check failed') && /Timeout|not ready/.test(m))) timedOut.push(e);
      else record(e, errors);
    }
  }));
  for (const e of timedOut) record(e, await check(e), ' (retried alone)');
  await browser.close();

  const ordered = entries.map((e) => results.get(e.id)).filter((r) => r !== undefined);
  const index = `<!doctype html><meta charset="utf-8"><title>2D vs 3D previews</title>
    <body style="margin:0;padding:16px;background:#1b1d22;color:#e6e6e6;font:14px system-ui,sans-serif">
    <h1 style="font-size:20px">2D vs 3D previews (${ordered.length})</h1>
    <p>${ordered.map((r) => `<a style="color:#8ab4f8;margin-right:10px" href="#${esc(r.id)}">${esc(r.id)}</a>`).join('')}</p>
    ${ordered.map((r) => `<section id="${esc(r.id)}" style="margin:24px 0"><h2 style="font-size:16px">${esc(r.name)} <code>${esc(r.id)}</code></h2>
      ${r.errors.length ? `<pre style="color:#f28b82;white-space:pre-wrap">${esc(r.errors.join('\n'))}</pre>` : ''}
      <img src="${esc(r.id)}.png" style="max-width:100%" loading="lazy"></section>`).join('')}</body>`;
  writeFileSync(join(out, 'index.html'), index);
  const failed = ordered.filter((r) => r.errors.length);
  console.log(`\n${ordered.length} templates checked, ${failed.length} with errors. Open ${join(out, 'index.html')}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
