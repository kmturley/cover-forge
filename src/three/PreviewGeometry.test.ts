import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, buildTemplate } from '../templates';
import { FACE_ORDER, TARGET_SIZE_UNITS, createBodyGeometry, createLabelGeometry, createLabelSliceGeometry, createSlabBodyGeometry, createSlabFaceGeometry, insetFaces, labelWrap, modelSizeMm, panelUvRange, previewScale, printedFaces, slabOutline, createWrappedPanelGeometry } from './PreviewGeometry';

describe('panelUvRange', () => {
  it('excludes bleed and splits the texture back | spine | front', () => {
    const t = buildTemplate('bluray', 'us-11');
    const back = panelUvRange(t, 'back');
    const spine = panelUvRange(t, 'spine');
    const front = panelUvRange(t, 'front');
    expect(back.u0).toBeCloseTo(3 / 273);
    expect(back.u1).toBeCloseTo(spine.u0);
    expect(spine.u1).toBeCloseTo(front.u0);
    expect(front.u1).toBeCloseTo(270 / 273);
    expect(front.v1).toBeCloseTo(1 - 3 / 155);
  });

  it('finds panels in the J-card strip and rejects unknown ones', () => {
    const t = buildTemplate('cassette');
    const front = panelUvRange(t, 'front');
    const spine = panelUvRange(t, 'spine');
    expect(front.u0).toBeCloseTo(spine.u1); // the spine sits directly left of the front
    expect(() => panelUvRange(buildTemplate('nfc-card'), 'spine')).toThrow();
  });
});

describe('createBodyGeometry', () => {
  it('sizes the box from the spec and maps the front face into the front UV range', () => {
    const t = buildTemplate('game-case', 'nes');
    const geo = createBodyGeometry(t, t.preview);
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(geo.boundingBox!.min.clone());
    expect(size.x).toBeCloseTo(133);
    expect(size.y).toBeCloseTo(176);
    expect(size.z).toBeCloseTo(28);

    const front = panelUvRange(t, 'front');
    const uv = geo.getAttribute('uv');
    const g = geo.groups.find((x) => FACE_ORDER[x.materialIndex!] === '+z')!;
    const us: number[] = [];
    for (let i = g.start; i < g.start + g.count; i++) us.push(uv.getX(i));
    expect(Math.min(...us)).toBeCloseTo(front.u0);
    expect(Math.max(...us)).toBeCloseTo(front.u1);
  });

  it.each(TEMPLATE_DEFS.map((d) => [d.kind] as const))('%s: builds geometry and only references existing panels', (kind) => {
    const t = buildTemplate(kind);
    const geo = createBodyGeometry(t, t.preview);
    expect(geo.getAttribute('position').count).toBeGreaterThan(0);
    for (const panel of Object.values(printedFaces(t.preview))) expect(() => panelUvRange(t, panel!)).not.toThrow();
  });

  it('a card prints its front over the whole face, while a floppy uses a separate label', () => {
    expect(printedFaces(buildTemplate('nfc-card').preview)).toEqual({ '+z': 'front', '-z': 'back' });
    expect(printedFaces(buildTemplate('floppy').preview)).toEqual({});
    const floppy = buildTemplate('floppy');
    const label = createLabelGeometry(floppy, 'front');
    label.computeBoundingBox();
    expect(label.boundingBox!.getSize(label.boundingBox!.min.clone()).x).toBeCloseTo(69.85);
  });
});

describe('previewScale', () => {
  it('scales every model so its largest dimension is the same size on screen', () => {
    for (const d of TEMPLATE_DEFS) {
      const t = d.build(d.variants[0].id);
      expect(Math.max(...modelSizeMm(t.preview)) * previewScale(t.preview)).toBeCloseTo(TARGET_SIZE_UNITS);
    }
  });
});

describe('label wrap (floppy)', () => {
  it('splits a label that starts low on the front between front, bottom edge and back', () => {
    const w = labelWrap(94, 3.3, 69.85, 32);
    expect(w.frontMm).toBeCloseTo(62);
    expect(w.edgeMm).toBeCloseTo(3.3);
    expect(w.backMm).toBeCloseTo(4.55);
    expect(w.frontMm + w.edgeMm + w.backMm).toBeCloseTo(69.85);
  });

  it('leaves a label that fits entirely on the front alone', () => {
    expect(labelWrap(94, 3.3, 69.85, 10)).toEqual({ frontMm: 69.85, edgeMm: 0, backMm: 0 });
  });

  it('slices the artwork so front, edge and back together cover the label exactly once', () => {
    const t = buildTemplate('floppy');
    const uv = (from: number, to: number) => {
      const g = createLabelSliceGeometry(t, 'front', from, to).getAttribute('uv');
      const vs = Array.from({ length: g.count }, (_, i) => g.getY(i));
      return [Math.min(...vs), Math.max(...vs)];
    };
    const [a0, a1] = uv(0, 62);
    const [b0, b1] = uv(62, 65.3);
    const [c0] = uv(65.3, 69.85);
    expect(a0).toBeCloseTo(b1);
    expect(b0).toBeCloseTo(uv(65.3, 69.85)[1]);
    expect(a1).toBeCloseTo(panelUvRange(t, 'front').v1);
    expect(c0).toBeCloseTo(panelUvRange(t, 'front').v0);
  });
});

