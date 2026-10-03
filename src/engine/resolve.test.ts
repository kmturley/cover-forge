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

describe('resolvePanel code layering', () => {
  it('has no code by default, inherits shared fields, and lets an item override individual ones', () => {
    expect(resolvePanel(shared(), item(), 'back').code.kind).toBe('none');
    const s = shared({ back: { code: { kind: 'qr', pattern: 'https://x/{appId}', color: '#112233' } } });
    const o = item({ panels: { back: { code: { pattern: 'other' } } } });
    expect(resolvePanel(s, item(), 'back').code).toMatchObject({ kind: 'qr', pattern: 'https://x/{appId}', color: '#112233', background: '#ffffff' });
    expect(resolvePanel(s, o, 'back').code).toMatchObject({ kind: 'qr', pattern: 'other', color: '#112233' });
  });
});

describe('default back barcode', () => {
  const shared = { panels: {}, spine: {} } as never;
  it('puts an EAN-13 on the back of every case except tapes, floppies and NFC pieces', () => {
    for (const kind of ['bluray', 'dvd', 'vhs', 'cd', 'vinyl', 'game-case'] as const) expect(resolvePanel(shared, null, 'back', kind).code.kind, kind).toBe('ean13');
    for (const kind of ['cassette', 'floppy', 'nfc-card', 'nfc-sticker', 'nfc-box'] as const) expect(resolvePanel(shared, null, 'back', kind).code.kind, kind).toBe('none');
  });
  it('only the back gets it, and an explicit choice (even none) wins', () => {
    expect(resolvePanel(shared, null, 'front', 'dvd').code.kind).toBe('none');
    expect(resolvePanel({ panels: { back: { code: { kind: 'none' } } }, spine: {} } as never, null, 'back', 'dvd').code.kind).toBe('none');
    expect(resolvePanel({ panels: { back: { code: { kind: 'qr' } } }, spine: {} } as never, null, 'back', 'dvd').code.kind).toBe('qr');
  });
});
