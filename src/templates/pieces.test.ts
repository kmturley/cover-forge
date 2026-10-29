import { describe, expect, it } from 'vitest';
import { buildTemplateById } from '.';
import { LIBRARY, isTemplateId, pieceOf, piecesOf, splitId, upgradeTemplateId } from './library';
import { BOX_CLEARANCE_MM, SLIPCOVER_CLEARANCE_MM, caseSpecOf } from './pieces';
import { edgeSegments } from './geometry';
import { createBodyGeometry } from '../three/PreviewGeometry';

describe('slipcover', () => {
  const t = buildTemplateById('dvd-std-14~slipcover');

  it('is the case plus room, wrapped back | spine | front | spine | glue', () => {
    expect(t.piece).toBe('slipcover');
    expect(t.panels.map((p) => p.id)).toEqual(['back', 'spine', 'front', 'spineRight', 'glue']);
    const [back, spine, front, right, glue] = t.panels;
    // The DVD case is 135 × 190 × 14 mm outside.
    expect(front.widthMm).toBeCloseTo(135 + SLIPCOVER_CLEARANCE_MM);
    expect(front.heightMm).toBeCloseTo(190 + SLIPCOVER_CLEARANCE_MM);
    expect(back.widthMm).toBe(front.widthMm);
    expect(spine.widthMm).toBeCloseTo(14 + SLIPCOVER_CLEARANCE_MM);
    expect(right.widthMm).toBe(spine.widthMm);
    expect(glue.follows).toBe('spineRight');
  });

  it('has fold lines between the wrapped panels and no flaps on the ends', () => {
    expect(t.panels.some((p) => /tuck|dust|top|bottom/i.test(p.id))).toBe(false);
    expect(edgeSegments(t).some((s) => s.kind === 'fold')).toBe(true);
  });

  it('puts the title on both spines, the second a copy of the first', () => {
    expect(t.panels.filter((p) => p.text).map((p) => p.id)).toEqual(['spine', 'spineRight']);
    expect(t.panels.find((p) => p.id === 'spineRight')?.mirrors).toBe('spine');
  });
});

describe('box', () => {
  it('is the case plus room, with tuck and dust flaps', () => {
    const t = buildTemplateById('dvd-std-14~box');
    expect(t.piece).toBe('box');
    const front = t.panels.find((p) => p.id === 'front')!;
    expect(front.widthMm).toBeCloseTo(135 + BOX_CLEARANCE_MM);
    expect(front.heightMm).toBeCloseTo(190 + BOX_CLEARANCE_MM);
    expect(t.panels.map((p) => p.id)).toEqual(expect.arrayContaining(['tuck', 'bottomTuck', 'glue', 'dustTopLeft', 'top', 'bottom']));
    expect(t.panels.find((p) => p.id === 'spineRight')?.mirrors).toBe('spine');
  });

  it('holds a card: the NFC card\'s box is the NFC card box', () => {
    expect(piecesOf('nfc-card-cr80-duplex').box).toBe('nfc-box-card');
    expect(piecesOf('nfc-box-card').insert).toBe('nfc-card-cr80-duplex');
  });
});

describe('case sizes', () => {
  it('uses the published outside sizes where there are some', () => {
    expect(caseSpecOf(buildTemplateById('dvd-std-14'))).toEqual({ w: 135, h: 190, depth: 14, derived: false });
    expect(caseSpecOf(buildTemplateById('cd-jewel'))).toEqual({ w: 142, h: 125, depth: 10, derived: false });
    expect(caseSpecOf(buildTemplateById('floppy-face'))).toMatchObject({ w: 90, h: 94, depth: 3.3 });
    expect(caseSpecOf(buildTemplateById('game-case-ps4'))).toEqual({ w: 135, h: 171, depth: 14, derived: false });
    expect(caseSpecOf(buildTemplateById('game-case-switch'))).toEqual({ w: 105, h: 170, depth: 10, derived: false });
    expect(caseSpecOf(buildTemplateById('game-case-ps-vita'))).toEqual({ w: 105, h: 135, depth: 11, derived: false });
  });

  it('says which sizes are worked out from the insert', () => {
    expect(caseSpecOf(buildTemplateById('cassette-std'))?.derived).toBe(true);
    expect(caseSpecOf(buildTemplateById('vinyl-12inch'))).toMatchObject({ w: 314, h: 314, derived: true });
  });

  it('has nothing for a sticker', () => {
    expect(caseSpecOf(buildTemplateById('nfc-sticker-25'))).toBeNull();
  });
});

