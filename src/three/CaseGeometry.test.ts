import { describe, expect, it } from 'vitest';
import { createBlurayTemplate } from '../templates/bluray';
import { createCaseGeometry, panelUvRange } from './CaseGeometry';

describe('panelUvRange', () => {
  it('excludes bleed and splits the texture back | spine | front', () => {
    const t = createBlurayTemplate('US');
    const back = panelUvRange(t, 'back');
    const spine = panelUvRange(t, 'spine');
    const front = panelUvRange(t, 'front');
    expect(back.u0).toBeCloseTo(3 / 275);
    expect(back.u1).toBeCloseTo(spine.u0);
    expect(spine.u1).toBeCloseTo(front.u0);
    expect(front.u1).toBeCloseTo(272 / 275);
    expect(front.v1).toBeCloseTo(1 - 3 / 155);
  });
});

describe('createCaseGeometry', () => {
  it('sizes the box from the template and maps the front face into the front UV range', () => {
    const t = createBlurayTemplate('EU');
    const geo = createCaseGeometry(t);
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(new (geo.boundingBox!.min.constructor as typeof import('three').Vector3)());
    expect(size.x).toBeCloseTo(1.29);
    expect(size.y).toBeCloseTo(1.49);
    expect(size.z).toBeCloseTo(0.14);

    const front = panelUvRange(t, 'front');
    const uv = geo.getAttribute('uv');
    const g = geo.groups.find((x) => x.materialIndex === 4)!; // +Z front face
    const us: number[] = [];
    for (let i = g.start; i < g.start + g.count; i++) us.push(uv.getX(i));
    expect(Math.min(...us)).toBeCloseTo(front.u0);
    expect(Math.max(...us)).toBeCloseTo(front.u1);
  });
});
