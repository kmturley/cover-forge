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
