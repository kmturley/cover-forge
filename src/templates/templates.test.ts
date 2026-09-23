import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, buildTemplate, canvasSizePx, defaultVariantId, regionsOf, variantsFor } from './index';
import { edgeSegments, neighbour, paintRect } from './geometry';

describe('blu-ray template', () => {
  it('matches the spec for the US standard case', () => {
    const t = buildTemplate('bluray', 'us-11');
    expect(t.totalWidthMm).toBe(273); // 128 + 11 + 128 + 3 mm bleed each side
    expect(t.totalHeightMm).toBe(154);
    expect(canvasSizePx(t)).toEqual({ width: 3224, height: 1819 });
  });

  it('lays panels out contiguously, back | spine | front', () => {
    const t = buildTemplate('bluray', 'eu-14');
    const [back, spine, front] = t.panels;
    expect([back.id, spine.id, front.id]).toEqual(['back', 'spine', 'front']);
    expect(spine.xMm).toBe(back.xMm + back.widthMm);
    expect(front.xMm).toBe(spine.xMm + spine.widthMm);
    expect(spine.widthMm).toBe(14);
  });

  it('filters variants by region and falls back for unknown variants', () => {
    expect(regionsOf('bluray')).toEqual(['US', 'EU']);
    expect(variantsFor('bluray', 'US').map((v) => v.id)).toEqual(['us-11', 'us-12.5']);
    expect(variantsFor('bluray', 'EU').map((v) => v.id)).toEqual(['eu-14']);
    expect(defaultVariantId('bluray', 'EU')).toBe('eu-14');
    expect(buildTemplate('bluray', 'nope').variantId).toBe('us-11');
    expect(regionsOf('dvd')).toEqual([]);
    expect(variantsFor('dvd', 'US')).toHaveLength(2); // regions don't filter templates that have none
  });
});

describe.each(TEMPLATE_DEFS.map((d) => [d.kind, d] as const))('%s template', (_kind, def) => {
  it.each(def.variants.map((v) => [v.id] as const))('variant %s builds a valid layout', (variantId) => {
    const t = def.build(variantId);
    expect(t.id).toBe(`${def.kind}-${variantId}`);
    expect(t.panels.length).toBeGreaterThan(0);
    // Every panel, plus its bleed, sits inside the canvas; no two panels overlap.
    for (const p of t.panels) {
      const a = paintRect(t, p);
      expect(a.xMm, p.id).toBeGreaterThanOrEqual(-1e-9);
      expect(a.yMm, p.id).toBeGreaterThanOrEqual(-1e-9);
      expect(a.xMm + a.widthMm, p.id).toBeLessThanOrEqual(t.totalWidthMm + 1e-9);
      expect(a.yMm + a.heightMm, p.id).toBeLessThanOrEqual(t.totalHeightMm + 1e-9);
    }
    for (const [i, a] of t.panels.entries()) {
      for (const b of t.panels.slice(i + 1)) {
        const overlapX = Math.min(a.xMm + a.widthMm, b.xMm + b.widthMm) - Math.max(a.xMm, b.xMm);
        const overlapY = Math.min(a.yMm + a.heightMm, b.yMm + b.heightMm) - Math.max(a.yMm, b.yMm);
        expect(overlapX > 1e-9 && overlapY > 1e-9, `${a.id}/${b.id} overlap`).toBe(false);
      }
    }
    // Panel ids are unique and the 3D preview only references panels that exist.
    expect(new Set(t.panels.map((p) => p.id)).size).toBe(t.panels.length);
    const ids = new Set(t.panels.map((p) => p.id));
    if (t.preview.kind === 'box') for (const id of Object.values(t.preview.faces)) expect(ids.has(id!), String(id)).toBe(true);
    else expect(ids.has(t.preview.panel)).toBe(true);
  });
});

