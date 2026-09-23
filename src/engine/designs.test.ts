import { describe, expect, it } from 'vitest';
import { initialState, reducer, targetDesignId, type AppState } from '../context/AppContext';
import { restoreSession, serializeSession } from '../context/session';
import type { MediaItem } from '../types/media';
import type { Design } from '../types/editor';
import { DEFAULT_DESIGN_ID, designOf, layeredShared, usersOf } from './designs';
import { resolvePanel } from './resolve';

const item = (id: string, type: MediaItem['type'] = 'game'): MediaItem => ({ id, type, title: id, assets: { cover: 'c', hero: 'h', logo: null, screenshots: [] } });
const design = (id: string, panels: Design['panels'] = {}, spine: Design['spine'] = {}): Design => ({ id, name: id, panels, spine });

const withItems = (...ids: string[]): AppState => ids.reduce((s, id) => reducer(s, { type: 'addItem', item: item(id) }), initialState);

describe('layering', () => {
  const shared = { panels: { front: { logo: { brand: 'steam', xMm: 1 } } }, spine: { fontFamily: 'A', color: '#fff' } };
  const d = design('d', { front: { backgroundColor: '#222222', logo: { brand: 'epic' } } }, { color: '#000' });

  it('puts a design on top of Default field by field, keeping what it does not set', () => {
    const s = layeredShared(shared, d);
    expect(s.panels.front).toEqual({ backgroundColor: '#222222', logo: { brand: 'epic', xMm: 1 } });
    expect(s.spine).toEqual({ fontFamily: 'A', color: '#000' });
  });

  it('returns Default itself when there is no design, so memoising still works', () => {
    expect(layeredShared(shared, undefined)).toBe(shared);
  });

  it('keeps the item overrides on top of its design', () => {
    const it = { ...item('a'), panels: { front: { logo: { brand: 'itch' } } } };
    expect(resolvePanel(layeredShared(shared, d), it, 'front').logo).toMatchObject({ brand: 'itch', xMm: 1 });
  });

  it('finds an item\'s design, and treats a missing one as Default', () => {
    expect(designOf([d], { ...item('a'), designId: 'd' })).toBe(d);
    expect(designOf([d], { ...item('a'), designId: 'gone' })).toBeUndefined();
    expect(designOf([d], item('a'))).toBeUndefined();
  });
});

