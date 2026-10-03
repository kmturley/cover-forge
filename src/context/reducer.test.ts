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

});

describe('shared and override settings', () => {
  const two = () => {
    let s = reducer(initialState, { type: 'addItem', item: item('a') });
    s = reducer(s, { type: 'addItem', item: item('b') });
    return s;
  };

  const half = { xStart: 0, xEnd: 50, yStart: 0, yEnd: 100 };

  it('shared edits reach every item; item edits reach only that item', () => {
    let s = two();
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { transform: { box: half } } });
    s = reducer(s, { type: 'updatePanel', id: 'a', panel: 'front', patch: { transform: { opacity: 0.5 } } });
    const at = (id: string) => resolvePanel(s.shared, s.items.find((i) => i.id === id)!, 'front', null).transform;
    expect(at('a')).toMatchObject({ box: half, opacity: 0.5 }); // still follows the shared box
    expect(at('b')).toMatchObject({ box: half, opacity: 1 });
  });

  it('merges transform fields and clears with undefined', () => {
    let s = reducer(initialState, { type: 'updatePanel', id: null, panel: 'back', patch: { transform: { box: half } } });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'back', patch: { transform: { fit: 'fit' } } });
    expect(s.shared.panels.back?.transform).toEqual({ box: half, fit: 'fit' });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'back', patch: { transform: undefined } });
    expect(s.shared.panels.back).toEqual({});
  });

  it('writing a box replaces the layer’s older mm placement, which then no longer applies', () => {
    let s = reducer(two(), { type: 'loadState', state: { ...two(), shared: { ...initialState.shared, panels: { back: { transform: { xMm: 5, scale: 2 } as never, logo: { widthMm: 10, xMm: 1 } as never } } } } });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'back', patch: { transform: { box: half }, logo: { box: null } } });
    expect(s.shared.panels.back).toEqual({ transform: { box: half }, logo: { box: null } });
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

  it('merges logo fields, applies them per scope, and clears a field with undefined', () => {
    let s = two();
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { logo: { brand: 'steam', widthMm: 20 } } });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { logo: { color: '#000000' } } });
    expect(s.shared.panels.front?.logo).toEqual({ brand: 'steam', widthMm: 20, color: '#000000' });
    s = reducer(s, { type: 'updatePanel', id: 'a', panel: 'front', patch: { logo: { brand: null } } });
    const brandOf = (id: string) => resolvePanel(s.shared, s.items.find((i) => i.id === id)!, 'front', null).logo.brand;
    expect(brandOf('a')).toBeNull();
    expect(brandOf('b')).toBe('steam');
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { logo: { widthMm: undefined } } });
    expect(s.shared.panels.front?.logo).toEqual({ brand: 'steam', color: '#000000' });
    s = reducer(s, { type: 'clearOverrides', id: 'a', panel: 'front' });
    expect(brandOf('a')).toBe('steam'); // follows shared again
  });

  it('defaults the spine text height to automatic', () => {
    expect(initialState.shared.spine.textHeightMm).toBeUndefined();
  });
});

