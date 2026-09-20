import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../types/media';
import type { SharedSettings } from '../types/editor';
import { resolvePanel } from './resolve';

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: 'a',
  type: 'game',
  title: 'A',
  assets: { cover: 'cover.jpg', hero: 'hero.jpg', logo: null, screenshots: ['s0.jpg', 's1.jpg'] },
  ...over,
});
const shared = (panels: SharedSettings['panels'] = {}): SharedSettings => ({
  panels,
  spine: { fontFamily: 'x', textHeightMm: 4, color: '#fff' },
});

describe('resolvePanel', () => {
  it('uses built-in defaults when nothing is set', () => {
    expect(resolvePanel(shared(), item(), 'front')).toMatchObject({ imageRef: 'cover', imageUrl: 'cover.jpg', backgroundColor: null });
    expect(resolvePanel(shared(), item(), 'back').imageRef).toBe('hero');
    expect(resolvePanel(shared(), item(), 'spine').imageRef).toBeNull();
  });

  it('shared beats default; item override beats shared; None is respected', () => {
    const s = shared({ back: { image: 'screenshot:1' }, front: { image: null } });
    expect(resolvePanel(s, item(), 'back').imageUrl).toBe('s1.jpg');
    expect(resolvePanel(s, item(), 'front').imageUrl).toBeNull();
    const o = item({ panels: { back: { image: 'cover' } } });
    expect(resolvePanel(s, o, 'back').imageUrl).toBe('cover.jpg');
  });

  it('falls back to the panel default when a shared image is missing on this item', () => {
    const s = shared({ back: { image: 'screenshot:5' }, spine: { image: 'logo' } });
    const r = resolvePanel(s, item(), 'back');
    expect(r.imageRef).toBe('hero');
    expect(r.imageUrl).toBe('hero.jpg');
    expect(resolvePanel(s, item(), 'spine').imageUrl).toBeNull(); // spine default is no image
  });
});

describe('resolvePanel logo layering', () => {
  it('has no logo by default and inherits the shared brand field by field', () => {
    expect(resolvePanel(shared(), item(), 'front').logo.brand).toBeNull();
    const s = shared({ front: { logo: { brand: 'steam', color: '#ff0000' } } });
    const o = item({ panels: { front: { logo: { color: '#00ff00', opacity: 0.5 } } } });
    expect(resolvePanel(s, item(), 'front').logo).toMatchObject({ brand: 'steam', color: '#ff0000', opacity: 1 });
    expect(resolvePanel(s, o, 'front').logo).toMatchObject({ brand: 'steam', color: '#00ff00', opacity: 0.5 });
  });

  it('lets an item hide a shared logo with brand: null, and other panels are unaffected', () => {
    const s = shared({ front: { logo: { brand: 'steam' } }, back: { logo: { brand: 'steam' } } });
    const o = item({ panels: { front: { logo: { brand: null } } } });
    expect(resolvePanel(s, o, 'front').logo.brand).toBeNull();
    expect(resolvePanel(s, o, 'back').logo.brand).toBe('steam');
  });
});