describe('slab bodies (cards, disks, stickers)', () => {
  const slab = (kind: 'nfc-card' | 'floppy' | 'nfc-sticker', id: string) => {
    const t = buildTemplate(kind, id);
    return { t, spec: t.preview as Extract<typeof t.preview, { kind: 'slab' }> };
  };

  it('a card keeps its real 3.18 mm corners (the outline has arcs, not a thin box edge)', () => {
    const { spec } = slab('nfc-card', 'cr80-duplex');
    const pts = slabOutline(spec).getPoints(12);
    expect(pts.length).toBeGreaterThan(30);
    // The corner sits 3.18 mm in from the corner point: nothing lies at the sharp corner itself.
    expect(pts.some((p) => Math.abs(p.x - 27) < 1e-6 && Math.abs(p.y - 42.8) < 1e-6)).toBe(false);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(27);
  });

  it('a sticker is a circle', () => {
    const { spec } = slab('nfc-sticker', '25');
    const pts = slabOutline(spec).getPoints(24);
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(12.5, 1);
  });

  it('a floppy has a cut top-right corner', () => {
    const { spec } = slab('floppy', 'face');
    const pts = slabOutline(spec).getPoints(12);
    expect(pts.some((p) => Math.abs(p.x - 45) < 1e-6 && Math.abs(p.y - 47) < 1e-6)).toBe(false);
    expect(pts.some((p) => Math.abs(p.x - 45) < 1e-6 && Math.abs(p.y - (47 - 6)) < 1e-6)).toBe(true);
  });

  it('body thickness and printed-face UVs follow the template', () => {
    const { t, spec } = slab('nfc-card', 'cr80-duplex');
    const body = createSlabBodyGeometry(spec);
    body.computeBoundingBox();
    expect(body.boundingBox!.max.z - body.boundingBox!.min.z).toBeCloseTo(0.76);
    const back = createSlabFaceGeometry(t, spec, 'back');
    const uv = back.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    const r = panelUvRange(t, 'back');
    expect(Math.min(...us)).toBeCloseTo(r.u0);
    expect(Math.max(...us)).toBeCloseTo(r.u1);
  });
});

describe('inset faces', () => {
  it('draws a spine card shorter than its face at true size, so it lines up with the front and back cards', () => {
    // The 8 cm slim case's card is 85.7 mm tall on its 90 mm hinge; stretched to the face it would stand 2 mm above them.
    const t = buildTemplate('cd', 'mini-slim');
    expect(insetFaces(t, t.preview)).toEqual([{ face: '-x', panel: 'spine' }]);
  });

  it('sits the DVD insert inside its real-size keepcase: the spine centred down its edge, the front and back from the spine edge', () => {
    const t = buildTemplate('dvd', 'std-14');
    expect(t.preview).toMatchObject({ kind: 'box', widthMm: 135, heightMm: 190, depthMm: 14 });
    expect(insetFaces(t, t.preview)).toEqual([{ face: '-x', panel: 'spine' }]);
    expect(t.preview.kind === 'box' && t.preview.decals).toEqual([
      { panel: 'front', face: '+z', align: 'min-x' },
      { panel: 'back', face: '-z', align: 'min-x' },
    ]);
  });

  it('leaves every other case, box and card printed straight onto its faces', () => {
    for (const [kind, id] of [['vhs', 'std-25'], ['cassette', 'std'], ['nfc-box', 'card'], ['nfc-card', 'cr80-duplex']] as const) {
      const t = buildTemplate(kind, id);
      expect(insetFaces(t, t.preview), `${kind}/${id}`).toEqual([]);
    }
  });
});

describe('wrapped panel geometry', () => {
  const extent = (geo: ReturnType<typeof createWrappedPanelGeometry>, axis: 'X' | 'Y' | 'Z') => {
    const pos = geo.getAttribute('position');
    const v = Array.from({ length: pos.count }, (_, i) => pos[`get${axis}`](i));
    return [Math.min(...v), Math.max(...v)];
  };

  it('keeps a piece inside the face flat and at its own size', () => {
    const t = buildTemplate('cd', 'mini-slim');
    const spec = t.preview as Extract<typeof t.preview, { kind: 'box' }>;
    const front = t.panels.find((p) => p.id === 'front')!;
    const geo = createWrappedPanelGeometry(t, 'front', spec.widthMm, spec.heightMm, spec.radiusMm, 3);
    const [x0, x1] = extent(geo, 'X');
    expect(x1 - x0).toBeCloseTo(front.widthMm);
    expect(x0).toBeCloseTo(3 - front.widthMm / 2);
    for (const z of extent(geo, 'Z')) expect(z).toBeCloseTo(0);
  });

  it('turns a piece that reaches the face edge round the rounded edge, never past the body', () => {
    // A cassette J-card's back flap: the full height of the back, from the spine edge.
    const t = buildTemplate('cassette', 'std');
    const spec = t.preview as Extract<typeof t.preview, { kind: 'box' }>;
    const back = t.panels.find((p) => p.id === 'back')!;
    const x = -spec.widthMm / 2 + back.widthMm / 2;
    const geo = createWrappedPanelGeometry(t, 'back', spec.widthMm, spec.heightMm, spec.radiusMm, x);
    const r = spec.radiusMm;
    const [x0] = extent(geo, 'X');
    const [y0, y1] = extent(geo, 'Y');
    const [z0, z1] = extent(geo, 'Z');
    // Half of each edge's arc: in from the corner by r(1 − sin 45°), back from the face by r(1 − cos 45°).
    const inset = r * (1 - Math.SQRT1_2);
    expect(x0).toBeCloseTo(-spec.widthMm / 2 + inset);
    expect(y0).toBeCloseTo(-spec.heightMm / 2 + inset);
    expect(y1).toBeCloseTo(spec.heightMm / 2 - inset);
    expect(z1).toBeCloseTo(0);
    expect(z0).toBeCloseTo(-2 * inset);
  });
});