describe('templates', () => {
  const typed = (id: string, type: MediaItem['type']): MediaItem => ({ ...item(id), type });

  it('gives each new item its original case by default', () => {
    let s = reducer(initialState, { type: 'addItem', item: typed('g', 'game') });
    s = reducer(s, { type: 'addItem', item: typed('m', 'movie') });
    s = reducer(s, { type: 'addItem', item: typed('c', 'music') });
    expect(s.items.map((i) => [i.id, i.templateId])).toEqual([['c', 'cd-jewel'], ['g', 'game-case-pc'], ['m', 'dvd-std-14']]);
  });

  it('keeps a template the added item already names', () => {
    const s = reducer(initialState, { type: 'addItem', item: { ...typed('g', 'game'), templateId: 'game-case-ps2' } });
    expect(s.items[0].templateId).toBe('game-case-ps2');
  });

  it('new items start with the case last picked for their media type', () => {
    let s = reducer(initialState, { type: 'addItem', item: typed('a', 'game') });
    s = reducer(s, { type: 'addItem', item: typed('m', 'movie') });
    s = reducer(s, { type: 'setItemTemplate', items: ['a'], template: 'game-case-ps4' });
    expect(s.lastTemplates).toEqual({ game: 'game-case-ps4' });
    s = reducer(s, { type: 'addItem', item: typed('b', 'game') });
    s = reducer(s, { type: 'addItem', item: typed('n', 'movie') });
    expect(Object.fromEntries(s.items.map((i) => [i.id, i.templateId]))).toEqual({ a: 'game-case-ps4', b: 'game-case-ps4', m: 'dvd-std-14', n: 'dvd-std-14' });
  });

  it('a bulk change sets the last case for every type it touched', () => {
    let s = reducer(initialState, { type: 'addItem', item: typed('a', 'game') });
    s = reducer(s, { type: 'addItem', item: typed('m', 'movie') });
    s = reducer(s, { type: 'setItemTemplate', items: ['a', 'm'], template: 'bluray-us-11' });
    expect(s.lastTemplates).toEqual({ game: 'bluray-us-11', movie: 'bluray-us-11' });
  });

  it('the editor template follows the selected item, and falls back to the first panel it has', () => {
    let s = reducer(initialState, { type: 'addItem', item: { ...typed('a', 'game'), templateId: 'dvd-slim-7' } });
    s = reducer(s, { type: 'addItem', item: { ...typed('b', 'game'), templateId: 'floppy-face' } });
    s = reducer(s, { type: 'selectItem', id: 'a' });
    s = reducer(s, { type: 'selectPanel', panel: 'spine' });
    expect(s.template.id).toBe('dvd-slim-7');
    expect(s.template.panels[1].widthMm).toBe(7);
    s = reducer(s, { type: 'selectItem', id: 'b' });
    expect(s.template.id).toBe('floppy-face');
    expect(s.selectedPanel).toBe('front');
  });

  it('sets a template on many items at once, and ignores unknown templates', () => {
    let s = reducer(initialState, { type: 'addItem', item: typed('a', 'game') });
    s = reducer(s, { type: 'addItem', item: typed('b', 'movie') });
    s = reducer(s, { type: 'setItemTemplate', items: ['a', 'b'], template: 'vhs-std-25' });
    expect(s.items.map((i) => i.templateId)).toEqual(['vhs-std-25', 'vhs-std-25']);
    expect(s.templateId).toBe('vhs-std-25');
    expect(s.template.kind).toBe('vhs');
    expect(reducer(s, { type: 'setItemTemplate', items: ['a'], template: 'laserdisc' })).toBe(s);
  });

  it('shared settings survive a template change (same panel id, new template)', () => {
    let s = reducer(initialState, { type: 'updatePanel', id: null, panel: 'front', patch: { backgroundColor: '#123456' } });
    s = reducer(s, { type: 'setItemTemplate', items: [], template: 'cassette-std' });
    expect(s.template.kind).toBe('cassette');
    expect(s.shared.panels.front?.backgroundColor).toBe('#123456');
  });
});

describe('addAsset', () => {
  it('appends to the item library and leaves other items alone', () => {
    let s = reducer(initialState, { type: 'addItem', item: item('a') });
    s = reducer(s, { type: 'addItem', item: item('b') });
    s = reducer(s, { type: 'addAsset', id: 'a', url: 'data:image/png;base64,AA' });
    s = reducer(s, { type: 'addAsset', id: 'a', url: 'data:image/png;base64,BB' });
    expect(s.items[0].assets.screenshots).toEqual(['data:image/png;base64,AA', 'data:image/png;base64,BB']);
    expect(s.items[1].assets.screenshots).toEqual([]);
  });
});
