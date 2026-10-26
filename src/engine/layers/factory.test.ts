import { describe, expect, it } from 'vitest';
import { duplicateLayer, freshId, newImage, newShape } from './factory';

describe('freshId', () => {
  it('is random and never one that is taken', () => {
    const a = freshId('image');
    expect(a).toMatch(/^image-[a-z0-9]{1,6}$/);
    expect(freshId('image', [a])).not.toBe(a);
  });
});

describe('duplicateLayer', () => {
  it('copies with a new id, moved a little, and as a plain layer', () => {
    const l = newShape('s1', 'front', { name: 'Gold bar', follows: 'spine.fill', placement: { x: { anchor: 'start', offset: 10, size: 20 }, y: { anchor: 'stretch', start: 5, end: 5 } } });
    const c = duplicateLayer(l, ['s1']);
    expect(c.id).not.toBe('s1');
    expect(c.name).toBe('Gold bar copy');
    expect(c.follows).toBeUndefined();
    expect(c.placement).toEqual({ x: { anchor: 'start', offset: 12, size: 20 }, y: { anchor: 'stretch', start: 7, end: 3 } });
    expect(l.placement).toEqual({ x: { anchor: 'start', offset: 10, size: 20 }, y: { anchor: 'stretch', start: 5, end: 5 } });
  });
  it('leaves an automatic placement and an unnamed layer alone', () => {
    const c = duplicateLayer(newImage('i', 'front', null, { placement: null }));
    expect(c.placement).toBeNull();
    expect(c.name).toBeUndefined();
  });
});