describe('template dimensions', () => {
  const size = (kind: Parameters<typeof buildTemplate>[0], v?: string) => {
    const t = buildTemplate(kind, v);
    return [t.totalWidthMm, t.totalHeightMm];
  };
  it('DVD: 129.5 mm panels, 183 mm tall, 14 mm spine', () => expect(size('dvd', 'std-14')).toEqual([129.5 * 2 + 14 + 6, 183 + 6]));
  it('VHS box: a portrait 105 × 190 mm tuck box, 25 mm deep', () => expect(size('vhs')).toEqual([105 * 2 + 25 * 2 + 10 + 6, 190 + 25 * 2 + 21.3 * 2 + 6]));
  it('cassette J-card: 25.4 + 12.7 + 65.1 mm wide, 101.6 mm tall', () => {
    const [w, h] = size('cassette');
    expect(w).toBeCloseTo(103.2 + 6);
    expect(h).toBeCloseTo(101.6 + 6);
  });
  it('CR80 card: portrait 54 × 85.6 mm plus 1 mm bleed', () => expect(size('nfc-card', 'cr80')).toEqual([56, 87.6]));
  it('3.5" floppy label: 69.85 mm square plus 1 mm bleed', () => {
    const [w, h] = size('floppy');
    expect(w).toBeCloseTo(71.85);
    expect(h).toBeCloseTo(71.85);
  });
  it('CD: booklet and tray card are separate pieces with room for both bleeds', () => {
    const t = buildTemplate('cd');
    const [front, spine, back, spineRight] = ['front', 'spine', 'back', 'spineRight'].map((id) => t.panels.find((p) => p.id === id)!);
    expect(spine.xMm - (front.xMm + front.widthMm)).toBeGreaterThanOrEqual(t.bleedMm * 2);
    expect(back.xMm).toBe(spine.xMm + spine.widthMm);
    expect(spineRight.xMm).toBe(back.xMm + back.widthMm);
    expect(spine.widthMm + back.widthMm + spineRight.widthMm).toBe(150); // the standard tray card
    expect(neighbour(t.panels, front, 'right')).toBeUndefined(); // separate piece: not a fold
  });
});

describe('geometry', () => {
  it('extends bleed only on cut edges, not on folds (horizontal wrap)', () => {
    const t = buildTemplate('bluray', 'us-11');
    const [back, spine, front] = t.panels.map((p) => paintRect(t, p));
    expect(back.xMm).toBe(0); // outer left edge bleeds
    expect(back.xMm + back.widthMm).toBe(t.panels[0].xMm + t.panels[0].widthMm); // fold to the spine: no bleed
    expect(spine.widthMm).toBe(11); // spine has no bleed left or right
    expect(front.xMm).toBe(t.panels[2].xMm);
    expect(front.xMm + front.widthMm).toBe(t.totalWidthMm);
    for (const p of [back, spine, front]) {
      expect(p.yMm).toBe(0);
      expect(p.heightMm).toBe(t.totalHeightMm);
    }
  });

  it('extends bleed only on cut edges (J-card strip: flap | spine | front)', () => {
    const t = buildTemplate('cassette');
    const [flap, spine, front] = t.panels.map((p) => paintRect(t, p));
    expect(flap.xMm).toBe(0);
    expect(flap.xMm + flap.widthMm).toBe(t.panels[0].xMm + t.panels[0].widthMm); // fold to the spine
    expect(spine.widthMm).toBe(12.7);
    expect(front.xMm + front.widthMm).toBe(t.totalWidthMm);
    for (const p of [flap, spine, front]) {
      expect(p.yMm).toBe(0);
      expect(p.heightMm).toBe(t.totalHeightMm);
    }
  });

  it('reports fold lines between touching panels and cut lines around the outside', () => {
    const wrap = edgeSegments(buildTemplate('bluray', 'us-11'));
    expect(wrap.filter((s) => s.kind === 'fold')).toHaveLength(2);
    const jcard = edgeSegments(buildTemplate('cassette'));
    const folds = jcard.filter((s) => s.kind === 'fold');
    expect(folds).toHaveLength(2);
    expect(folds.every((s) => s.x1 === s.x2)).toBe(true); // vertical folds in a horizontal strip
    expect(edgeSegments(buildTemplate('nfc-card')).filter((s) => s.kind === 'fold')).toHaveLength(0);
    // CD: no fold between booklet and tray card (they're cut apart)
    expect(edgeSegments(buildTemplate('cd')).filter((s) => s.kind === 'fold')).toHaveLength(2);
  });
});

