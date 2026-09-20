import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../types/media';
import { migrateItem, sortItems } from './items';

const item = (id: string, title: string, type: MediaItem['type'] = 'game'): MediaItem => ({ id, type, title, assets: { cover: null, hero: null, logo: null, screenshots: [] } });

describe('queue order', () => {
  it('sorts by title, ignoring case and reading numbers as numbers', () => {
    const sorted = sortItems([item('a', 'zelda'), item('b', 'Portal 10'), item('c', 'Alpha'), item('d', 'portal 2')]);
    expect(sorted.map((i) => i.title)).toEqual(['Alpha', 'portal 2', 'Portal 10', 'zelda']);
  });

  it('turns TV shows saved as movies into tv, and leaves real movies alone', () => {
    expect(migrateItem(item('tv-1', 'Show', 'movie')).type).toBe('tv');
    expect(migrateItem(item('tmdb-1', 'Film', 'movie')).type).toBe('movie');
  });
});
