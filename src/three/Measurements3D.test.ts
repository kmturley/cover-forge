import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { frontArt } from './Measurements3D';

describe('frontArt: what the 3D measurements span', () => {
  it('measures the insert inside a real-size case at its own size and place, not the case', () => {
    // The DVD insert: 129.5 × 183 in the 135 × 190 case, against the spine edge, centred top to bottom.
    const dvd = buildTemplate('dvd', 'std-14');
    expect(frontArt(dvd, dvd.preview)).toMatchObject({ cx: -135 / 2 + 129.5 / 2, cy: 0, w: 129.5, h: 183, mmW: 129.5, mmH: 183 });
    // The Xbox One's stands 3.5 mm above the case's bottom, under its green top.
    const xb = buildTemplate('game-case', 'xbox-one');
    expect(frontArt(xb, xb.preview)).toMatchObject({ w: 128, h: 149, cy: -170 / 2 + 3.5 + 149 / 2 });
  });

  it('still measures a print that covers its face across the whole face', () => {
    const nes = buildTemplate('game-case', 'nes');
    expect(frontArt(nes, nes.preview)).toMatchObject({ w: 133, h: 176, mmW: 133, mmH: 176 });
  });
});
