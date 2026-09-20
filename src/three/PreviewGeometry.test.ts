import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, buildTemplate } from '../templates';
import { FACE_ORDER, TARGET_SIZE_UNITS, createBodyGeometry, createLabelGeometry, createLabelSliceGeometry, labelWrap, modelSizeMm, panelUvRange, previewScale, printedFaces } from './PreviewGeometry';

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
    expect(front.v1).toBeCloseTo(1 - 3 / 154);
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
    const t = buildTemplate('bluray', 'eu-14');
    const geo = createBodyGeometry(t, t.preview);
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(geo.boundingBox!.min.clone());
    expect(size.x).toBeCloseTo(128);
    expect(size.y).toBeCloseTo(148);
    expect(size.z).toBeCloseTo(14);

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
    expect(printedFaces(buildTemplate('nfc-card').preview)).toEqual({ '+z': 'front' });
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
