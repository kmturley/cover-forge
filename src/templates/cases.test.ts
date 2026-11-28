import { describe, expect, it } from 'vitest';
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
});
