/**
 * Checks the Branded trade dress on every case and piece (insert, slipcover, box), each with its own dress and with every
 * platform's dress on it: about 3,000 combinations.
 *
 *   npm run check:dress                  # brand marks that overlap, run off their panel, cross a spine cap's edge or
 *                                        # run into the spine title
 *   npm run check:dress -- --against main
 *                                        # which combinations draw differently from that git ref (a branch, a commit):
 *                                        # renders the dress alone at both and lists every combination that changed
 *
 * Overlaps a dress means are left out: a ® or ™ set against its logo, the pieces of one logo drawn as several marks (the
 * Game Boy Advance's), and marks whose boxes only touch (under 1 mm deep). What is left is worth a look, not necessarily wrong: a long title can stop short of a
 * logo at the far end of its spine, for example. Run from the repo root.
 */
import { createCanvas } from '@napi-rs/canvas';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, symlinkSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import '../src/engine/regression/render';
import { LIBRARY, piecesOf } from '../src/templates/library';
import { buildTemplateById } from '../src/templates';
import { GAME_CASE_BRANDING, brandingOf, pinnedSpine, type Lockup, type Part } from '../src/engine/official';
import { drawOfficial } from '../src/engine/branding';
import { brandedLayers, setTextMeasurer } from '../src/engine/layers/branded';
import { placementToBox } from '../src/engine/layers/placement';
import { boxRect } from '../src/engine/box';
import type { TemplateConfig } from '../src/types/template';

const measure = createCanvas(10, 10).getContext('2d');
setTextMeasurer((text, font, spacing) => {
  measure.font = font;
  if ('letterSpacing' in measure) (measure as unknown as { letterSpacing: string }).letterSpacing = spacing;
  return measure.measureText(text).width;
});

/** Every case and piece × its own dress and every platform's (a platform's own case only once). */
function* combinations(): Generator<{ name: string; t: TemplateConfig }> {
  const ids = [...new Set(LIBRARY.flatMap((e) => [e.id, ...Object.values(piecesOf(e.id)).filter((x): x is string => !!x)]))];
  for (const id of ids) {
    const base = buildTemplateById(id);
    yield { name: `${id} (own)`, t: base };
    for (const dress of Object.keys(GAME_CASE_BRANDING)) {
      if (base.kind === 'game-case' && base.variantId === dress) continue;
      yield { name: `${id} ${dress}`, t: { ...base, dress } };
    }
  }
}

/** The logos a lockup draws. */
const logosOf = (m: Lockup): string[] => {
  const walk = (parts: Part[]): string[] => parts.flatMap((p) => ('row' in p ? walk(p.row) : 'stack' in p ? walk(p.stack) : 'logo' in p ? [p.logo] : 'brand' in p ? [p.brand] : []));
  return walk(m.parts);
};

type Rect = { x0: number; y0: number; x1: number; y1: number };
const TOL = 0.3;

