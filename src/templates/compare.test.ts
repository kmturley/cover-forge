import { describe, expect, it } from 'vitest';
import { LIBRARY, LIBRARY_GROUPS } from './library';
import { GROUP_GAP_MM, caseGapMm, groupEntries, layoutRow, orientationOf, sizedLibrary, sortEntries } from './compare';

const all = sizedLibrary();
const byId = (id: string) => all.find((c) => c.entry.id === id)!;

describe('sizedLibrary', () => {
  it('sizes every template in the library, in library order', () => {
    expect(all.map((c) => c.entry.id)).toEqual(LIBRARY.map((e) => e.id));
  });

  it('gives each its case’s real outside size', () => {
    const dvd = byId('dvd-std-14');
    expect([dvd.widthMm, dvd.heightMm, dvd.depthMm].map(Math.round)).toEqual([130, 183, 14]);
    expect(Math.round(byId('vinyl-12inch').heightMm)).toBe(314);
  });

  it('sorts each into a format', () => {
    expect(byId('dvd-std-14').format).toBe('Keep cases');
    expect(byId('game-case-switch').format).toBe('Keep cases');
    expect(byId('cd-jewel').format).toBe('Jewel & tape cases');
    expect(byId('game-case-ps1').format).toBe('Jewel & tape cases');
    expect(byId('cassette-std').format).toBe('Jewel & tape cases');
    expect(byId('vhs-std-25').format).toBe('Boxes');
    expect(byId('game-case-snes').format).toBe('Boxes');
    expect(byId('vinyl-7inch').format).toBe('Sleeves');
    expect(byId('nfc-card-cr80-duplex').format).toBe('Cards & labels');
  });

  it('knows which face the spine is on', () => {
    expect(byId('dvd-std-14').spineFace).toBe('-x');
    expect(byId('nfc-card-cr80-duplex').spineFace).toBeNull();
  });
});

describe('orientationOf', () => {
  it('reads portrait, landscape and near-square fronts', () => {
    expect(orientationOf(130, 183)).toBe('Portrait');
    expect(orientationOf(183, 130)).toBe('Landscape');
    expect(orientationOf(125, 120)).toBe('Square');
  });
});

describe('sortEntries', () => {
  it('orders by a dimension, smallest first', () => {
    const up = sortEntries(all, 'depth').map((c) => c.depthMm);
    expect(up).toEqual([...up].sort((a, b) => a - b));
  });

  it('orders by name with numbers in order', () => {
    const vinyl = sortEntries(all.filter((c) => c.entry.kind === 'vinyl'), 'name').map((c) => c.entry.name);
    expect(vinyl).toEqual(['Vinyl 7"', 'Vinyl 10"', 'Vinyl 12"']);
  });
});

describe('groupEntries and layoutRow', () => {
  it('groups by media in the order given, leaving out empty ones', () => {
    const order = ['Music', ...LIBRARY_GROUPS.filter((g) => g !== 'Music')];
    const groups = groupEntries(all, 'media', order);
    expect(groups[0].name).toBe('Music');
    expect(groups.flatMap((g) => g.entries)).toHaveLength(all.length);
  });

  it('groups by orientation', () => {
    const groups = groupEntries(all, 'orientation');
    expect(groups.map((g) => g.name)).toEqual(['Portrait', 'Square', 'Landscape'].filter((n) => all.some((c) => c.orientation === n)));
  });

  it('places cases end to end with gaps, wider between groups', () => {
    const a = byId('dvd-std-14');
    const b = byId('cd-jewel');
    const { placed, lengthMm } = layoutRow([{ name: 'x', entries: [a] }, { name: 'y', entries: [b] }], 'front');
    expect(placed[0].xMm).toBeCloseTo(a.widthMm / 2);
    expect(placed[1].xMm).toBeCloseTo(a.widthMm + GROUP_GAP_MM + b.widthMm / 2);
    expect(lengthMm).toBeCloseTo(a.widthMm + GROUP_GAP_MM + b.widthMm);
    // Spines facing: twice the gap, so the fronts show from an angle.
    const spines = layoutRow([{ name: '', entries: [a, b] }], 'spine');
    expect(caseGapMm('spine')).toBe(2 * caseGapMm('front'));
    expect(spines.lengthMm).toBeCloseTo(a.depthMm + caseGapMm('spine') + b.depthMm);
  });
});
