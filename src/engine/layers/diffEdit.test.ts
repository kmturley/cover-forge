import { describe, expect, it } from 'vitest';
import type { ShapeLayer } from '../../types/layers';
import { applyDiff } from './diff';
import { diffAdd, diffOrder, diffRemove, diffReset, diffTouchesPanel, diffUpdate, diffWithoutPanel, mergePatch } from './diffEdit';

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
