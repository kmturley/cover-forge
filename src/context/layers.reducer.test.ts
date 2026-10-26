import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action, type AppState } from './AppContext';
import type { MediaItem } from '../types/media';
import { newImage, newShape } from '../engine/layers/factory';
import { resolveLayers } from '../engine/layers/resolve';
import type { ImageLayer, ShapeLayer } from '../types/layers';
import { itemHasOverrides } from '../engine/resolve';

const item = (id: string): MediaItem => ({ id, type: 'game', title: id, assets: { cover: 'c', hero: 'h', logo: null, screenshots: [] } });
const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);
const start = () => run(initialState, { type: 'addItem', item: item('a') });
const layersOf = (s: AppState, i = s.items[0]) => resolveLayers({ template: s.template, item: i, shared: s.shared, designs: s.designs, });
const find = (s: AppState, id: string) => layersOf(s).find((l) => l.id === id);

describe('layer actions', () => {
  it('adds a layer to the design (the Default one) and every item using it draws it', () => {
    const s = run(start(), { type: 'addLayer', id: null, layer: newShape('shape-1', 'front', { fill: '#123456' }) });
    expect(s.shared.diff?.added).toHaveLength(1);
    expect(find(s, 'shape-1')).toMatchObject({ type: 'shape', fill: '#123456' });
  });

  it('adds a layer to just one item', () => {
    let s = run(start(), { type: 'addItem', item: item('b') });
    s = run(s, { type: 'addLayer', id: 'a', layer: newShape('shape-1', 'front') });
    expect(layersOf(s, s.items[0]).some((l) => l.id === 'shape-1')).toBe(true);
    expect(layersOf(s, s.items[1]).some((l) => l.id === 'shape-1')).toBe(false);
    expect(itemHasOverrides(s.items[0])).toBe(true);
  });

  it('edits into a named design, not Default, when the item uses one', () => {
    let s = run(start(), { type: 'forkDesign', id: 'd1', name: 'D', from: 'default', items: ['a'] });
    s = run(s, { type: 'updateLayer', id: null, layerId: 'front.fill', patch: { fill: '#abcdef' } });
    expect(s.designs[0].diff?.patch?.['front.fill']).toEqual({ fill: '#abcdef' });
    expect(s.shared.diff).toBeUndefined();
    expect(find(s, 'front.fill')).toMatchObject({ fill: '#abcdef' });
  });

  it('patches a default layer, and undefined puts the field back', () => {
    let s = run(start(), { type: 'updateLayer', id: null, layerId: 'front.image', patch: { opacity: 0.4, fit: 'fit' } });
    expect(find(s, 'front.image')).toMatchObject({ opacity: 0.4, fit: 'fit' });
    s = run(s, { type: 'updateLayer', id: null, layerId: 'front.image', patch: { opacity: undefined } });
    expect(find(s, 'front.image')).toMatchObject({ opacity: 1, fit: 'fit' });
  });

  it('removes a default layer by hiding it, and a layer the diff added by dropping it; reset brings the first back', () => {
    let s = run(start(), { type: 'removeLayer', id: null, layerId: 'front.image' }, { type: 'addLayer', id: null, layer: newImage('image-1', 'front', null) });
    expect(find(s, 'front.image')).toBeUndefined();
    s = run(s, { type: 'removeLayer', id: null, layerId: 'image-1' });
    expect(s.shared.diff).toEqual({ hidden: ['front.image'] });
    s = run(s, { type: 'resetLayer', id: null, layerId: 'front.image' });
    expect(find(s, 'front.image')).toBeDefined();
    expect(s.shared.diff).toBeUndefined();
  });

  it('reset also clears the slot settings behind a default layer', () => {
    let s = run(start(), { type: 'updatePanel', id: null, panel: 'front', patch: { backgroundColor: '#111111', border: { widthMm: 2 } } });
    s = run(s, { type: 'resetLayer', id: null, layerId: 'front.fill' });
    expect(s.shared.panels.front).toEqual({ border: { widthMm: 2 } });
    expect((find(s, 'front.fill') as ShapeLayer).fill).toBeNull();
    s = run(s, { type: 'updatePanel', id: 'a', panel: 'front', patch: { logo: { brand: 'steam' } } }, { type: 'resetLayer', id: 'a', layerId: 'front.logo' });
    expect(s.items[0].panels).toBeUndefined();
  });

  it('reorders', () => {
    let s = run(start(), { type: 'addLayer', id: null, layer: newShape('s1', 'front') }, { type: 'addLayer', id: null, layer: newShape('s2', 'front') });
    s = run(s, { type: 'setLayerOrder', id: null, order: ['s2', 's1'] });
    const ids = layersOf(s).map((l) => l.id);
    expect(ids.indexOf('s2')).toBeLessThan(ids.indexOf('s1'));
  });

  it('clearing a panel in a design or an item forgets its layer changes too', () => {
    let s = run(start(), { type: 'addLayer', id: null, layer: newShape('s1', 'back') }, { type: 'updateLayer', id: null, layerId: 'front.image', patch: { opacity: 0.5 } });
    s = run(s, { type: 'clearDesign', design: 'default', panel: 'back' });
    expect(s.shared.diff?.added).toBeUndefined();
    expect(s.shared.diff?.patch).toBeDefined();
    s = run(s, { type: 'addLayer', id: 'a', layer: newShape('s2', 'front') }, { type: 'clearOverrides', id: 'a', panel: 'front' });
    expect(s.items[0].diff).toBeUndefined();
  });

  it('forking a design copies its layers', () => {
    let s = run(start(), { type: 'addLayer', id: null, layer: newImage('image-1', 'back', { kind: 'asset', id: 'x' }) });
    s = run(s, { type: 'forkDesign', id: 'd1', name: 'D', from: 'default', items: ['a'] });
    // A fork from Default starts empty: only what it changes differs.
    expect(s.designs[0].diff).toBeUndefined();
    s = run(s, { type: 'addLayer', id: null, layer: newShape('s1', 'front') }, { type: 'forkDesign', id: 'd2', name: 'E', from: 'd1', items: ['a'] });
    expect(s.designs[1].diff?.added?.map((a) => a.layer.id)).toEqual(['s1']);
    expect(s.designs[1].diff).not.toBe(s.designs[0].diff);
  });

  it('keeps assets in the library', () => {
    const asset = { id: 'x', name: 'x.png', source: { kind: 'url' as const, url: 'https://e/x.png' } };
    let s = run(start(), { type: 'setAsset', asset });
    expect(s.assets.x).toEqual(asset);
    s = run(s, { type: 'removeAsset', id: 'x' });
    expect(s.assets).toEqual({});
  });
});

