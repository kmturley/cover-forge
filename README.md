# CoverForge

Client-side cover art generator for physical media. v1 covers Blu-ray keepcase wraps for games (Steam), with a 2D canvas editor, 3D WebGL preview, and print-ready export. No server, accounts or API keys.

## Develop

```sh
npm install
npm run dev          # local dev server
npm run type-check
npm run lint
npm test             # Vitest unit tests (imposition, UV mapping, Steam URLs, reducer)
npm run build
npm run deploy       # publish dist/ to GitHub Pages via gh-pages
```

## How it works

- **Search:** Steam Store has no CORS headers. Dev uses a Vite proxy (works out of the box); production needs the Cloudflare Worker in `worker/steam-proxy.js` — deploy it and build with `VITE_STEAM_PROXY_URL=https://<worker>.workers.dev`. Artwork loads straight from Steam's CDN with `crossOrigin="anonymous"`, so canvases stay exportable.
- **Editor:** `src/engine/CanvasRenderer.ts` exposes a pure `renderCover()` used by the editor, the 3D texture and export. Drag an image to pan, scroll to zoom.
- **3D:** `src/three/` maps the flat wrap onto a box sized from the template (trim area only, bleed excluded).
- **Export:** 300 DPI PNG/JPEG sheets, PDF at exact mm with vector cut/fold guides, and a ZIP with raw assets, flat renders and sheets.

## Scope (v1)

Blu-ray only (US 11 / 12.5 mm, EU 14 mm spine), Clean style, Steam games. Digital/Retro styles, QR/barcodes, other templates, movies/music search and SVG export are later milestones.
