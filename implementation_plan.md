# CoverForge — Implementation Plan

A client-side web platform for creating physical media cover art. This plan covers the **v1 MVP**: a full end-to-end flow for one template (Blu-ray keepcase) with game search via Steam, a 2D canvas editor, 3D WebGL preview, and print-ready export.

---

## User Review Required

> [!IMPORTANT]
> **Steam CDN vs SteamGridDB:** Research revealed that Steam's CDN provides **zero-auth, high-res artwork** at deterministic URLs (e.g. `library_600x900_2x.jpg` at 1200×1800px — perfect for 300 DPI print). SteamGridDB requires an API key and a CORS proxy. **Recommendation:** Use Steam CDN as the primary v1 provider (zero API keys, zero proxy needed for images). SteamGridDB can be added later as an optional alternate-art source.

> [!IMPORTANT]
> **CORS Proxy for Steam Search:** The Steam Store search endpoint (`store.steampowered.com/api/storesearch`) does not send CORS headers. We need a lightweight proxy. Options:
> 1. Use a free public CORS relay (e.g. `corsproxy.io`) — simple but fragile
> 2. Deploy a tiny Cloudflare Worker (free tier, ~20 lines of code) — reliable and free
> 3. Bundle a curated JSON index of popular games and skip live search for v1
>
> **Recommendation:** Option 1 for dev, with option 2 for production. This keeps the app "no server required" from the user's perspective while still being robust.

> [!WARNING]
> **Canvas Tainting:** Even with Steam CDN images loading fine in `<img>` tags, drawing cross-origin images onto `<canvas>` taints it, blocking `toDataURL()` / `toBlob()` export. We must set `crossOrigin = "anonymous"` on all `<img>` elements, and the CDN must respond with `Access-Control-Allow-Origin: *`. Steam's Cloudflare CDN (`shared.cloudflare.steamstatic.com`) **does** send this header, so this should work. If any edge case fails, the CORS proxy fallback handles it.

## Resolved Decisions

1. **Blu-ray spine width:** ✅ User selects region first (US / EU), which filters the template list to show region-appropriate spine widths. US defaults to 11 mm, EU defaults to 14 mm.
2. **Style overlays for v1:** ✅ Clean only. Digital and Retro Wear deferred to a later milestone.
3. **QR/Barcode generation:** ✅ Deferred to a later milestone.
4. **State management:** ✅ Use built-in React Context + `useReducer` instead of Zustand. No additional state management dependencies.

---

## Proposed Changes

### Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript | User preference |
| Bundler | Vite 6 | User preference, fast HMR |
| State Management | React Context + `useReducer` | Built-in React, no extra dependencies |
| 2D Editor | Raw HTML5 Canvas API | 0 KB overhead, pixel-perfect 300 DPI, zero-copy WebGL texture sharing |
| 3D Preview | `@react-three/fiber` + `@react-three/drei` | Declarative Three.js with built-in Environment, OrbitControls, ContactShadows |
| PDF Export | jsPDF + svg2pdf.js | User preference |
| QR Codes | `qrcode` (if included in v1) | Lightweight, canvas-native |
| ZIP Export | JSZip + FileSaver.js | Client-side ZIP creation |
| Deployment | GitHub Pages (via `gh-pages`) | User preference, static hosting |

---

### Project Structure