function check(name: string, t: TemplateConfig): string[] {
  const out: string[] = [];
  const b = brandingOf(t);
  const { layers, patches } = brandedLayers(t);
  const marks = new Map<string, { id: string; r: Rect; tag: boolean; logos: string[] }[]>();
  for (const l of layers) {
    const n = /\.mark-(\d+)$/.exec(l.id);
    if (!n || !l.placement || !('x' in l.placement)) continue;
    const p = t.panels.find((q) => q.id === l.target)!;
    const rect = boxRect(p, placementToBox(p, l.placement as never));
    const [cx, cy] = [rect.xMm + rect.widthMm / 2, rect.yMm + rect.heightMm / 2];
    const turned = Math.abs(Math.round(l.rotationDeg / 90)) % 2 === 1;
    const [w, h] = turned ? [rect.heightMm, rect.widthMm] : [rect.widthMm, rect.heightMm];
    const r = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    // The mark it was drawn from: the front's, or the spine's as pinned to this one.
    const along = p.text === 'vertical' ? p.heightMm : p.widthMm;
    const list = p.text ? pinnedSpine(b, along, p.text === 'vertical' ? p.widthMm : p.heightMm)?.marks : p.id === 'front' ? b.front.marks : b.back;
    const src = list?.[Number(n[1]) - 1];
    if (r.x0 < p.xMm - TOL || r.y0 < p.yMm - TOL || r.x1 > p.xMm + p.widthMm + TOL || r.y1 > p.yMm + p.heightMm + TOL) out.push(`${name}: ${l.id} runs off the ${p.id} trim`);
    const fit = (patches[`${p.id}.text`] as { spineFit?: { startMm: number } } | undefined)?.spineFit;
    if (fit && p.text) {
      const start = p.text === 'vertical' ? r.y0 - p.yMm : r.x0 - p.xMm;
      const end = p.text === 'vertical' ? r.y1 - p.yMm : r.x1 - p.xMm;
      // Only a mark that begins before the title does; one at the spine's far end is past the title's room, not in it.
      if (start < fit.startMm && end > fit.startMm + TOL) out.push(`${name}: ${l.id} runs ${(end - fit.startMm).toFixed(1)} mm into the ${p.id} title`);
    }
    const cap = layers.find((c) => c.id === `branded.${p.id}.cap` && c.placement && 'x' in c.placement);
    if (cap && p.text === 'vertical') {
      const cr = boxRect(p, placementToBox(p, cap.placement as never));
      const edge = cr.yMm + cr.heightMm;
      if (r.y0 < edge - TOL && r.y1 > edge + TOL) out.push(`${name}: ${l.id} straddles the ${p.id} cap's edge`);
    }
    const all = marks.get(p.id) ?? [];
    // A ® or ™ on its own is set against its logo, whether or not it is flagged as a tag.
    const lone = !!src && src.parts.length === 1 && 'text' in src.parts[0] && /^[®™]$/.test(src.parts[0].text);
    all.push({ id: l.id, r, tag: lone || !!(src && 'tag' in src && src.tag), logos: src ? logosOf(src) : [] });
    marks.set(p.id, all);
  }
  for (const [pid, list] of marks)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, c] = [list[i], list[j]];
        if (a.tag || c.tag || a.logos.some((x) => c.logos.includes(x))) continue;
        const ix = Math.min(a.r.x1, c.r.x1) - Math.max(a.r.x0, c.r.x0);
        const iy = Math.min(a.r.y1, c.r.y1) - Math.max(a.r.y0, c.r.y0);
        // Boxes that only touch (under 1 mm deep) are a lockup's parts set close, as designed (GAME BOY over COLOR).
        if (ix > 1 && iy > 1) out.push(`${name}: ${a.id} overlaps ${c.id} on ${pid} (${ix.toFixed(1)} × ${iy.toFixed(1)} mm)`);
      }
  return out;
}

/** A hash of the dress drawn alone, per combination. */
function hashes(): string[] {
  const PX = 2;
  const out: string[] = [];
  for (const { name, t } of combinations()) {
    const c = createCanvas(Math.round(t.totalWidthMm * PX), Math.round(t.totalHeightMm * PX));
    const ctx = c.getContext('2d');
    drawOfficial(ctx as unknown as CanvasRenderingContext2D, t, PX);
    out.push(`${name}\t${createHash('sha1').update(ctx.getImageData(0, 0, c.width, c.height).data).digest('hex')}`);
  }
  return out;
}

const args = process.argv.slice(2);
if (args.includes('--hashes')) {
  console.log(hashes().join('\n'));
} else if (args.includes('--against')) {
  const ref = args[args.indexOf('--against') + 1];
  if (!ref) throw new Error('--against needs a git ref');
  // The ref is checked out beside this one, sharing its node_modules, and hashed by this same script.
  const dir = mkdtempSync(join(tmpdir(), 'check-dress-'));
  try {
    execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { stdio: 'ignore' });
    symlinkSync(resolve('node_modules'), join(dir, 'node_modules'));
    copyFileSync(resolve('scripts/check-dress.ts'), join(dir, 'scripts/check-dress.ts'));
    const theirs = new Map(execFileSync('npx', ['tsx', 'scripts/check-dress.ts', '--hashes'], { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20 }).trim().split('\n').map((l) => l.split('\t') as [string, string]));
    const ours = hashes().map((l) => l.split('\t') as [string, string]);
    const changed = ours.filter(([n, h]) => theirs.get(n) !== h).map(([n]) => n);
    const byDress = new Map<string, number>();
    for (const n of changed) byDress.set(n.split(' ')[1], (byDress.get(n.split(' ')[1]) ?? 0) + 1);
    console.log(`${ours.length} combinations, ${changed.length} draw differently from ${ref}`);
    for (const [d, n] of [...byDress].sort((a, b) => b[1] - a[1])) console.log(`  ${d}: ${n}`);
    for (const n of changed) console.log(n);
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', dir], { stdio: 'ignore' });
    rmSync(dir, { recursive: true, force: true });
  }
} else {
  let n = 0;
  const problems: string[] = [];
  for (const { name, t } of combinations()) {
    n++;
    problems.push(...check(name, t));
  }
  console.log(`${n} combinations, ${problems.length} to look at`);
  for (const p of problems) console.log(p);
}
