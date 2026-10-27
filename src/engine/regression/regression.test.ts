import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FIXTURES } from './fixtures';
import { decode, diff, renderFixture } from './render';

/**
 * Pixel-regression harness for the layer-system rewrite (layer-system-plan.md, phase 0).
 *
 * Every fixture is drawn by the app's real `renderCover` and compared with a golden PNG captured from the slot-based
 * renderer. The layer system must reproduce them, so a change that shifts a panel, a logo or a barcode fails here.
 *
 *   npm run golden:update    re-captures the goldens (only when a change to the look is intended)
 *
 * Text depends on the machine's fonts, so the goldens record the platform they were captured on. There the comparison
 * is strict (no pixel may differ by more than a hair). Elsewhere (CI on Linux) only a gross change fails, because
 * the same text lays out a little differently.
 */
const DIR = join(__dirname, '__golden__');
const MANIFEST = join(DIR, 'manifest.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const TOLERANCE = 2;

const manifest: { platform: string } = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { platform: process.platform };
const strict = manifest.platform === process.platform;
/**
 * Share of pixels allowed to differ off the capturing platform. Text is laid out with whatever fonts the machine has
 * (the same family name can be a different typeface on Linux), so a scene with big text boxes moves more than one
 * with only marks and codes. Either way a misplaced panel, logo or layer still fails.
 */
const LOOSE_SHARE = 0.02;
const LOOSE_SHARE_TEXT = 0.08;
const hasText = (f: (typeof FIXTURES)[number]) => /"type":"text"/.test(JSON.stringify([f.scene.shared.diff, f.scene.designs]));

if (UPDATE) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({ platform: process.platform }, null, 2) + '\n');
}

describe('golden renders', () => {
  it('has unique fixture names', () => {
    expect(new Set(FIXTURES.map((f) => f.name)).size).toBe(FIXTURES.length);
  });

  for (const f of FIXTURES) {
    it(f.name, async () => {
      const file = join(DIR, `${f.name}.png`);
      const out = await renderFixture(f);
      if (UPDATE) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, out.png);
        return;
      }
      expect(existsSync(file), `missing golden ${f.name}.png; run npm run golden:update`).toBe(true);
      const d = diff(out, await decode(readFileSync(file)), TOLERANCE);
      if (strict) expect(d.differing, `${d.differing} px differ (max channel delta ${d.maxDelta})`).toBe(0);
      else expect(d.differing / d.total, `${d.differing} of ${d.total} px differ`).toBeLessThan(hasText(f) ? LOOSE_SHARE_TEXT : LOOSE_SHARE);
    });
  }
});