```
cover-forge/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                          # Entry point
│   ├── App.tsx                           # Root layout + routing between states
│   ├── vite-env.d.ts
│   │
│   ├── stores/                           # Zustand state management
│   │   ├── queueStore.ts                 # Media queue (items, ordering)
│   │   ├── templateStore.ts              # Active template + style config
│   │   └── editorStore.ts                # Per-item panel transforms, overrides
│   │
│   ├── types/                            # Shared TypeScript interfaces
│   │   ├── media.ts                      # MediaItem, MediaType, AssetSlots
│   │   ├── template.ts                   # TemplateConfig, PanelRect, DieLine
│   │   └── editor.ts                     # PanelTransform, StyleOverlay
│   │
│   ├── api/                              # Data fetching layer
│   │   ├── steam.ts                      # Steam Store search + CDN URL builder
│   │   └── corsProxy.ts                  # CORS proxy URL wrapper
│   │
│   ├── templates/                        # Dieline geometry definitions
│   │   ├── index.ts                      # Template registry
│   │   └── bluray.ts                     # Blu-ray keepcase dimensions
│   │
│   ├── engine/                           # Imperative canvas rendering engine
│   │   ├── CanvasRenderer.ts             # Core render loop (panels, images, text, guides)
│   │   ├── InteractionController.ts      # Pointer capture, pan/zoom/drag
│   │   ├── SpineTypography.ts            # Rotated spine text rendering
│   │   └── GuideOverlays.ts             # Cut/fold/bleed guide lines
│   │
│   ├── components/                       # React UI components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx              # Top-level layout (sidebar + main)
│   │   │   ├── Toolbar.tsx               # Template/style selector toolbar
│   │   │   └── StatusBar.tsx             # Queue count, export status
│   │   │
│   │   ├── search/
│   │   │   ├── SearchBar.tsx             # Unified search input
│   │   │   ├── SearchResults.tsx         # Search result cards
│   │   │   └── QueueList.tsx             # Active media queue sidebar
│   │   │
│   │   ├── editor/
│   │   │   ├── CanvasEditor.tsx          # 2D canvas wrapper (React ↔ engine bridge)
│   │   │   ├── PanelControls.tsx         # Per-panel adjustment controls
│   │   │   └── SpineEditor.tsx           # Spine text/font controls
│   │   │
│   │   ├── preview/
│   │   │   └── ThreeDPreview.tsx         # 3D WebGL viewport (R3F scene)
│   │   │
│   │   └── export/
│   │       ├── ExportModal.tsx           # Export settings dialog
│   │       └── PrintSheetPreview.tsx     # Multi-up imposition preview
│   │
│   ├── three/                            # Three.js geometry & materials
│   │   ├── CaseGeometry.ts              # UV remapping for box faces
│   │   ├── CaseMaterials.ts             # PBR sleeve + casing materials
│   │   └── BlurayScene.tsx              # R3F scene composition
│   │
│   ├── export/                           # Export pipeline
│   │   ├── rasterExport.ts              # 300 DPI PNG/JPEG via offscreen canvas
│   │   ├── pdfExport.ts                 # jsPDF + svg2pdf vector export
│   │   ├── imposition.ts                # Multi-up sheet layout calculator
│   │   └── zipExport.ts                 # JSZip bundler
│   │
│   └── styles/                           # CSS
│       ├── global.css                    # Reset, variables, dark theme
│       └── components/                   # Per-component CSS modules
```

---

### Component 1: Data Layer (Types + Stores + API)

#### [NEW] `src/types/media.ts`
Defines the core `MediaItem` interface used throughout the app:
```ts
type MediaType = 'game' | 'movie' | 'music' | 'custom';

interface AssetSlots {
  cover: string | null;      // Vertical 2:3 cover art URL
  hero: string | null;       // Wide backdrop/banner URL
  logo: string | null;       // Transparent logo/wordmark URL
  screenshots: string[];     // Back-cover screenshots
}

interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  subtitle?: string;         // Developer, director, artist
  year?: string;
  assets: AssetSlots;
  panelOverrides?: Record<string, PanelTransform>;
}
```

#### [NEW] `src/types/template.ts`
Defines dieline geometry with exact millimetre specs:
```ts
interface PanelRect {
  id: 'back' | 'spine' | 'front';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

interface TemplateConfig {
  id: string;
  name: string;
  totalWidthMm: number;
  totalHeightMm: number;
  bleedMm: number;
  panels: PanelRect[];
  dpiScale: number;        // 300 / 25.4 ≈ 11.811 px/mm
}
```

#### [NEW] `src/stores/queueStore.ts`
Zustand store managing the media queue:
- `items: MediaItem[]` — ordered list
- `addItem(item)`, `removeItem(id)`, `reorderItems(from, to)`
- `selectedItemId: string | null` — currently editing item

#### [NEW] `src/stores/templateStore.ts`
Zustand store for global template + style:
- `activeTemplate: TemplateConfig` — defaults to Blu-ray US Standard
- `styleOverlay: 'clean' | 'digital' | 'retro'`
- `showGuides: boolean`
- `spineFont`, `backgroundColor`, etc.

