import { describe, expect, it } from 'vitest';
import type { PanelRect } from '../../types/template';
import type { Placement } from '../../types/layers';
import { buildTemplateById } from '../../templates';
import { boxRect } from '../box';
import { MOVING, MIN_SIZE_MM, moveRect, placementFromRect, resizeRect, sidesOf, snapRect, snapTargets } from './manipulate';
import { placementToBox } from './placement';

const r = { xMm: 10, yMm: 20, widthMm: 40, heightMm: 20 };
const panel: PanelRect = { id: 'front', label: 'Front', xMm: 0, yMm: 0, widthMm: 100, heightMm: 200 };

describe('resizeRect', () => {
  it('moves only the dragged edge of an edge handle', () => {
    expect(resizeRect(r, 'e', 5, 99)).toEqual({ ...r, widthMm: 45 });
    expect(resizeRect(r, 'w', 5, 99)).toEqual({ xMm: 15, yMm: 20, widthMm: 35, heightMm: 20 });
    expect(resizeRect(r, 's', 99, 4)).toEqual({ ...r, heightMm: 24 });
    expect(resizeRect(r, 'n', 99, -4)).toEqual({ xMm: 10, yMm: 16, widthMm: 40, heightMm: 24 });
  });

  it('moves two edges of a corner, keeping the opposite corner fixed', () => {
    expect(resizeRect(r, 'se', 6, 3)).toEqual({ xMm: 10, yMm: 20, widthMm: 46, heightMm: 23 });
    expect(resizeRect(r, 'nw', -6, -3)).toEqual({ xMm: 4, yMm: 17, widthMm: 46, heightMm: 23 });
  });

  it('keeps the shape of a corner when it must (the larger change wins), anchored at the opposite corner', () => {
    const out = resizeRect(r, 'se', 20, 1, 2); // 40x20 is 2:1
    expect(out.widthMm / out.heightMm).toBeCloseTo(2);
    expect(out.widthMm).toBeCloseTo(60);
    expect([out.xMm, out.yMm]).toEqual([10, 20]);
    const nw = resizeRect(r, 'nw', -10, -1, 2);
    expect(nw.widthMm / nw.heightMm).toBeCloseTo(2);
    expect(nw.xMm + nw.widthMm).toBeCloseTo(50);
    expect(nw.yMm + nw.heightMm).toBeCloseTo(40);
  });

  it('never goes under the minimum or inside out', () => {
    const e = resizeRect(r, 'e', -500, 0);
    expect(e.widthMm).toBe(MIN_SIZE_MM);
    expect(e.xMm).toBe(10);
    const w = resizeRect(r, 'w', 500, 0);
    expect(w.widthMm).toBe(MIN_SIZE_MM);
    expect(w.xMm + w.widthMm).toBe(50);
    expect(resizeRect(r, 'se', -500, -500, 2).widthMm).toBeGreaterThanOrEqual(MIN_SIZE_MM);
  });
});

describe('snapRect', () => {
  const targets = snapTargets(panel, [{ xMm: 70, yMm: 100, widthMm: 10, heightMm: 10 }], 3);

  it('has the panel edges, middle and safe margin, and other layers', () => {
    expect(targets.xs).toEqual(expect.arrayContaining([0, 50, 100, 3, 97, 70, 75, 80]));
    expect(targets.ys).toEqual(expect.arrayContaining([0, 100, 200, 3, 197, 110]));
  });

  it('pulls a moved box onto a line within range, and reports the guide', () => {
    const { rect, guides } = snapRect({ xMm: 29.2, yMm: 60, widthMm: 40, heightMm: 20 }, MOVING, targets, 1.5, true);
    expect(rect.xMm + rect.widthMm / 2).toBe(50); // its middle onto the panel's
    expect(guides).toContainEqual({ axis: 'x', at: 50 });
  });

  it('leaves a box alone when nothing is in range', () => {
    const { rect, guides } = snapRect({ xMm: 20, yMm: 60, widthMm: 7, heightMm: 7 }, MOVING, targets, 0.5, true);
    expect(rect).toEqual({ xMm: 20, yMm: 60, widthMm: 7, heightMm: 7 });
    expect(guides).toEqual([]);
  });

  it('moves only the dragged edge when resizing', () => {
    const start = { xMm: 10, yMm: 60, widthMm: 40, heightMm: 20 };
    const dragged = resizeRect(start, 'e', 39.4, 0); // right edge at 89.4, near the 90? no: near 97 safe? use 100 edge
    const { rect } = snapRect(dragged, sidesOf('e'), targets, 1, false);
    expect(rect.xMm).toBe(10);
    expect(rect.xMm + rect.widthMm).toBeCloseTo(89.4); // nothing within 1 mm of 89.4
    const near = snapRect({ ...start, widthMm: 69.6 }, sidesOf('e'), targets, 1, false);
    expect(near.rect.xMm + near.rect.widthMm).toBe(80); // pulled onto the other layer's right edge
    expect(near.rect.xMm).toBe(10);
  });

  it('only snaps the sides it is told to', () => {
    const { guides } = snapRect({ xMm: 29.2, yMm: 60, widthMm: 40, heightMm: 20 }, sidesOf('s'), targets, 1.5, false);
    expect(guides.every((g) => g.axis === 'y')).toBe(true);
  });
});

describe('moveRect', () => {
  it('shifts without resizing', () => expect(moveRect(r, 3, -2)).toEqual({ xMm: 13, yMm: 18, widthMm: 40, heightMm: 20 }));
});

describe('placementFromRect', () => {
  const rect = { xMm: 30, yMm: 40, widthMm: 40, heightMm: 20 }; // 30–70% across, 20–30% down of the 100×200 panel
  const stays = (p: Placement) => {
    const b = placementToBox(panel, p, 2);
    const back = boxRect(panel, b);
    expect([back.xMm, back.yMm, back.widthMm, back.heightMm].map((n) => Math.round(n * 100) / 100)).toEqual([30, 40, 40, 20]);
  };

  it('turns an automatic placement into one stretched between edges that holds the box exactly', () => {
    const p = placementFromRect(panel, null, rect, { x: true, y: true });
    expect(p.x.anchor).toBe('stretch');
    stays(p);
    expect(placementFromRect(panel, { kind: 'legacy', xMm: 3 }, rect, { x: false, y: false }).y.anchor).toBe('stretch');
  });

  it('keeps each axis anchored the way it was', () => {
    const old: Placement = { x: { anchor: 'center', offset: 10, size: 5 }, y: { anchor: 'end', offset: 1, size: 5 } };
    const p = placementFromRect(panel, old, rect, { x: true, y: true });
    expect(p.x).toEqual({ anchor: 'center', offset: 50, size: 40 });
    expect(p.y).toEqual({ anchor: 'end', offset: 70, size: 10 });
    stays(p);
  });

  it('keeps a length that follows the picture auto unless that axis was resized', () => {
    const old: Placement = { x: { anchor: 'start', offset: 0, size: 10 }, y: { anchor: 'start', offset: 0, size: 'auto' } };
    expect(placementFromRect(panel, old, rect, { x: true, y: false }).y).toMatchObject({ anchor: 'start', size: 'auto' });
    expect(placementFromRect(panel, old, rect, { x: false, y: true }).y).toMatchObject({ anchor: 'start', size: 10 });
    expect(placementFromRect(panel, old, rect, { x: false, y: false }).x).toMatchObject({ size: 40 });
  });
});

it('has a template to place against', () => {
  expect(buildTemplateById('bluray-us-11').panels.length).toBeGreaterThan(0);
});
