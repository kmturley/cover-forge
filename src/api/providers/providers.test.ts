import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, https } from '../http';
import { createMoviesProvider } from './movies';
import { musicProvider } from './music';
import { tvProvider } from './tv';

/** Routes fetch() to canned responses by substring match, recording every URL requested. */
function mockFetch(routes: [string, unknown | (() => Response)][]) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      calls.push(input);
      const hit = routes.find(([needle]) => input.includes(needle));
      if (!hit) return new Response('not found', { status: 404 });
      const [, body] = hit;
      return typeof body === 'function' ? (body as () => Response)() : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchJson', () => {
  it('retries a busy/rate-limited server, then succeeds', async () => {
    vi.useFakeTimers();
    let n = 0;
    mockFetch([['x', () => (++n < 3 ? new Response('busy', { status: 503 }) : new Response('{"ok":true}'))]]);
    const p = fetchJson<{ ok: boolean }>('https://x', { retries: 2, retryDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(3100); // 1000 ms then 2000 ms of back-off
    await expect(p).resolves.toEqual({ ok: true });
    expect(n).toBe(3);
  });

  it('gives up after the retries and reports the status; other errors are not retried', async () => {
    vi.useFakeTimers();
    mockFetch([['x', () => new Response('busy', { status: 503 })]]);
    const p = fetchJson('https://x', { retries: 1, retryDelayMs: 10 });
    const assertion = expect(p).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    await expect(p).rejects.toThrow(/busy/);
    const calls = mockFetch([['y', () => new Response('nope', { status: 404 })]]);
    await expect(fetchJson('https://y', { retries: 3 })).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(1);
  });

  it('upgrades http image links', () => {
    expect(https('http://coverartarchive.org/a.jpg')).toBe('https://coverartarchive.org/a.jpg');
    expect(https('https://x/a.jpg')).toBe('https://x/a.jpg');
  });
});

describe('music provider (MusicBrainz + Cover Art Archive)', () => {
  const mb = {
    'release-groups': [
      { id: 'rg1', title: 'The Dark Side of the Moon', 'primary-type': 'Album', 'first-release-date': '1973-03-24', 'artist-credit': [{ name: 'Pink Floyd' }] },
      { id: 'rg2', title: 'Untitled', 'artist-credit': [] },
    ],
  };
  const caa = {
    images: [
      { front: false, back: false, image: 'http://archive/booklet.jpg', thumbnails: { '1200': 'http://archive/booklet-1200.jpg' } },
      { front: true, back: false, image: 'http://archive/front.jpg', thumbnails: { '250': 'http://archive/front-250.jpg', '1200': 'http://archive/front-1200.jpg' } },
      { front: false, back: true, image: 'http://archive/back.jpg', thumbnails: { large: 'http://archive/back-large.jpg' } },
      { front: false, back: false, image: 'http://archive/disc.jpg', thumbnails: {} },
    ],
  };

  it('maps release groups to results and searches politely', async () => {
    const calls = mockFetch([['musicbrainz.org', mb]]);
    const results = await musicProvider.search('dark side');
    expect(calls[0]).toContain('release-group/?query=dark%20side&fmt=json');
    expect(results[0]).toMatchObject({ id: 'rg1', title: 'The Dark Side of the Moon', subtitle: 'Pink Floyd · Album', year: '1973' });
    expect(results[0].thumbnail).toBe('https://coverartarchive.org/release-group/rg1/front-250');
    expect(results[1].subtitle).toBe('');
    expect(await musicProvider.search('  ')).toEqual([]);
  });

  it('builds an item: front → cover, back → hero (Back panel default), the rest → library; http upgraded', async () => {
    mockFetch([['coverartarchive.org/release-group/rg1', caa]]);
    const item = await musicProvider.createItem({ id: 'rg1', title: 'The Dark Side of the Moon', year: '1973', payload: { artist: 'Pink Floyd' } });
    expect(item).toMatchObject({ id: 'mb-rg1', type: 'music', title: 'The Dark Side of the Moon', subtitle: 'Pink Floyd', year: '1973', sourceId: 'rg1' });
    expect(item.assets.cover).toBe('https://archive/front-1200.jpg');
    expect(item.assets.hero).toBe('https://archive/back-large.jpg');
    expect(item.assets.logo).toBeNull();
    expect(item.assets.screenshots).toEqual(['https://archive/booklet-1200.jpg', 'https://archive/disc.jpg']);
  });

  it('uses the first image when nothing is tagged as the front, and has no hero without a back cover', async () => {
    mockFetch([['release-group/rg3', { images: [{ front: false, back: false, image: 'https://a/1.jpg', thumbnails: {} }] }]]);
    const item = await musicProvider.createItem({ id: 'rg3', title: 'X' });
    expect(item.assets).toMatchObject({ cover: 'https://a/1.jpg', hero: null, screenshots: [] });
  });

  it('explains when an album has no artwork', async () => {
    mockFetch([['release-group/none', () => new Response('nope', { status: 404 })]]);
    await expect(musicProvider.createItem({ id: 'none', title: 'X' })).rejects.toThrow(/No cover art/);
  });
});

