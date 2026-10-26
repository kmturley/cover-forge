import { describe, expect, it } from 'vitest';
import type { Layer, ShapeLayer } from '../../types/layers';
import { applyDiff, applyPatch } from './diff';

const rect = (id: string, fill: string | null = null): ShapeLayer => ({
  id, type: 'shape', shape: 'rect', target: 'front', visible: true, placement: null, rotationDeg: 0, opacity: 1, fill,
  stroke: { color: '#fff', widthMm: 0, insetMm: 3 },
});
const ids = (ls: readonly Layer[]) => ls.map((l) => l.id);

describe('applyPatch', () => {
  it('changes only the fields it names, and null sets a field', () => {
    const l = applyPatch(rect('a', '#111'), { opacity: 0.5, fill: null });
    expect(l).toMatchObject({ opacity: 0.5, fill: null, rotationDeg: 0 });
  });

  it('leaves a field alone when the patch has it undefined', () => {
    expect(applyPatch(rect('a', '#111'), { fill: undefined }).fill).toBe('#111');
  });

  it('merges nested stroke settings field by field', () => {
    const l = applyPatch(applyPatch(rect('a'), { stroke: { widthMm: 2 } }), { stroke: { color: '#f00' } }) as ShapeLayer;
    expect(l.stroke).toEqual({ color: '#f00', widthMm: 2, insetMm: 3 });
  });

  it('merges older mm placements across levels, but a box replaces them whole', () => {
    const a = applyPatch(rect('a'), { placement: { kind: 'legacy', xMm: 10, yMm: 5 } });
    expect(applyPatch(a, { placement: { kind: 'legacy', scale: 2 } }).placement).toEqual({ kind: 'legacy', xMm: 10, yMm: 5, scale: 2 });
    expect(applyPatch(a, { placement: null }).placement).toBeNull();
  });
});

describe('applyDiff', () => {
  const base = [rect('a', '#a'), rect('b', '#b'), rect('c', '#c')];

  it('returns the layers untouched without a diff', () => {
    expect(applyDiff(base, undefined)).toBe(base);
  });

  it('patches by id and ignores ids the case does not have', () => {
    const out = applyDiff(base, { patch: { b: { fill: '#new' }, gone: { fill: '#x' } } }) as ShapeLayer[];
    expect(out.map((l) => l.fill)).toEqual(['#a', '#new', '#c']);
  });

  it('removes hidden layers', () => {
    expect(ids(applyDiff(base, { hidden: ['b', 'nothing'] }))).toEqual(['a', 'c']);
  });

  it('adds layers on top, or above a named layer (on top if that layer is gone)', () => {
    expect(ids(applyDiff(base, { added: [{ layer: rect('x') }, { layer: rect('y'), after: 'a' }, { layer: rect('z'), after: 'missing' }] }))).toEqual(['a', 'y', 'b', 'c', 'x', 'z']);
  });

  it('reorders the named layers into the slots they held, leaving the rest in place', () => {
    expect(ids(applyDiff(base, { order: ['c', 'a'] }))).toEqual(['c', 'b', 'a']);
    expect(ids(applyDiff(base, { order: ['c', 'b', 'a'] }))).toEqual(['c', 'b', 'a']);
  });

  it('applies the steps in order: patch, add, hide, then order', () => {
    const out = applyDiff(base, { hidden: ['a'], added: [{ layer: rect('n'), after: 'b' }], order: ['n', 'c'] });
    expect(ids(out)).toEqual(['b', 'n', 'c']);
  });
});
