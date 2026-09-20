import { createGameItem, searchGames } from '../steam';
import type { Provider } from './types';

export const steamProvider: Provider = {
  id: 'steam',
  label: 'Games',
  placeholder: 'Search Steam…',
  mediaType: 'game',
  available: true,
  async search(query, signal) {
    const results = await searchGames(query, signal);
    return results.map((r) => ({ id: String(r.appId), title: r.name, thumbnail: r.thumbnail, payload: { appId: String(r.appId) } }));
  },
  createItem: (r) => createGameItem({ appId: Number(r.payload?.appId ?? r.id), name: r.title, thumbnail: r.thumbnail ?? '' }),
};
