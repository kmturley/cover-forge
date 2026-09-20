/**
 * Routes requests to endpoints that don't send CORS headers (the Steam Store API).
 *  - `npm run dev`: same-origin `/steam-store/*`, proxied by the Vite dev server (see vite.config.ts).
 *  - production: the Cloudflare Worker in /worker, set via VITE_STEAM_PROXY_URL at build time.
 */
const STEAM_STORE = 'https://store.steampowered.com';
const WORKER_URL = import.meta.env.VITE_STEAM_PROXY_URL as string | undefined;

export function proxied(url: string): string {
  if (import.meta.env.DEV && url.startsWith(STEAM_STORE)) {
    return `/steam-store${url.slice(STEAM_STORE.length)}`;
  }
  if (!WORKER_URL) {
    throw new Error('Search proxy not configured: deploy /worker and set VITE_STEAM_PROXY_URL.');
  }
  return `${WORKER_URL}?url=${encodeURIComponent(url)}`;
}
