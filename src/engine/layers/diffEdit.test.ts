import { describe, expect, it } from 'vitest';
import type { ShapeLayer } from '../../types/layers';
import { applyDiff } from './diff';
import { diffAdd, diffOrder, diffRemove, diffReset, diffTouchesPanel, diffUpdate, diffWithoutPanel, mergeDiffs, mergePatch } from './diffEdit';

const rect = (id: string, target: ShapeLayer['target'] = 'front'): ShapeLayer => ({
  id, type: 'shape', shape: 'rect', target, visible: true, placement: null, rotationDeg: 0, opacity: 1, fill: null,
  stroke: { color: '#fff', widthMm: 0, insetMm: 3 },
});

describe('mergePatch', () => {
  it('drops a field set to undefined so the layer inherits it again', () => {
    expect(mergePatch({ fill: '#f00', opacity: 0.5 }, { fill: undefined })).toEqual({ opacity: 0.5 });
  });
  it('merges stroke and params field by field and removes them when emptied', () => {
    expect(mergePatch({ stroke: { color: '#f00' } }, { stroke: { widthMm: 2 } })).toEqual({ stroke: { color: '#f00', widthMm: 2 } });
    expect(mergePatch({ stroke: { widthMm: 2 } }, { stroke: { widthMm: undefined } })).toEqual({});
  });
});

describe('diff edits', () => {
  it('updates a layer from below with a patch, and a layer it added in place', () => {
    let d = diffUpdate({}, 'front.fill', { fill: '#111' });
    expect(d.patch).toEqual({ 'front.fill': { fill: '#111' } });
    d = diffAdd(d, rect('x'));
    d = diffUpdate(d, 'x', { fill: '#222' });
    expect((d.added![0].layer as ShapeLayer).fill).toBe('#222');
    expect(d.patch).toEqual({ 'front.fill': { fill: '#111' } });
  });

  it('removes: an added layer vanishes, a lower one is hidden and its patch dropped; reset brings it back', () => {
    let d = diffAdd(diffUpdate({}, 'a', { fill: '#1' }), rect('x'));
    d = diffRemove(d, 'x');
    expect(d.added).toBeUndefined();
    d = diffRemove(d, 'a');
    expect(d).toEqual({ hidden: ['a'] });
    expect(diffReset(d, 'a')).toEqual({});
  });

  it('keeps the diff free of empty fields', () => {
    expect(diffReset(diffUpdate({}, 'a', { fill: '#1' }), 'a')).toEqual({});
  });

  it('round-trips through applyDiff', () => {
    const base = [rect('a'), rect('b')];
    let d = diffAdd({}, rect('n'), 'a');
    d = diffUpdate(d, 'b', { fill: '#bbb' });
    d = diffRemove(d, 'a');
    d = diffOrder(d, ['b']);
    const out = applyDiff(base, d) as ShapeLayer[];
    expect(out.map((l) => l.id)).toEqual(['n', 'b']);
    expect(out[1].fill).toBe('#bbb');
  });

  it('knows which panels it touches and can forget one panel', () => {
    let d = diffUpdate({}, 'front.image', { opacity: 0.5 });
    d = diffAdd(d, rect('extra', 'back'));
    d = diffUpdate(d, 'extra', { fill: '#1' });
    d = diffOrder(d, ['extra']);
    expect(diffTouchesPanel(d, 'front')).toBe(true);
    expect(diffTouchesPanel(d, 'back')).toBe(true);
    expect(diffTouchesPanel(d, 'spine')).toBe(false);
    expect(diffWithoutPanel(d, 'back')).toEqual({ patch: { 'front.image': { opacity: 0.5 } } });
    expect(diffWithoutPanel(undefined, 'back')).toEqual({});
  });
});

describe('mergeDiffs', () => {
  const base = [rect('a', 'front'), rect('b', 'front'), rect('c', 'front')];
  const same = (under: Parameters<typeof mergeDiffs>[0], over: Parameters<typeof mergeDiffs>[1]) => {
    const once = applyDiff(applyDiff(base, under), over);
    const merged = applyDiff(base, mergeDiffs(under, over));
    expect(merged).toEqual(once);
    return merged;
  };

  it('is one diff that does what the two do in turn', () => {
    same({ patch: { a: { fill: '#1' } }, hidden: ['b'] }, { patch: { a: { opacity: 0.5 }, c: { fill: '#3' } }, added: [{ layer: rect('x') }] });
  });
  it('folds a change to a layer the lower diff added into that layer', () => {
    const out = same({ added: [{ layer: rect('n', 'front') }] }, { patch: { n: { fill: '#f00' } } }) as ShapeLayer[];
    expect(out.find((l) => l.id === 'n')!.fill).toBe('#f00');
  });
  it('drops a layer the lower diff added when the upper one removes it', () => {
    same({ added: [{ layer: rect('n') }] }, { hidden: ['n'] });
    expect(mergeDiffs({ added: [{ layer: rect('n') }] }, { hidden: ['n'] }).added).toBeUndefined();
  });
  it('lets the upper layer win on the same added id (it replaces it) and on order', () => {
    const out = applyDiff(base, mergeDiffs({ added: [{ layer: rect('n') }], order: ['n', 'a'] }, { added: [{ layer: { ...rect('n'), fill: '#0f0' } }], order: ['c', 'n'] })) as ShapeLayer[];
    expect(out.filter((l) => l.id === 'n')).toHaveLength(1);
    expect(out.find((l) => l.id === 'n')!.fill).toBe('#0f0');
    expect(out.map((l) => l.id).indexOf('c')).toBeLessThan(out.map((l) => l.id).indexOf('n'));
  });
  it('is the other diff when one is missing', () => {
    expect(mergeDiffs(undefined, { hidden: ['a'] })).toEqual({ hidden: ['a'] });
    expect(mergeDiffs({ hidden: ['a'] }, undefined)).toEqual({ hidden: ['a'] });
    expect(mergeDiffs(undefined, undefined)).toEqual({});
  });
});
