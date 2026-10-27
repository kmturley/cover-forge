import { describe, expect, it } from 'vitest';
import type { Asset } from '../types/layers';
import { newImage, newShape } from '../engine/layers/factory';
import { assetIdsIn, parseDesignFile } from './designFile';
import { DEFAULTS_VERSION } from '../engine/layers/presets';

const file = (over: Record<string, unknown> = {}) => ({ app: 'coverforge-design', version: 1, name: 'Mine', base: 1, panels: { front: { backgroundColor: '#123456' } }, spine: { color: '#ffee00' }, ...over });
const url = (id: string, u: string): Asset => ({ id, name: `${id}.png`, source: { kind: 'url', url: u } });

describe('assetIdsIn', () => {
  it('finds the assets a design’s layers and patches use', () => {
    const ids = assetIdsIn({ added: [{ layer: newImage('i', 'front', { kind: 'asset', id: 'a1' }) }, { layer: newShape('s', 'front') }], patch: { 'front.image': { source: { kind: 'asset', id: 'a2' } }, 'back.fill': { fill: '#fff' } } });
    expect([...ids].sort()).toEqual(['a1', 'a2']);
    expect(assetIdsIn(undefined).size).toBe(0);
  });
});

describe('parseDesignFile', () => {
  it('reads a design, gives it an id of its own and keeps what it stores', () => {
    const { design, assets } = parseDesignFile(file({ diff: { patch: { 'front.image': { opacity: 0.5 } } } }), {});
    expect(design.id).toMatch(/^design-/);
    expect(design).toMatchObject({ name: 'Mine', base: 1, panels: { front: { backgroundColor: '#123456' } }, spine: { color: '#ffee00' }, diff: { patch: { 'front.image': { opacity: 0.5 } } } });
    expect(assets).toEqual({});
  });

  it('refuses what is not a design', () => {
    expect(() => parseDesignFile(null, {})).toThrow(/isn't a CoverForge design/);
    expect(() => parseDesignFile({ app: 'coverforge' }, {}, 'x.json')).toThrow(/x\.json/);
  });

  it('checks the layers like a saved session does', () => {
    const { design } = parseDesignFile(file({ diff: { patch: { 'front.fill': { fill: 5, evil: 1 } }, added: [{ layer: { id: '../x', type: 'shape', target: 'front' } }] } }), {});
    expect(design.diff).toBeUndefined();
  });

  it('names an unnamed design, and trims a long name', () => {
    expect(parseDesignFile(file({ name: '   ' }), {}).design.name).toBe('Imported design');
    expect(parseDesignFile(file({ name: 'x'.repeat(200) }), {}).design.name).toHaveLength(80);
  });

  it('brings in its assets, and gives one a new id when that id is already used here for something else', () => {
    const layer = newImage('i', 'back', { kind: 'asset', id: 'a1' });
    const f = file({ diff: { added: [{ layer }], patch: { 'front.image': { source: { kind: 'asset', id: 'a1' } } } }, assets: [url('a1', 'https://e/new.png'), url('a2', 'https://e/two.png')] });
    const out = parseDesignFile(f, { a1: url('a1', 'https://e/OTHER.png') });
    const ids = Object.keys(out.assets);
    expect(ids).toHaveLength(2);
    expect(ids).toContain('a2');
    const fresh = ids.find((i) => i !== 'a2')!;
    expect(fresh).not.toBe('a1');
    expect((out.design.diff!.added![0].layer as { source: { id: string } }).source.id).toBe(fresh);
    expect((out.design.diff!.patch!['front.image'].source as { id: string }).id).toBe(fresh);
  });

  it('keeps an asset that is already here as it is (the same file), without a duplicate', () => {
    const f = file({ diff: { added: [{ layer: newImage('i', 'back', { kind: 'asset', id: 'a1' }) }] }, assets: [url('a1', 'https://e/same.png')] });
    const out = parseDesignFile(f, { a1: url('a1', 'https://e/same.png') });
    expect(out.assets).toEqual({});
    expect((out.design.diff!.added![0].layer as { source: { id: string } }).source.id).toBe('a1');
  });

  it('records the defaults version it was made against', () => {
    expect(parseDesignFile(file({ base: 1 }), {}).design.base).toBe(1);
    expect(DEFAULTS_VERSION).toBe(1);
  });
});
