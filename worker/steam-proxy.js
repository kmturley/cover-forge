// Cloudflare Worker: CORS relay restricted to the Steam Store API.
// Deploy: `npx wrangler deploy worker/steam-proxy.js --name coverforge-steam --compatibility-date 2025-01-01`
// Then build the app with VITE_STEAM_PROXY_URL=https://coverforge-steam.<you>.workers.dev
const ALLOWED_HOST = 'store.steampowered.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const target = new URL(request.url).searchParams.get('url');
    let url;
    try {
      url = new URL(target);
    } catch {
      return new Response('Missing or invalid ?url=', { status: 400, headers: CORS });
    }
    if (url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST || !url.pathname.startsWith('/api/')) {
      return new Response('Forbidden', { status: 403, headers: CORS });
    }
    const upstream = await fetch(url.toString(), { cf: { cacheTtl: 3600, cacheEverything: true } });
    const res = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  },
};