describe('designs in the reducer', () => {
  it('edits Default for an item without a design, and its own design otherwise', () => {
    let s = withItems('a', 'b');
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { backgroundColor: '#111111' } });
    expect(s.shared.panels.front!.backgroundColor).toBe('#111111');
    s = reducer(s, { type: 'forkDesign', id: 'd1', name: 'Fork', from: DEFAULT_DESIGN_ID, items: ['a'] });
    expect(s.designs).toEqual([{ id: 'd1', name: 'Fork', panels: {}, spine: {} }]);
    s = reducer(s, { type: 'selectItem', id: 'a' });
    expect(targetDesignId(s)).toBe('d1');
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { logo: { brand: 'gog' } } });
    expect(s.designs[0].panels.front).toEqual({ logo: { brand: 'gog' } });
    expect(s.shared.panels.front).toEqual({ backgroundColor: '#111111' });
  });

  it('forks a copy of a design, and gives it to the chosen items', () => {
    let s = withItems('a', 'b', 'c');
    s = reducer(s, { type: 'forkDesign', id: 'd1', name: 'One', from: DEFAULT_DESIGN_ID, items: ['a', 'b'] });
    s = reducer(s, { type: 'selectItem', id: 'a' });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { logo: { brand: 'x' } } });
    s = reducer(s, { type: 'forkDesign', id: 'd2', name: 'Two', from: 'd1', items: ['b'] });
    expect(s.designs.find((d) => d.id === 'd2')!.panels).toEqual({ front: { logo: { brand: 'x' } } });
    expect(s.designs.find((d) => d.id === 'd2')!.panels).not.toBe(s.designs[0].panels); // a copy, not shared
    expect(s.items.map((i) => i.designId)).toEqual(['d1', 'd2', undefined]);
    expect(usersOf(s.items, s.designs, 'd1').map((i) => i.id)).toEqual(['a']);
    expect(usersOf(s.items, s.designs, DEFAULT_DESIGN_ID).map((i) => i.id)).toEqual(['c']);
  });

  it('reassigns items, and sends them back to Default when a design is deleted', () => {
    let s = withItems('a', 'b');
    s = reducer(s, { type: 'forkDesign', id: 'd1', name: 'One', from: DEFAULT_DESIGN_ID, items: ['a'] });
    s = reducer(s, { type: 'assignDesign', items: ['a', 'b'], design: 'd1' });
    expect(s.items.map((i) => i.designId)).toEqual(['d1', 'd1']);
    s = reducer(s, { type: 'assignDesign', items: ['b'], design: 'missing' });
    expect(s.items[1].designId).toBeUndefined();
    s = reducer(s, { type: 'deleteDesign', id: 'd1' });
    expect(s.designs).toEqual([]);
    expect(s.items.every((i) => i.designId === undefined)).toBe(true);
  });

  it('renames and clears one panel or a whole design', () => {
    let s = withItems('a');
    s = reducer(s, { type: 'forkDesign', id: 'd1', name: 'One', from: DEFAULT_DESIGN_ID, items: ['a'] });
    s = reducer(s, { type: 'selectItem', id: 'a' });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { backgroundColor: '#123456' } });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'back', patch: { backgroundColor: '#654321' } });
    s = reducer(s, { type: 'clearDesign', design: 'd1', panel: 'front' });
    expect(Object.keys(s.designs[0].panels)).toEqual(['back']);
    s = reducer(s, { type: 'clearDesign', design: 'd1' });
    expect(s.designs[0].panels).toEqual({});
    s = reducer(s, { type: 'renameDesign', id: 'd1', name: 'Renamed' });
    expect(s.designs[0].name).toBe('Renamed');
  });
});

describe('saving designs', () => {
  const base = (() => {
    let s = withItems('a', 'b');
    s = reducer(s, { type: 'forkDesign', id: 'd1', name: 'One', from: DEFAULT_DESIGN_ID, items: ['a'] });
    s = reducer(s, { type: 'selectItem', id: 'a' });
    return reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { logo: { brand: 'epic' } } });
  })();

  it('round-trips the designs and which item uses which', () => {
    const json = JSON.parse(JSON.stringify(serializeSession(base)));
    const back = restoreSession(json, initialState);
    expect(back.designs).toEqual(base.designs);
    expect(back.items.map((i) => i.designId)).toEqual(['d1', undefined]);
    expect(serializeSession(withItems('a'))).not.toHaveProperty('designs');
  });

  it('drops malformed designs and assignments to designs that are gone', () => {
    const json = JSON.parse(JSON.stringify(serializeSession(base)));
    json.designs.push('junk', { id: 'default', name: 'x' }, { id: 'd1', name: 'dup' });
    json.items[1].designId = 'ghost';
    const back = restoreSession(json, initialState);
    expect(back.designs.map((d) => d.id)).toEqual(['d1']);
    expect(back.items[1].designId).toBeUndefined();
  });

  it('turns earlier per media type rules into designs given to that type', () => {
    const json = { ...JSON.parse(JSON.stringify(serializeSession(withItems('a')))), scopes: [
      { type: 'game', template: 'dvd', panels: { front: { logo: { brand: 'steam' } } }, spine: {} },
      { type: null, template: 'dvd', panels: { front: { backgroundColor: '#000000' } }, spine: {} },
    ] };
    json.items.push(item('m', 'music'));
    const back = restoreSession(json, initialState);
    expect(back.designs.map((d) => d.name)).toEqual(['Games · DVD']);
    expect(back.items.find((i) => i.id === 'a')!.designId).toBe(back.designs[0].id);
    expect(back.items.find((i) => i.id === 'm')!.designId).toBeUndefined();
  });
});
