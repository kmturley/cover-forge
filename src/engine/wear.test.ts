import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, buildTemplate } from '../templates';
import { paintRect } from '../templates/geometry';
import { seeded, seedFrom } from './random';
import { planWear } from './wear';

describe('seeded random', () => {
  it('repeats for the same seed, differs across seeds, and stays in [0, 1)', () => {
    const a = seeded(42);
    const b = seeded(42);
    const seq = Array.from({ length: 50 }, () => a());
    expect(seq).toEqual(Array.from({ length: 50 }, () => b()));
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(seeded(43)()).not.toBe(seq[0]);
    expect(seedFrom('a')).not.toBe(seedFrom('b'));
    expect(seedFrom('a')).toBe(seedFrom('a'));
  });
});

describe('planWear', () => {
  const t = buildTemplate('bluray', 'us-11');

  it('is deterministic for a seed (so the editor never flickers) and varies between seeds', () => {
    expect(planWear(t, 7)).toEqual(planWear(t, 7));
    expect(planWear(t, 7)).not.toEqual(planWear(t, 8));
  });

  it('produces every kind of wear for a wrap', () => {
    const p = planWear(t, 1);
    expect(p.areas).toHaveLength(3);
    expect(p.glares.length).toBeGreaterThanOrEqual(3);
    expect(p.wrinkles.length).toBeGreaterThan(0);
    expect(p.blotches.length).toBeGreaterThan(0);
    expect(p.nicks.length).toBeGreaterThan(0);
    expect(p.creases).toHaveLength(2); // the two folds beside the spine
    expect(p.corners).toHaveLength(4); // only the wrap's four outer corners are real corners
  });

  it('keeps creases on the fold lines and corners on cut corners', () => {
    const p = planWear(t, 1);
    const spine = t.panels.find((q) => q.id === 'spine')!;
    for (const c of p.creases) expect([spine.xMm, spine.xMm + spine.widthMm]).toContain(c.x1);
    // The four real corners are the wrap's outer trim corners: (3,3), (270,3), (3,151), (270,151).
    const expected = [[3, 3], [270, 3], [3, 151], [270, 151]];
    for (const [x, y] of expected) expect(p.corners.some((c) => Math.abs(c.x - x) < 1e-9 && Math.abs(c.y - y) < 1e-9), `${x},${y}`).toBe(true);
    for (const c of p.creases) for (const [a, b] of c.gaps) expect(b).toBeGreaterThan(a);
  });

  it.each(TEMPLATE_DEFS.map((d) => [d.kind] as const))('%s: plans without throwing and stays near the artwork', (kind) => {
    const tpl = buildTemplate(kind);
    const plan = planWear(tpl, 99);
    expect(plan.areas.length).toBe(tpl.panels.length);
    // Nicks sit at the edges: never far outside any panel's paint area.
    const areas = tpl.panels.map((p) => paintRect(tpl, p));
    for (const n of plan.nicks) {
      const near = areas.some((a) => n.x >= a.xMm - 3 && n.x <= a.xMm + a.widthMm + 3 && n.y >= a.yMm - 3 && n.y <= a.yMm + a.heightMm + 3);
      expect(near).toBe(true);
    }
    for (const v of [...plan.glares, ...plan.blotches, ...plan.nicks, ...plan.corners]) expect(v.alpha).toBeGreaterThan(0);
  });

  it('a single-panel label has no creases', () => {
    expect(planWear(buildTemplate('nfc-card'), 1).creases).toHaveLength(0);
    expect(planWear(buildTemplate('nfc-card'), 1).corners).toHaveLength(4);
  });
});