describe('undo and redo', () => {
  it('undoes and redoes layer edits, one step each', () => {
    let s = run(start(), { type: 'addLayer', id: null, layer: newShape('s1', 'front') }, { type: 'updateLayer', id: null, layerId: 's1', patch: { fill: '#111111' } });
    expect((find(s, 's1') as ShapeLayer).fill).toBe('#111111');
    s = run(s, { type: 'undo' });
    expect((find(s, 's1') as ShapeLayer).fill).toBe('#808080');
    s = run(s, { type: 'undo' });
    expect(find(s, 's1')).toBeUndefined();
    s = run(s, { type: 'redo' }, { type: 'redo' });
    expect((find(s, 's1') as ShapeLayer).fill).toBe('#111111');
  });

  it('counts a run of edits with the same coalesce key as one step', () => {
    let s = start();
    for (const o of [0.9, 0.8, 0.7, 0.6]) s = run(s, { type: 'updateLayer', id: null, layerId: 'front.image', patch: { opacity: o }, coalesce: 'front.image:opacity' });
    expect(s.history.past).toHaveLength(2); // adding the item, then the whole drag
    s = run(s, { type: 'undo' });
    expect(find(s, 'front.image')).toMatchObject({ opacity: 1 });
  });

  it('starts a new step when something else happens in between', () => {
    let s = start();
    s = run(s, { type: 'updateLayer', id: null, layerId: 'front.image', patch: { opacity: 0.9 }, coalesce: 'k' }, { type: 'selectPanel', panel: 'back' }, { type: 'updateLayer', id: null, layerId: 'front.image', patch: { opacity: 0.5 }, coalesce: 'k' });
    s = run(s, { type: 'undo' });
    expect(find(s, 'front.image')).toMatchObject({ opacity: 0.9 });
  });

  it('forgets the redo steps once something new is done, and does nothing with no history', () => {
    let s = run(start(), { type: 'addLayer', id: null, layer: newShape('s1', 'front') }, { type: 'undo' });
    expect(s.history.future).toHaveLength(1);
    s = run(s, { type: 'addLayer', id: null, layer: newShape('s2', 'front') });
    expect(s.history.future).toHaveLength(0);
    expect(run(initialState, { type: 'undo' })).toBe(initialState);
    expect(run(initialState, { type: 'redo' })).toBe(initialState);
  });

  it('keeps the selection on an item that exists', () => {
    let s = run(start(), { type: 'addItem', item: item('b') });
    expect(s.selectedItemId).toBe('b');
    s = run(s, { type: 'undo' });
    expect(s.selectedItemId).toBe('a');
  });

  it('does not record view changes', () => {
    const s = run(start(), { type: 'setView', view: '2d' }, { type: 'setShowGuides', show: true }, { type: 'selectPanel', panel: 'back' });
    expect(s.history.past).toHaveLength(1);
  });
});

it('draws the asset image layer type through the layer list', () => {
  const s = run(start(), { type: 'addLayer', id: null, layer: newImage('image-1', 'back', { kind: 'asset', id: 'x' }) });
  expect((find(s, 'image-1') as ImageLayer).source).toEqual({ kind: 'asset', id: 'x' });
});

describe('updateLayers', () => {
  it('changes several layers in one undo step', () => {
    let s = run(start(), { type: 'addLayer', id: null, layer: newShape('s1', 'front') }, { type: 'addLayer', id: null, layer: newShape('s2', 'back') });
    s = run(s, { type: 'updateLayers', id: null, layerIds: ['s1', 's2', 'front.fill'], patch: { opacity: 0.5 } });
    expect((find(s, 's1') as ShapeLayer).opacity).toBe(0.5);
    expect((find(s, 's2') as ShapeLayer).opacity).toBe(0.5);
    expect((find(s, 'front.fill') as ShapeLayer).opacity).toBe(0.5);
    s = run(s, { type: 'undo' });
    expect((find(s, 's1') as ShapeLayer).opacity).toBe(1);
    expect((find(s, 'front.fill') as ShapeLayer).opacity).toBe(1);
  });
});