describe('NFC box net', () => {
  const t = buildTemplate('nfc-box', 'card');
  const p = (id: string) => t.panels.find((q) => q.id === id)!;

  it('lays a tuck-end net around the front panel with the right sizes (58 × 90 × 6 slim card box)', () => {
    expect(t.panels.map((q) => q.id).sort()).toEqual([
      'back', 'bottom', 'bottomTuck', 'dustBottomLeft', 'dustBottomRight', 'dustTopLeft', 'dustTopRight', 'front', 'glue', 'spine', 'spineRight', 'top', 'tuck',
    ]);
    expect([p('front').widthMm, p('front').heightMm]).toEqual([58, 90]);
    expect([p('spine').widthMm, p('spine').heightMm]).toEqual([6, 90]); // side panels are depth × height
    expect([p('top').widthMm, p('top').heightMm]).toEqual([58, 6]); // lid and bottom are width × depth
    expect([p('bottom').widthMm, p('bottom').heightMm]).toEqual([58, 6]);
    expect(p('bottomTuck').heightMm).toBe(12);
    expect(p('tuck').heightMm).toBe(12); // 85% of the depth, but never under 12 mm so it still holds
    expect(t.totalWidthMm).toBe(58 * 2 + 6 * 2 + 10 + 6); // back, sides, front, glue + bleed
    expect(t.totalHeightMm).toBeCloseTo(12 + 6 + 90 + 6 + 12 + 6); // tuck, lid, front, bottom, tuck + bleed
  });

  it('folds where panels touch: around the front, between the lid and tuck, and at the glue flap', () => {
    const [back, left, front, right, glue] = ['back', 'spine', 'front', 'spineRight', 'glue'].map(p);
    expect(left.xMm).toBe(back.xMm + back.widthMm);
    expect(front.xMm).toBe(left.xMm + left.widthMm);
    expect(right.xMm).toBe(front.xMm + front.widthMm);
    expect(glue.xMm).toBe(right.xMm + right.widthMm);
    expect(neighbour(t.panels, front, 'top')?.id).toBe('top');
    expect(neighbour(t.panels, front, 'bottom')?.id).toBe('bottom');
    expect(neighbour(t.panels, p('top'), 'top')?.id).toBe('tuck');
    expect(neighbour(t.panels, p('bottom'), 'bottom')?.id).toBe('bottomTuck');
    expect(neighbour(t.panels, p('glue'), 'right')).toBeUndefined(); // the glue tab's outer edge is a cut
    // 4 folds across the strip (incl. the glue tab) + lid, top tuck, bottom, bottom tuck round the front + 4 dust flaps
    expect(edgeSegments(t).filter((s) => s.kind === 'fold')).toHaveLength(12);
  });

  it('dust flaps hang off the end of each side panel, fold to it only, and take its colour', () => {
    const flaps = t.panels.filter((q) => q.id.startsWith('dust'));
    expect(flaps).toHaveLength(4);
    for (const f of flaps) {
      const host = p(f.follows!);
      expect(['spine', 'spineRight']).toContain(f.follows);
      expect(f.xMm).toBeGreaterThanOrEqual(host.xMm - 1e-9);
      expect(f.xMm + f.widthMm).toBeLessThanOrEqual(host.xMm + host.widthMm + 1e-9);
      // The only neighbour is the side panel: the lid and bottom stay a cut line away.
      const sides = (['top', 'right', 'bottom', 'left'] as const).map((sd) => neighbour(t.panels, f, sd)?.id).filter(Boolean);
      expect(sides).toEqual([f.follows]);
    }
  });

  it('only the flaps and lids bleed on their free edges; the front does not bleed at all (fully surrounded)', () => {
    const front = paintRect(t, p('front'));
    expect(front).toMatchObject({ xMm: p('front').xMm, yMm: p('front').yMm, widthMm: 58, heightMm: 90 });
    const tuck = paintRect(t, p('tuck'));
    expect(tuck.yMm).toBe(0); // free top edge bleeds to the canvas edge
  });

  it('marks the NFC tag spot at the centre of the front panel', () => {
    expect(t.marks).toHaveLength(1);
    const m = t.marks![0];
    expect(m.xMm).toBeCloseTo(p('front').xMm + 29);
    expect(m.yMm).toBeCloseTo(p('front').yMm + 45);
    expect(m.diameterMm).toBe(25);
    expect(m.label).toMatch(/NFC/);
  });

  it('has a slim card box, a small box and a wallet, each with its own layout', () => {
    for (const v of ['card', 'small', 'wallet']) {
      const box = buildTemplate('nfc-box', v);
      expect(box.variantId).toBe(v);
      expect(box.preview.kind).toBe('box');
    }
    expect(buildTemplate('nfc-box', 'small').panels.find((q) => q.id === 'top')!.heightMm).toBe(25);
    expect(buildTemplate('nfc-box', 'nonsense').variantId).toBe('card');
  });

  it('the wallet is a spineless slip cover: front | back | glue tab, folded between front and back', () => {
    const w = buildTemplate('nfc-box', 'wallet');
    expect(w.panels.map((q) => q.id)).toEqual(['front', 'back', 'glue']);
    expect(w.panels.some((q) => q.text)).toBe(false);
    expect(neighbour(w.panels, w.panels[0], 'right')?.id).toBe('back');
    expect(edgeSegments(w).filter((s) => s.kind === 'fold')).toHaveLength(2);
    expect(w.preview).toMatchObject({ kind: 'box', faces: { '+z': 'front', '-z': 'back' } });
    expect(w.marks).toHaveLength(1);
  });
});

