# CoverForge

Client-side cover art generator for physical media. v1 covers Blu-ray keepcase wraps for games (Steam), with a 2D canvas editor, 3D WebGL preview, and print-ready export. No server, accounts or API keys.

<img src="./screenshot.png" alt="CoverForge screenshot" />

## Develop

```sh
npm install
npm run dev          # local dev server
npm run type-check
npm run lint
npm test             # Vitest unit tests (imposition, UV mapping, Steam URLs, reducer)
npm run build
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` type-checks, lints, tests and builds on every push to `main`, then publishes `dist/` to GitHub Pages. One-time setup:

1. **Settings → Pages → Source: GitHub Actions.**
2. *(Optional)* **Settings → Secrets and variables → Actions → Variables:** set `VITE_STEAM_PROXY_URL` to override the search relay. It defaults to the public `https://corx.venipa.workers.dev`, a third-party Cloudflare Worker that works today but comes with no guarantees and sees your users' search terms. For anything you depend on, deploy `worker/steam-proxy.js` to your own Cloudflare account and point the variable at it. A URL ending in `/` is used as a cors-anywhere-style prefix instead (`<prefix><target-url>`).

The build uses relative asset paths (`base: './'`), so it works under `https://<user>.github.io/<repo>/`.

## How it works

- **Search:** Steam Store has no CORS headers. Dev uses a Vite proxy (works out of the box); production needs the Cloudflare Worker in `worker/steam-proxy.js` — deploy it and build with `VITE_STEAM_PROXY_URL=https://<worker>.workers.dev`. Artwork loads straight from Steam's CDN with `crossOrigin="anonymous"`, so canvases stay exportable.
- **Editor:** `src/engine/CanvasRenderer.ts` exposes a pure `renderCover()` used by the editor, the 3D texture and export. Drag an image to pan, scroll to zoom.
- **3D:** `src/three/` maps the flat wrap onto a box sized from the template (trim area only, bleed excluded).
- **Export:** 300 DPI PNG/JPEG sheets, PDF at exact mm with vector cut/fold guides, and a ZIP with raw assets, flat renders and sheets.

## Brand logos

Each of Front, Spine and Back can carry a store or console logo (Steam, Epic, GOG, PlayStation, …) drawn above the image and text, with colour, size, position, rotation and opacity, shared across items or overridden per item. The marks come from [Simple Icons](https://simpleicons.org) (CC0 artwork; the brands remain trademarks of their owners) and are baked into `src/brands/brands.generated.ts` by `npm run gen:brands`. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Xbox and Nintendo marks aren't available from that source and aren't included.

## Scope (v1)

Blu-ray only (US 11 / 12.5 mm, EU 14 mm spine), Clean style, Steam games. Digital/Retro styles, QR/barcodes, other templates, movies/music search and SVG export are later milestones.
