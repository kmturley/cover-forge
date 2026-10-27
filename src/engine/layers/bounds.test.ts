import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../types/media';
import { buildTemplateById } from '../../templates';
import { defaultLayers } from './defaults';
import { containsPoint, layerAt, layerBounds, type BoundsEnv } from './bounds';
import { newCode, newImage, newShape, newText } from './factory';
import { canvasPanel } from './draw';

const t = buildTemplateById('bluray-us-11');
const item: MediaItem = { id: 'i', type: 'game', title: 'T', assets: { cover: 'c', hero: 'h', logo: null, screenshots: [] } };
const picture = { naturalWidth: 600, naturalHeight: 900 } as HTMLImageElement;
const env: BoundsEnv = { template: t, item, assets: undefined, getImage: (u) => (u ? picture : null) };
const front = t.panels.find((p) => p.id === 'front')!;

describe('layerBounds', () => {
  it('is the box of a placed layer, in canvas mm', () => {
    const l = newShape('s', 'front', { placement: { x: { anchor: 'start', offset: 10, size: 50 }, y: { anchor: 'start', offset: 0, size: 10 } } });
    const b = layerBounds(l, env)!;
    expect(b.rect.xMm).toBeCloseTo(front.xMm + front.widthMm * 0.1);
    expect(b.rect.widthMm).toBeCloseTo(front.widthMm * 0.5);
    expect(b.auto).toBe(false);
    expect(b.whole).toBe(false);
  });

  it('is the whole panel, and not pickable by a click, for a layer with automatic placement', () => {
    const fill = layerBounds(defaultLayers(t).find((l) => l.id === 'front.fill')!, env)!;
    expect(fill.whole).toBe(true);
    expect(fill.auto).toBe(true);
    const image = layerBounds(defaultLayers(t).find((l) => l.id === 'front.image')!, env)!;
    expect(image.whole).toBe(true);
  });

  it('is where an automatic code sits, and can be picked', () => {
    const code = layerBounds(defaultLayers(t).find((l) => l.id === 'back.code')!, env)!;
    expect(code.auto).toBe(true);
    expect(code.whole).toBe(false);
    expect(code.aspect).toBeGreaterThan(1);
    expect(code.rect.widthMm).toBeGreaterThan(20);
  });

  it('has nothing for hidden layers, empty ones, flaps, or a layer whose picture has not loaded', () => {
    expect(layerBounds(newShape('s', 'front', { visible: false }), env)).toBeNull();
    expect(layerBounds(defaultLayers(t).find((l) => l.id === 'front.logo')!, env)).toBeNull();
    expect(layerBounds(newCode('c', 'back', { kind: 'none' }), env)).toBeNull();
    expect(layerBounds(newImage('i', 'front', { kind: 'role', ref: 'cover' }), { ...env, getImage: () => null })).toBeNull();
    const box = buildTemplateById('nfc-box-card');
    expect(layerBounds(newShape('s', 'glue'), { ...env, template: box })).toBeNull();
  });

  it('a spine title is there but cannot be dragged; text placed in a box can', () => {
    const title = layerBounds(defaultLayers(t).find((l) => l.id === 'spine.text')!, env)!;
    expect(title.movable).toBe(false);
    expect(layerBounds(newText('t', 'front'), env)!.movable).toBe(true);
  });

  it('measures a layer across the panels against the printed area', () => {
    const b = layerBounds(newShape('s', 'canvas', { placement: { x: { anchor: 'stretch', start: 0, end: 0 }, y: { anchor: 'stretch', start: 0, end: 0 } } }), env)!;
    const c = canvasPanel(t);
    expect([b.rect.xMm, b.rect.widthMm]).toEqual([c.xMm, c.widthMm]);
  });
});

describe('containsPoint', () => {
  const rect = { xMm: 10, yMm: 10, widthMm: 20, heightMm: 10 };
  it('tests an unrotated box', () => {
    expect(containsPoint({ rect, rotationDeg: 0 }, 11, 11)).toBe(true);
    expect(containsPoint({ rect, rotationDeg: 0 }, 31, 15)).toBe(false);
  });
  it('tests a rotated box in its own frame', () => {
    // Turned 90°, the 20×10 box about (20, 15) covers 15–25 across and 5–25 down.
    expect(containsPoint({ rect, rotationDeg: 90 }, 20, 6)).toBe(true);
    expect(containsPoint({ rect, rotationDeg: 90 }, 11, 15)).toBe(false);
  });
});

describe('layerAt', () => {
  const layers = [
    newShape('under', 'front', { placement: { x: { anchor: 'start', offset: 10, size: 50 }, y: { anchor: 'start', offset: 10, size: 50 } } }),
    newShape('over', 'front', { placement: { x: { anchor: 'start', offset: 30, size: 50 }, y: { anchor: 'start', offset: 30, size: 50 } } }),
  ];
  const at = (px: number, py: number) => layerAt(layers, env, front.xMm + front.widthMm * px, front.yMm + front.heightMm * py)?.layer.id;

  it('picks the topmost layer under the point', () => {
    expect(at(0.4, 0.4)).toBe('over');
    expect(at(0.15, 0.15)).toBe('under');
    expect(at(0.9, 0.9)).toBeUndefined();
  });

  it('leaves whole-panel layers to the panel', () => {
    // (low on the front, clear of the Branded header)
    expect(layerAt(defaultLayers(t), env, front.xMm + front.widthMm / 2, front.yMm + front.heightMm * 0.7)).toBeNull();
  });
});