describe('NFC sticker', () => {
  it('is a round sticker in three sizes with the cut circle marked', () => {
    for (const [id, d] of [['25', 25], ['30', 30], ['35', 35]] as const) {
      const t = buildTemplate('nfc-sticker', id);
      expect([t.panels[0].widthMm, t.panels[0].heightMm]).toEqual([d, d]);
      expect(t.marks![0].diameterMm).toBe(d);
      expect(t.preview).toMatchObject({ kind: 'slab', radiusMm: d / 2, fullFace: true });
    }
    expect(buildTemplate('nfc-sticker', 'x').variantId).toBe('25');
  });
});

describe('NFC card back', () => {
  it('front + back (the default) has a second, separate card; front only has just the one', () => {
    expect(buildTemplate('nfc-card', 'cr80').panels).toHaveLength(1);
    const t = buildTemplate('nfc-card', 'cr80-duplex');
    expect(t.panels.map((q) => q.id)).toEqual(['front', 'back']);
    expect(t.totalWidthMm).toBeGreaterThan(54 * 2 + 2);
    expect(neighbour(t.panels, t.panels[0], 'right')).toBeUndefined(); // two cards, not a fold
    expect(t.preview).toMatchObject({ kind: 'slab', panel: 'front', backPanel: 'back' });
  });

  it('is the default NFC card variant', () => {
    expect(defaultVariantId('nfc-card')).toBe('cr80-duplex');
    expect(buildTemplate('nfc-card').panels.map((q) => q.id)).toEqual(['front', 'back']);
  });
});