describe('TV provider (TVMaze)', () => {
  const search = [
    { show: { id: 169, name: 'Breaking Bad', premiered: '2008-01-20', network: { name: 'AMC' }, genres: ['Drama', 'Crime', 'Thriller'], image: { medium: 'http://s/m.jpg', original: 'http://s/o.jpg' } } },
    { show: { id: 7, name: 'No Art', premiered: null, webChannel: { name: 'Web' }, genres: [] } },
  ];
  const images = [
    { type: 'poster', main: false, resolutions: { original: { url: 'https://s/p1.jpg' } } },
    { type: 'poster', main: true, resolutions: { original: { url: 'https://s/p-main.jpg' } } },
    { type: 'poster', main: false, resolutions: { original: { url: 'https://s/p2.jpg' } } },
    { type: 'background', main: false, resolutions: { original: { url: 'https://s/bg.jpg' } } },
    { type: 'typography', main: false, resolutions: { original: { url: 'https://s/logo.png' } } },
  ];

  it('maps shows, joining network and genres', async () => {
    mockFetch([['search/shows', search]]);
    const r = await tvProvider.search('breaking bad');
    expect(r[0]).toMatchObject({ id: '169', title: 'Breaking Bad', subtitle: 'AMC · Drama/Crime', year: '2008', thumbnail: 'https://s/m.jpg' });
    expect(r[1]).toMatchObject({ subtitle: 'Web', year: undefined });
  });

  it('builds an item with poster, backdrop, title logo and alternate posters', async () => {
    mockFetch([['shows/169/images', images]]);
    const item = await tvProvider.createItem({ id: '169', title: 'Breaking Bad', subtitle: 'AMC', year: '2008', payload: { poster: 'https://s/o.jpg' } });
    expect(item).toMatchObject({ id: 'tv-169', type: 'movie', sourceId: '169' });
    expect(item.assets).toEqual({ cover: 'https://s/p-main.jpg', hero: 'https://s/bg.jpg', logo: 'https://s/logo.png', screenshots: ['https://s/p1.jpg', 'https://s/p2.jpg'] });
  });

  it('falls back to the search poster if the image list fails, and errors when there is no art at all', async () => {
    mockFetch([['shows/1/images', () => new Response('x', { status: 500 })]]);
    const item = await tvProvider.createItem({ id: '1', title: 'A', payload: { poster: 'https://s/o.jpg' } });
    expect(item.assets.cover).toBe('https://s/o.jpg');
    mockFetch([['shows/2/images', []]]);
    await expect(tvProvider.createItem({ id: '2', title: 'B', payload: { poster: '' } })).rejects.toThrow(/No artwork/);
  });
});

describe('movies provider (TMDB via a relay)', () => {
  it('is unavailable, and searches nothing, without a relay', async () => {
    const p = createMoviesProvider(undefined);
    expect(p.available).toBe(false);
    expect(p.unavailableReason).toMatch(/VITE_TMDB_PROXY_URL/);
    expect(await p.search('inception')).toEqual([]);
  });

  it('routes through a ?url= relay and maps results', async () => {
    const calls = mockFetch([['search%2Fmovie', { results: [{ id: 27205, title: 'Inception', release_date: '2010-07-15', poster_path: '/p.jpg' }, { id: 2, title: 'La Vita', original_title: 'La vita', release_date: '' }] }]]);
    const p = createMoviesProvider('https://relay.example');
    const r = await p.search('inception');
    expect(calls[0]).toBe(`https://relay.example?url=${encodeURIComponent('https://api.themoviedb.org/3/search/movie?query=inception&include_adult=false')}`);
    expect(r[0]).toMatchObject({ id: '27205', title: 'Inception', year: '2010', thumbnail: 'https://image.tmdb.org/t/p/w92/p.jpg' });
    expect(r[1].thumbnail).toBeUndefined();
  });

  it('supports a cors-anywhere-style prefix relay', async () => {
    const calls = mockFetch([['search/movie', { results: [] }]]);
    await createMoviesProvider('https://relay.example/').search('x');
    expect(calls[0]).toBe('https://relay.example/https://api.themoviedb.org/3/search/movie?query=x&include_adult=false');
  });

  it('builds an item preferring English/text-free, best-rated art', async () => {
    mockFetch([
      [
        'images',
        {
          posters: [
            { file_path: '/fr.jpg', iso_639_1: 'fr', vote_average: 9 },
            { file_path: '/en-low.jpg', iso_639_1: 'en', vote_average: 3 },
            { file_path: '/en-high.jpg', iso_639_1: 'en', vote_average: 7 },
          ],
          backdrops: [{ file_path: '/bd1.jpg', iso_639_1: null, vote_average: 5 }, { file_path: '/bd2.jpg', iso_639_1: null, vote_average: 4 }],
          logos: [{ file_path: '/logo.png', iso_639_1: 'en', vote_average: 1 }],
        },
      ],
    ]);
    const item = await createMoviesProvider('https://relay.example').createItem({ id: '27205', title: 'Inception', year: '2010' });
    expect(item).toMatchObject({ id: 'tmdb-27205', type: 'movie', sourceId: '27205' });
    expect(item.assets.cover).toBe('https://image.tmdb.org/t/p/original/en-high.jpg');
    expect(item.assets.hero).toBe('https://image.tmdb.org/t/p/original/bd1.jpg');
    expect(item.assets.logo).toBe('https://image.tmdb.org/t/p/original/logo.png');
    expect(item.assets.screenshots[0]).toBe('https://image.tmdb.org/t/p/original/en-low.jpg'); // alternate posters first
  });

  it('errors clearly when there is no poster at all', async () => {
    mockFetch([['images', { posters: [], backdrops: [], logos: [] }]]);
    await expect(createMoviesProvider('https://r').createItem({ id: '1', title: 'X' })).rejects.toThrow(/No poster/);
  });
});