#### [NEW] `src/api/steam.ts`
Steam Store search + CDN URL builder:
- `searchGames(query: string): Promise<SteamSearchResult[]>` — calls `store.steampowered.com/api/storesearch` via CORS proxy
- `buildAssetUrls(appId: number): AssetSlots` — constructs deterministic Steam CDN URLs:
  - Cover: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appId}/library_600x900_2x.jpg`
  - Hero: `.../library_hero_2x.jpg`
  - Logo: `.../logo.png`
  - Screenshots: `.../ss_{hash}.jpg` (from appdetails response)

---

### Component 2: Blu-ray Template Definition

#### [NEW] `src/templates/bluray.ts`

Based on research, the **US Standard (Viva Elite, 11 mm spine)** as the default:

| Property | Value |
|---|---|
| Back panel | 129 mm × 149 mm |
| Spine | 11 mm × 149 mm |
| Front panel | 129 mm × 149 mm |
| Total trim | 269 mm × 149 mm |
| Bleed | 3 mm all sides |
| Total with bleed | 275 mm × 155 mm |
| 300 DPI canvas | 3248 px × 1831 px |

Spine width will be configurable (11 / 12.5 / 14 mm) to cover US, US Elite, and EU cases.

---

### Component 3: 2D Canvas Rendering Engine

#### [NEW] `src/engine/CanvasRenderer.ts`
The core imperative rendering engine, completely decoupled from React:
- Operates on a `<canvas>` element via refs
- Maintains an internal render state (panel transforms stored in mutable refs, not React state)
- Uses `requestAnimationFrame` with a dirty flag — only repaints when something changes
- Coordinate system: works in mm internally, converts to pixels via `dpiScale` (11.811 px/mm)
- Render pipeline per frame:
  1. Clear canvas
  2. Fill background color
  3. For each panel: clip to panel rect → draw image with cover-fit + user pan/zoom/scale → restore
  4. Draw spine text (rotated 90° CW, auto-scaled to fit)
  5. Conditionally draw guide overlays (bleed, trim, fold, safety)

#### [NEW] `src/engine/InteractionController.ts`
Handles all pointer interaction imperatively:
- `pointerdown`: Hit-test against panel rects, begin drag with `setPointerCapture`
- `pointermove`: Update mutable pan offset, trigger RAF repaint
- `pointerup`: Commit final transform to Zustand store (for undo/redo)
- `wheel`: Zoom within panel bounds (clamped 0.2×–5.0×)

#### [NEW] `src/components/editor/CanvasEditor.tsx`
React wrapper that bridges the imperative engine to React:
- Creates and sizes the `<canvas>` element
- Instantiates `CanvasRenderer` + `InteractionController` on mount
- Subscribes to Zustand store changes (template, images, spine text) and calls engine re-render
- Exposes the raw canvas element ref for Three.js `CanvasTexture` consumption

---

### Component 4: 3D WebGL Preview

#### [NEW] `src/three/CaseGeometry.ts`
Procedural UV remapping for `BoxGeometry`:
- Creates geometry matching physical dimensions (1.35 × 1.715 × 0.125 Three.js units)
- Remaps UV coordinates so Back maps to $[0, u_1]$, Spine to $[u_1, u_2]$, Front to $[u_2, 1]$
- Where $u_1 = 129/269 ≈ 0.4796$, $u_2 = 140/269 ≈ 0.5204$
- Non-artwork faces (top, bottom, opening edge) get zero-area UVs (show casing material only)

#### [NEW] `src/three/CaseMaterials.ts`
Two PBR materials:
1. **Sleeve material** (`MeshPhysicalMaterial`): `map: canvasTexture`, `clearcoat: 1.0`, `clearcoatRoughness: 0.04`, `roughness: 0.22` — simulates paper under plastic film
2. **Casing material** (`MeshPhysicalMaterial`): `color: #0a4da2`, `transmission: 0.8`, `thickness: 1.2`, `ior: 1.5` — translucent blue polypropylene

Material assignment by face index: `[casing, sleeve, casing, casing, sleeve, sleeve]` → `[+X open, -X spine, +Y top, -Y bottom, +Z front, -Z back]`

#### [NEW] `src/three/BlurayScene.tsx`
R3F scene composition:
- `<Canvas>` with PerspectiveCamera (fov 40, position [0, 0.2, 3.2])
- `<Environment preset="city" />` for realistic reflections
- `<ContactShadows />` for grounding
- `<OrbitControls />` with damping for 360° rotation
- `<mesh>` with remapped geometry + multi-material array
- `CanvasTexture` created from the 2D editor's canvas element, with `generateMipmaps: false` and `LinearFilter` for performance

#### [NEW] `src/components/preview/ThreeDPreview.tsx`
React component wrapping the R3F scene:
- Receives canvas ref from `CanvasEditor`
- Listens for an `updateKey` counter (incremented on each 2D repaint) to trigger `texture.needsUpdate = true`
- Throttles texture uploads to 30fps during active drag, full sync on pointer release

---

### Component 5: Search & Queue UI

#### [NEW] `src/components/search/SearchBar.tsx`
- Debounced text input (300ms)
- Calls `steam.searchGames(query)` on input
- Shows loading spinner during fetch

#### [NEW] `src/components/search/SearchResults.tsx`
- Grid of result cards showing game thumbnail + title
- Click adds item to queue via `queueStore.addItem()`
- Auto-populates `AssetSlots` from Steam CDN URLs

#### [NEW] `src/components/search/QueueList.tsx`
- Vertical list of queued items in sidebar
- Click selects item for editing
- Drag-to-reorder (optional v1 stretch)
- Delete button per item

---

### Component 6: Export Pipeline

