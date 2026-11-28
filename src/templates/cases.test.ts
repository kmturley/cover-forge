import { describe, expect, it } from 'vitest';
import { buildTemplate } from '.';
import type { TemplateConfig } from '../types/template';
import { BLURAY_INSERT, BLURAY_SHELL, BLURAY_SPINES, DVD_INSERT, DVD_SHELL, DVD_SPINES, GAME_CASES, JEWEL_CASE, MINI_CD_SLIM, MINIDISC_ALBUM, UHD_SPINES } from './cases';

/** A printed piece fits inside the case it is for: smaller than its outside, with room for the plastic round it. */
const fits = (piece: { w: number; h: number }, outside: { w: number; h: number }) => piece.w < outside.w && piece.h < outside.h;

describe('cases', () => {
  it('every game insert fits inside its case, and its spine no deeper than the case', () => {
    for (const [id, { insert, outside }] of Object.entries(GAME_CASES)) {
      if (!outside) continue;
      expect(fits(insert, outside), id).toBe(true);
      if (outside.d !== undefined) expect(insert.spine, id).toBeLessThanOrEqual(outside.d);
    }
  });

  it('the DVD and Blu-ray inserts fit their cases at every spine', () => {
    expect(fits(DVD_INSERT, DVD_SHELL)).toBe(true);
    expect(fits(BLURAY_INSERT, BLURAY_SHELL)).toBe(true);
    for (const spine of [...Object.values(DVD_SPINES), ...Object.values(BLURAY_SPINES), ...Object.values(UHD_SPINES)]) expect(spine).toBeGreaterThan(0);
  });

  it("the jewel case's printed pieces fit inside its plastic parts", () => {
    const { outside, booklet, trayCard, wallMm, parts } = JEWEL_CASE;
    // The booklet sits behind the lid's front, which stops short of the hinge strip, and inside the lid's top and bottom walls.
    expect(booklet.w + booklet.fromOpeningEdgeMm).toBeLessThanOrEqual(outside.w - parts.lid.frontFromHingeMm);
    expect(booklet.h).toBeLessThanOrEqual(outside.h - 2 * wallMm);
    // The tray card's back runs from inside the hinge strip to the opening end's wall, set in for the finger slot.
    expect(trayCard.back).toBeLessThanOrEqual(outside.w - 2 * wallMm - parts.base.openingWallInsetMm);
    // It is shorter than the base's inside, and its flaps no deeper than the case's inside.
    expect(trayCard.h).toBeLessThan(parts.base.heightMm - 2 * wallMm);
    expect(trayCard.flap).toBeLessThan(outside.d - 2 * wallMm);
    // The PS1's insert is the jewel case's booklet and flap.
    expect(GAME_CASES.ps1.insert).toEqual({ w: booklet.w, h: booklet.h, spine: trayCard.flap });
    expect(GAME_CASES.ps1.outside).toEqual(outside);
  });

  it("the MiniDisc album and 8 cm cases' pieces fit inside them", () => {
    expect(fits(MINIDISC_ALBUM.booklet, MINIDISC_ALBUM.outside)).toBe(true);
    expect(MINIDISC_ALBUM.tray.w - 2 * MINIDISC_ALBUM.tray.spine).toBeLessThan(MINIDISC_ALBUM.outside.w);
    expect(fits(MINI_CD_SLIM.card, MINI_CD_SLIM.outside)).toBe(true);
  });

  /**
   * A case drawn in 3D at its real outside, with its printed insert inside it at its own size: the front and back no wider
   * than the case, standing inside its height (centred, or `insertBottomMm` above the bottom), and the spine no wider than
   * the case is deep.
   */
  const realSize = (t: TemplateConfig, outside: { w: number; h: number; d?: number }, spine: number) => {
    const spec = t.preview;
    expect(spec.kind, t.id).toBe('box');
    if (spec.kind !== 'box') return;
    expect([spec.widthMm, spec.heightMm, spec.depthMm], t.id).toEqual([outside.w, outside.h, outside.d ?? spine]);
    for (const id of ['front', 'back'] as const) {
      const p = t.panels.find((q) => q.id === id)!;
      expect(p.widthMm, `${t.id} ${id}`).toBeLessThan(spec.widthMm);
      const bottom = spec.insertBottomMm ?? (spec.heightMm - p.heightMm) / 2;
      expect(bottom, `${t.id} ${id}`).toBeGreaterThan(0);
      expect(bottom + p.heightMm, `${t.id} ${id}`).toBeLessThan(spec.heightMm);
    }
    expect(t.panels.find((q) => q.id === 'spine')!.widthMm, t.id).toBeLessThanOrEqual(spec.depthMm);
  };

  it('draws every game case with a known outside at it in 3D, its insert inside', () => {
    for (const [id, { insert, outside }] of Object.entries(GAME_CASES)) {
      if (!outside || id === 'ps1') continue; // the PS1 is the jewel case, modelled from its parts
      realSize(buildTemplate('game-case', id), outside, insert.spine);
    }
  });

  it('draws the DVD, Blu-ray and 4K UHD cases at their real outside in 3D, at every spine', () => {
    for (const [v, spine] of Object.entries(DVD_SPINES)) realSize(buildTemplate('dvd', v), DVD_SHELL, spine);
    for (const [v, spine] of Object.entries(BLURAY_SPINES)) realSize(buildTemplate('bluray', v), BLURAY_SHELL, spine);
    for (const [v, spine] of Object.entries(UHD_SPINES)) realSize(buildTemplate('uhd', v), BLURAY_SHELL, spine);
  });
});
