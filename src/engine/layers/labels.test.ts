import { describe, expect, it } from 'vitest';
import type { Asset } from '../../types/layers';
import type { MediaItem } from '../../types/media';
import { newCode, newImage, newShape, newText } from './factory';
import { defaultLayers } from './defaults';
import { buildTemplateById } from '../../templates';
import { DEFAULT_SPINE_COLOR, DEFAULT_SPINE_FONT } from './defaults';
import { isDefaultId, isEmptyLayer, layerDetail, layerName, slotName, touchedIds } from './labels';

const item: MediaItem = { id: 'i', type: 'game', title: 'T', assets: { cover: 'c', hero: 'h', logo: null, screenshots: ['s'] } };
const assets: Record<string, Asset> = { a: { id: 'a', name: 'esrb.png', source: { kind: 'url', url: 'https://e/esrb.png' } } };

describe('layer labels', () => {
  it('names default layers by slot and added ones by what they are', () => {
    const ls = defaultLayers(buildTemplateById('bluray-us-11'));
    const by = (id: string) => ls.find((l) => l.id === id)!;
    expect(layerName(by('front.fill'))).toBe('Panel colour');
    expect(layerName(by('spine.text'))).toBe('Spine text');
    expect(layerName(by('back.code'))).toBe('QR code & barcode');
    expect(layerName(newShape('s', 'front'))).toBe('Rectangle');
    expect(layerName(newShape('s', 'front', { shape: 'ellipse' }))).toBe('Ellipse');
    expect(layerName(newText('t', 'front'))).toBe('Text');
    expect(layerName(newImage('i', 'front', { kind: 'vector', id: 'steam' }))).toBe('Mark');
    expect(layerName(newShape('s', 'front', { name: 'Gold bar' }))).toBe('Gold bar');
    expect(slotName('front.logo')).toBe('Logo');
    expect(isDefaultId('front.image')).toBe(true);
    expect(isDefaultId('image-k3f9x2')).toBe(false);
  });

  it('describes what is in a layer', () => {
    expect(layerDetail(newShape('s', 'front', { fill: '#ff0000' }), item, assets)).toBe('#ff0000');
    expect(layerDetail(newImage('i', 'front', { kind: 'role', ref: 'cover' }), item, assets)).toBe('Cover');
    expect(layerDetail(newImage('i', 'front', { kind: 'role', ref: 'screenshot:0' }), item, assets)).toBe('Image 1');
    expect(layerDetail(newImage('i', 'front', { kind: 'role', ref: 'auto' }), item, assets)).toBe('Automatic');
    expect(layerDetail(newImage('i', 'front', { kind: 'asset', id: 'a' }), item, assets)).toBe('esrb.png');
    expect(layerDetail(newImage('i', 'front', { kind: 'asset', id: 'gone' }), item, assets)).toBe('Missing image');
    expect(layerDetail(newImage('i', 'front', { kind: 'vector', id: 'steam' }), item, assets)).toBe('Steam');
    expect(layerDetail(newImage('i', 'front', null), item, assets)).toBe('None');
    expect(layerDetail(newCode('c', 'back', { kind: 'upca' }), item, assets)).toBe('Barcode · UPC-A');
    expect(layerDetail(newText('t', 'front', { text: 'Hello {title}' }), item, assets)).toBe('Hello {title}');
  });

  it('knows which default slots are still empty', () => {
    const ls = defaultLayers(buildTemplateById('bluray-us-11'));
    const by = (id: string) => ls.find((l) => l.id === id)!;
    expect(isEmptyLayer(by('front.fill'))).toBe(true);
    expect(isEmptyLayer(by('front.border'))).toBe(true);
    expect(isEmptyLayer(by('front.logo'))).toBe(true);
    expect(isEmptyLayer(by('front.code'))).toBe(true);
    expect(isEmptyLayer(by('back.code'))).toBe(false);
    expect(isEmptyLayer(by('front.image'))).toBe(false);
    expect(isEmptyLayer(newShape('s', 'front'))).toBe(false);
  });
});

describe('touchedIds', () => {
  it('collects what a level changes from its slot settings and its diff', () => {
    const ids = touchedIds({
      panels: { front: { backgroundColor: '#111', logo: { brand: 'steam' } } },
      spine: { color: '#ff0' },
      diff: { patch: { 'back.image': { opacity: 0.5 } }, added: [{ layer: newShape('s1', 'back') }], hidden: ['front.border'] },
    });
    // Spine style settings apply to every spine text layer a case has, so they name each panel's `.text` id.
    for (const id of ['back.image', 'front.border', 'front.fill', 'front.logo', 's1', 'spine.text', 'spineRight.text']) expect(ids.has(id), id).toBe(true);
    expect(ids.has('front.image')).toBe(false);
  });
  it('is empty for a level that changes nothing', () => {
    expect(touchedIds({}).size).toBe(0);
  });
  it('does not count the spine font and colour the Default design always carries', () => {
    expect(touchedIds({ spine: { fontFamily: DEFAULT_SPINE_FONT, color: DEFAULT_SPINE_COLOR } }).size).toBe(0);
    expect(touchedIds({ spine: { fontFamily: DEFAULT_SPINE_FONT, color: '#ff0000' } }).has('spine.text')).toBe(true);
  });
});