#### [NEW] `src/export/rasterExport.ts`
High-DPI raster export:
- Creates an offscreen canvas at 300 DPI dimensions (3248 × 1831 px for Blu-ray with bleed)
- Re-renders the full template at print resolution (not screen resolution)
- Exports as PNG blob via `canvas.toBlob('image/png')`
- JPEG option with quality parameter

#### [NEW] `src/export/pdfExport.ts`
Vector PDF export:
- Creates a jsPDF document at exact physical dimensions (275 mm × 155 mm)
- Embeds raster artwork panels
- Draws vector cut/fold guides as PDF paths (infinitely scalable)
- Outputs PDF/X-compatible file

#### [NEW] `src/export/imposition.ts`
Multi-up sheet layout calculator:
- Input: template dimensions + target sheet size (A4: 210×297 mm, US Letter: 215.9×279.4 mm)
- Calculates how many covers fit per sheet with gutters
- For Blu-ray: 1 cover per sheet (275 mm > 210 mm width) — will tile on larger format or rotate
- Returns array of `{ x, y, rotation }` positions

#### [NEW] `src/export/zipExport.ts`
Batch download:
- Iterates all queue items
- Renders each at 300 DPI
- Bundles into a ZIP: `/{title}/cover_flat.png`, `/{title}/cover_print.pdf`, `/print_sheets/sheet_1.png`
- Triggers browser download via FileSaver.js

#### [NEW] `src/components/export/ExportModal.tsx`
Export settings dialog:
- Paper size toggle (A4 / US Letter)
- Format selection (PNG / JPEG / PDF)
- Cut/fold guides toggle
- "Download All (ZIP)" button
- Progress indicator for batch export

---

### Component 7: App Shell & Layout

#### [NEW] `src/App.tsx`
Root layout with a responsive 3-column design:
- **Left sidebar** (280px): Search + Queue List
- **Center main** (flex): 2D Canvas Editor (default) or 3D Preview (toggle)
- **Right sidebar** (240px): Panel controls, spine editor, template/style selectors

#### [NEW] `src/components/layout/Toolbar.tsx`
Global controls bar above the canvas:
- Template dropdown (Blu-ray only for v1, expandable)
- Spine width selector (11 / 12.5 / 14 mm)
- Style overlay selector (Clean for v1)
- 2D/3D view toggle
- Show/hide guides toggle

---

## Build Order (Phased Implementation)

### Phase 1: Project Scaffolding & Core Types
1. Initialize Vite + React + TypeScript project
2. Install dependencies (`zustand`, `three`, `@react-three/fiber`, `@react-three/drei`, `jspdf`, `jszip`, `file-saver`)
3. Create type definitions (`media.ts`, `template.ts`, `editor.ts`)
4. Create Zustand stores (queue, template, editor)
5. Create Blu-ray template definition

### Phase 2: Search & Queue
6. Implement Steam API client + CORS proxy wrapper
7. Build SearchBar, SearchResults, QueueList components
8. Wire search → queue flow

### Phase 3: 2D Canvas Editor
9. Build `CanvasRenderer` (background, panel clipping, image drawing)
10. Build `InteractionController` (pan, zoom, pointer capture)
11. Build `SpineTypography` engine
12. Build `GuideOverlays` (bleed, trim, fold, safety lines)
13. Build `CanvasEditor` React wrapper

### Phase 4: 3D Preview
14. Build `CaseGeometry` (UV remapping)
15. Build `CaseMaterials` (PBR sleeve + casing)
16. Build `BlurayScene` R3F component
17. Build `ThreeDPreview` with CanvasTexture sync

### Phase 5: Export
18. Build 300 DPI raster export
19. Build PDF vector export
20. Build imposition calculator
21. Build ZIP bundler
22. Build ExportModal UI

### Phase 6: Polish & Deploy
23. App shell layout, toolbar, responsive design
24. Dark theme styling
25. GitHub Pages deployment config
26. README documentation

---

## Verification Plan

### Automated Tests
- `npm run type-check` — TypeScript strict mode compilation
- `npm run lint` — ESLint checks
- `npm run build` — Production build succeeds with no errors
- Unit tests for pure functions: `imposition.ts` layout math, `CaseGeometry.ts` UV calculations, `steam.ts` URL builder

### Manual Verification
1. **Search flow:** Type a game name → see results → click to add to queue → verify artwork loads
2. **2D editor:** Select a queued item → see cover rendered on canvas → pan/zoom image within panels → edit spine text
3. **3D preview:** Toggle to 3D view → see Blu-ray case with artwork mapped → rotate 360° → verify spine text visible
4. **Export:** Click export → download 300 DPI PNG → verify dimensions match 3248×1831 px → verify PDF opens with correct mm dimensions
5. **Multi-item:** Add 3+ items to queue → switch between them → verify each renders independently
6. **Cross-browser:** Test in Chrome, Firefox, Safari (canvas and WebGL compatibility)