describe('types of a case', () => {
  it('offers every type for a case, except where it makes no sense', () => {
    expect(piecesOf('dvd-std-14')).toEqual({ insert: 'dvd-std-14', slipcover: 'dvd-std-14~slipcover', box: 'dvd-std-14~box' });
    expect(piecesOf('nfc-sticker-25')).toEqual({ insert: 'nfc-sticker-25', slipcover: null, box: null });
    expect(piecesOf('vhs-std-25')).toEqual({ insert: null, slipcover: 'vhs-std-25~slipcover', box: 'vhs-std-25' });
  });

  it('gives every library case the same answer from any of its types', () => {
    for (const e of LIBRARY) {
      const types = piecesOf(e.id);
      for (const id of Object.values(types).filter((x): x is string => !!x)) expect(piecesOf(id), id).toEqual(types);
    }
  });

  it('builds every type it offers, with its own id', () => {
    for (const e of LIBRARY) {
      for (const [piece, id] of Object.entries(piecesOf(e.id))) {
        if (!id) continue;
        const t = buildTemplateById(id);
        expect(t.id, id).toBe(id);
        expect(t.totalWidthMm).toBeGreaterThan(0);
        expect(pieceOf(id)).toBe(piece);
      }
    }
  });

  it('keeps ids of existing templates: an insert is the case\'s own id', () => {
    expect(splitId('dvd-std-14')).toEqual({ base: 'dvd-std-14', piece: null });
    expect(splitId('game-case-ps1~box')).toEqual({ base: 'game-case-ps1', piece: 'box' });
    expect(pieceOf('dvd-std-14')).toBe('insert');
    expect(pieceOf('vhs-std-25')).toBe('box');
  });

  it('accepts only the types a case has', () => {
    expect(isTemplateId('dvd-std-14~slipcover')).toBe(true);
    expect(isTemplateId('nfc-sticker-25~box')).toBe(false);
    expect(isTemplateId('dvd-std-14~nonsense')).toBe(false);
    expect(upgradeTemplateId('nfc-sticker-25~box')).toBeUndefined();
  });

  it('falls back to the case for a type that doesn\'t exist', () => {
    expect(buildTemplateById('dvd-std-14~nonsense').id).toBe('dvd-std-14');
  });
});

describe('3D preview', () => {
  it('can model every slipcover and box', () => {
    for (const e of LIBRARY) {
      for (const id of Object.values(piecesOf(e.id))) {
        if (!id) continue;
        const t = buildTemplateById(id);
        expect(() => createBodyGeometry(t, t.preview), id).not.toThrow();
      }
    }
  });
});

describe('3D preview of a slipcover', () => {
  it('has no top or bottom, so it is hollow', () => {
    const t = buildTemplateById('dvd-std-14~slipcover');
    const solid = buildTemplateById('dvd-std-14~box');
    const faces = (geo: ReturnType<typeof createBodyGeometry>) => new Set(geo.groups.map((g) => g.materialIndex));
    // BoxGeometry face order: +x -x +y -y +z -z.
    expect([...faces(createBodyGeometry(t, t.preview))].sort()).toEqual([0, 1, 4, 5]);
    expect(faces(createBodyGeometry(solid, solid.preview)).size).toBe(6);
    expect(t.preview).toMatchObject({ kind: 'box', hollow: true });
  });
});
