import { describe, expect, it } from 'vitest';
import { initialState, reducer } from './AppContext';
import { restoreSession, serializeSession } from './session';
import { applyParams, buildShareLink, decodeConfig, encodeConfig, parseParams, readStartup } from './share';
import type { MediaItem } from '../types/media';

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: 'steam-1091500',
  type: 'game',
  title: 'Cyberpunk 2077',
  sourceId: '1091500',
  assets: { cover: 'https://cdn.example/c.jpg', hero: null, logo: null, screenshots: ['https://cdn.example/s1.jpg'] },
  ...over,
});

describe('encodeConfig / decodeConfig', () => {
  it('round-trips JSON through a URL-safe string', async () => {
    const value = { a: 1, text: 'héllo ✓', nested: [1, 2, { b: null }] };
    const text = await encodeConfig(value);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeConfig(text)).toEqual(value);
  });
  it('returns null for garbage', async () => {
    expect(await decodeConfig('not!!valid')).toBeNull();
    expect(await decodeConfig('AAAA')).toBeNull();
  });
});

describe('share link', () => {
  const state = reducer(reducer(initialState, { type: 'addItem', item: item() }), { type: 'setTemplate', kind: 'cd' });

  it('reopens the same configuration', async () => {
    const link = await buildShareLink(state, 'https://x.dev/cover-forge/?old=1#h');
    expect(link.url.startsWith('https://x.dev/cover-forge/?c=')).toBe(true);
    const startup = await readStartup(new URL(link.url).search);
    const restored = restoreSession(startup.session, initialState);
    expect(restored.templateKind).toBe('cd');
    expect(restored.items.map((i) => i.title)).toEqual(['Cyberpunk 2077']);
    expect(restored.selectedItemId).toBe('steam-1091500');
  });

  it('leaves out uploaded images that only exist in this browser, and says so', async () => {
    const withUpload = reducer(state, { type: 'addItem', item: item({ id: 'c1', title: 'Mine', assets: { cover: 'local:abc', hero: null, logo: null, screenshots: ['local:def', 'https://cdn.example/s.jpg'] } }) });
    const link = await buildShareLink(withUpload, 'https://x.dev/');
    expect(link.droppedImages).toBe(2);
    const restored = restoreSession((await readStartup(new URL(link.url).search)).session, initialState);
    const mine = restored.items.find((i) => i.id === 'c1')!;
    expect(mine.assets.cover).toBeNull();
    expect(mine.assets.screenshots).toEqual(['https://cdn.example/s.jpg']);
  });

  it('flags links that are too long to share', async () => {
    let x = 12345; // a deterministic pseudo-random string that deflate can't shrink
    const noise = Array.from({ length: 12000 }, () => String.fromCharCode(33 + ((x = (x * 1103515245 + 12345) % 2147483648) >> 8) % 90)).join('');
    const big = reducer(state, { type: 'addItem', item: item({ id: 'x', title: noise }) });
    expect((await buildShareLink(big, 'https://x.dev/')).tooLong).toBe(true);
  });
});

describe('plain link parameters', () => {
  it('parses known values and ignores bad ones', () => {
    expect(parseParams('?template=dvd&variant=slim-9&style=retro&view=3d&app=1091500,abc,570,1091500')).toEqual({
      template: 'dvd',
      variant: 'slim-9',
      region: undefined,
      style: 'retro',
      view: '3d',
      apps: [1091500, 570],
    });
    expect(parseParams('?template=nope&view=4d&region=XX')).toMatchObject({ template: undefined, view: undefined, region: undefined, apps: [] });
  });

  it('applies template, size, style and view', () => {
    const s = applyParams(initialState, parseParams('?template=dvd&variant=slim-9&style=digital&view=3d'));
    expect([s.templateKind, s.variantId, s.styleOverlay, s.view]).toEqual(['dvd', 'slim-9', 'digital', '3d']);
    expect(s.template.kind).toBe('dvd');
  });

  it('falls back to the template default when the size is not valid for it', () => {
    const s = applyParams(initialState, parseParams('?template=cd&variant=slim-9'));
    expect([s.templateKind, s.variantId]).toEqual(['cd', 'jewel']);
  });

  it('changes nothing when there are no parameters', () => {
    expect(applyParams(initialState, parseParams(''))).toEqual(initialState);
  });
});

describe('loadState', () => {
  it('replaces the whole session', () => {
    const other = restoreSession(serializeSession(reducer(initialState, { type: 'setTemplate', kind: 'cassette' })), initialState);
    expect(reducer(initialState, { type: 'loadState', state: other }).templateKind).toBe('cassette');
  });
});
