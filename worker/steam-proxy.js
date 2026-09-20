// Cloudflare Worker: a small CORS relay for the APIs CoverForge can't call directly from a browser.
//   - Steam Store API  (no key needed)
//   - TMDB             (needs your token; it stays in this Worker as a secret, so visitors never see or need a key)
//
// Deploy:   npx wrangler deploy worker/steam-proxy.js --name coverforge-relay --compatibility-date 2025-01-01
// TMDB:     npx wrangler secret put TMDB_TOKEN --name coverforge-relay      (your "API Read Access Token" from themoviedb.org)
// Then build the app with:
//   VITE_STEAM_PROXY_URL=https://coverforge-relay.<you>.workers.dev
//   VITE_TMDB_PROXY_URL=https://coverforge-relay.<you>.workers.dev      (omit to leave the Movies tab off)
const RULES = [
  { host: 'store.steampowered.com', prefix: '/api/' },
  { host: 'api.themoviedb.org', prefix: '/3/', secret: 'TMDB_TOKEN' },
];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const target = new URL(request.url).searchParams.get('url');
    let url;
    try {
      url = new URL(target);
    } catch {
      return new Response('Missing or invalid ?url=', { status: 400, headers: CORS });
    }
    const rule = RULES.find((r) => url.protocol === 'https:' && url.hostname === r.host && url.pathname.startsWith(r.prefix));
    if (!rule) return new Response('Forbidden', { status: 403, headers: CORS });

    const headers = {};
    if (rule.secret) {
      const token = env?.[rule.secret];
      if (!token) return new Response(`${rule.secret} is not configured on this Worker`, { status: 501, headers: CORS });
      headers.Authorization = `Bearer ${token}`;
    }
    const upstream = await fetch(url.toString(), { headers, cf: { cacheTtl: 3600, cacheEverything: true } });
    const res = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  },
};
