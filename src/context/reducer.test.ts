import { describe, expect, it } from 'vitest';
import { initialState, reducer } from './AppContext';
import type { MediaItem } from '../types/media';
import { itemHasOverrides, panelHasOverride, resolvePanel, resolveSpine } from '../engine/resolve';

const item = (id: string): MediaItem => ({
  id,
  type: 'game',
  title: id,
  assets: { cover: null, hero: null, logo: null, screenshots: [] },
});

describe('reducer', () => {
  it('adds, dedupes and selects items', () => {
    let s = reducer(initialState, { type: 'addItem', item: item('a') });
    s = reducer(s, { type: 'addItem', item: item('b') });
    s = reducer(s, { type: 'addItem', item: item('a') });
    expect(s.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(s.selectedItemId).toBe('a');
  });

  it('reselects a neighbour when the selected item is removed', () => {
    let s = reducer(initialState, { type: 'addItem', item: item('a') });
    s = reducer(s, { type: 'addItem', item: item('b') });
    s = reducer(s, { type: 'removeItem', id: 'b' });
    expect(s.selectedItemId).toBe('a');
  });

  it('switching region resets the spine to that region default', () => {
    const s = reducer(initialState, { type: 'setRegion', region: 'EU' });
    expect(s.template.spineMm).toBe(14);
  });
});

describe('shared and override settings', () => {
  const two = () => {
    let s = reducer(initialState, { type: 'addItem', item: item('a') });
    s = reducer(s, { type: 'addItem', item: item('b') });
    return s;
  };

  it('shared edits reach every item; item edits reach only that item', () => {
    let s = two();
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { transform: { scale: 2 } } });
    s = reducer(s, { type: 'updatePanel', id: 'a', panel: 'front', patch: { transform: { opacity: 0.5 } } });
    const at = (id: string) => resolvePanel(s.shared, s.items.find((i) => i.id === id)!, 'front').transform;
    expect(at('a')).toMatchObject({ scale: 2, opacity: 0.5 }); // still follows shared size
    expect(at('b')).toMatchObject({ scale: 2, opacity: 1 });
  });

  it('merges transform fields and clears with undefined', () => {
    let s = reducer(initialState, { type: 'updatePanel', id: null, panel: 'back', patch: { transform: { scale: 2 } } });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'back', patch: { transform: { panXMm: 5 } } });
    expect(s.shared.panels.back?.transform).toEqual({ scale: 2, panXMm: 5 });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'back', patch: { transform: undefined } });
    expect(s.shared.panels.back).toEqual({});
  });

  it('clearOverrides removes one panel or everything, leaving shared untouched', () => {
    let s = reducer(two(), { type: 'updatePanel', id: null, panel: 'front', patch: { backgroundColor: '#111' } });
    s = reducer(s, { type: 'updatePanel', id: 'a', panel: 'front', patch: { image: 'logo' } });
    s = reducer(s, { type: 'updatePanel', id: 'a', panel: 'back', patch: { image: null } });
    s = reducer(s, { type: 'updateSpine', id: 'a', patch: { color: '#f00' } });
    s = reducer(s, { type: 'updatePanel', id: 'a', panel: 'spine', patch: { backgroundColor: '#0f0' } });
    const a = () => s.items.find((i) => i.id === 'a')!;
    expect(itemHasOverrides(a())).toBe(true);

    s = reducer(s, { type: 'clearOverrides', id: 'a', panel: 'front' });
    expect(panelHasOverride(a(), 'front')).toBe(false);
    expect(panelHasOverride(a(), 'back')).toBe(true);

    s = reducer(s, { type: 'clearOverrides', id: 'a' });
    expect(itemHasOverrides(a())).toBe(false);
    expect(a().spineOverride).toBeUndefined();
    expect(s.shared.panels.front?.backgroundColor).toBe('#111');
  });

  it('shared spine style ignores per-item text; item spine overrides layer on top', () => {
    let s = reducer(two(), { type: 'updateSpine', id: null, patch: { textHeightMm: 5, text: 'nope' } });
    expect(s.shared.spine).not.toHaveProperty('text');
    s = reducer(s, { type: 'updateSpine', id: 'b', patch: { text: 'Custom' } });
    expect(resolveSpine(s.shared, s.items[1])).toMatchObject({ textHeightMm: 5, text: 'Custom' });
    expect(resolveSpine(s.shared, s.items[0]).text).toBeUndefined();
  });

  it('defaults the spine text height to 4 mm', () => {
    expect(initialState.shared.spine.textHeightMm).toBe(4);
  });
});
