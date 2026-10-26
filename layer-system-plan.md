# CoverForge v2: Layer-based editor, design and plan

Status: **built (revision 6).** Work is on branch `feature/layer-system`. Phases 0–6 are done; the notes under each phase in §7 say what was built and where it differs from the plan. Phase 7 (slipcover, #13) is independent and not started.
Covers GitHub issues [#3 Multiple images](https://github.com/kmturley/cover-forge/issues/3), [#12 Multiple backgrounds](https://github.com/kmturley/cover-forge/issues/12) and [#14 Per-panel typography](https://github.com/kmturley/cover-forge/issues/14). It also sets up [#13 Slipcover](https://github.com/kmturley/cover-forge/issues/13), which is mostly template geometry.

### What changed since the first draft

| Review feedback | Result |
|---|---|
| **(rev 3)** Layers that span sides, if not too complex | Moderate cost, not massive. The layer list becomes **one flat list per design** where each layer has a `target` (a panel or the whole canvas) (§2.1, §2.11). The data model supports spanning from day one; the UI for it ships later. |
| **(rev 3)** Branded group as the toggle; keep edits | Branded is a **folder** of layers. Its eye icon is the toggle, and hiding never discards edits (§2.5). |
| **(rev 3)** Google Fonts, maximum choice, low upkeep | Remote catalogue of about 2,000 families, loaded on demand through the Fontsource API and CDN, with no key and no list for you to maintain (§2.12). |
| **(rev 4)** Designs can be diffs, if reproducible | **Replaces rev 3's snapshot idea.** A design is a **diff over the template's default layers**, so it stays small. Reproducibility comes from versioned, frozen defaults (§2.6, §2.9). Items use the same diff structure. |
| **(rev 4)** Dust and assembly flaps shouldn't be designable | Glue tabs, tuck flaps and dust flaps become **assembly panels**: no tab, no layers, plain fill, and marked as hidden when assembled (§2.10). This also settles the "whole canvas" question (§2.11). |
| **(rev 4)** Is Fontsource reliable and licence-compatible? | Checked: MIT-licensed, actively maintained, and its fonts are almost all OFL (§2.12). |
| Logo should be a generalised vector image | `logo` is gone as a type. Vector graphics are an **image source** (§2.2). |
| Code should be generalised / extensible | `code` becomes a **`generated` layer** backed by a generator registry (§2.3). |
| Official branding should be ordinary editable layers | There is no locked `official` layer. The Branded toggle contributes ordinary, fully editable layers (§2.5). This is more work and is now its own phase. |
| Don't store big assets in localStorage; store URLs | Assets are references. Remote = URL only; local = bytes in IndexedDB (§2.4). |
| Designs must be portable across cases; template = case + default design | Designs are case-agnostic. A **Template** is a case plus its default layers (§2.6). |
| Start/End sliders feel inexact; want left/centre/right anchoring | New **anchored placement** model and a visual inspector (§2.7, §5). |

---

## 1. Where we are today

Each panel (`front`, `spine`, `back`, …) holds fixed single-instance "slots" (`PanelSettings` in [src/types/editor.ts](src/types/editor.ts)):

| Slot | Count per panel | Where it is drawn |
|---|---|---|
| `backgroundColor` | 1 | `renderCover`, per panel |
| `image` + `transform` | 1 | `renderCover`, per panel |
| `border` | 1 | `renderCover`, per panel |
| spine text (`SpineSettings`) | 1, spine panels only, one global style | separate pass |
| `logo` | 1 | separate pass over all panels |
| `code` (QR/barcode) | 1 | separate pass over all panels |
| "Branded" banner (`drawOfficial`) | 1 per case | separate pass, between images and text |

The draw order is hard-coded: backgrounds and images, then the banner, then spine text, then logos, then codes.

Settings resolve as **default → design → item**, each a sparse field-level overlay (`resolvePanel`, `mergePanelSettings`, `layeredShared`). That is what makes "this item" edits and shared designs work.

What can stay:

- `PanelBox` percent boxes ([src/engine/box.ts](src/engine/box.ts)), your agreed placement model. §2.7 refines how boxes are *authored*, not how they are drawn.
- `renderCover` is pure and synchronous and feeds the editor, the 3D texture and all exports. Layers only change what it loops over.
- Designs as shareable, per-item-assignable styles.
- Exports, because they rasterise `renderCover` (see §8 on "vector").

What blocks the requested features:

- The slot model is fixed. There is nowhere for a second image, background or text box.
- Spine text is a special case. Front and back have no text.
- Sparse field overlays work for named fields, not lists.
- There are no static design-level images such as a publisher logo or a rating icon.
- Logos, codes and the banner each have their own drawing code and their own settings shape.

---

## 2. Target model

### 2.1 Layers: five types

A design holds **one flat, ordered list of layers**, bottom to top. Each layer says what it is placed against (`target`). The panel tabs in the UI are a filter on that list, not separate lists.

```ts
type LayerType = 'shape' | 'image' | 'text' | 'generated' | 'group';

interface LayerBase {
  id: string;            // stable, unique in the design (see §2.8)
  type: LayerType;
  name?: string;         // user label
  visible: boolean;
  parent?: string;       // id of the group/folder it sits in (§2.5)
  target: PanelId | 'canvas' | { group: string };   // what its placement is measured against (§2.7, §2.11)
  placement: Placement;  // §2.7
  rotationDeg: number;
  opacity: number;
}
```

Why flat, not a list per panel: it is the only shape that lets one layer span several panels and lets layers on different panels interleave in one z-order. It costs almost nothing now and would be a migration later, so I'd decide it before phase 1 even if the spanning UI comes later.

| Type | Replaces | Notes |
|---|---|---|
| `shape` | background colour, border, issue #12 colour blocks, banner bands | `rect \| ellipse \| path`, solid or **gradient** fill, stroke, corner radius, optional drop shadow. `path` is SVG path data in a 0–100 box, which is how curved and angled banner edges are expressed (§2.5). |
| `image` | the image slot, **logos**, issue #3 | Raster or vector source, optional tint (§2.2). |
| `text` | spine text, issue #14 | Variables (`{title}`, `{creator}`), font, size (auto or mm), weight, italic, letter-spacing, align, case transform, colour, stroke, shadow, orientation. |
| `generated` | QR / barcode | Output of a registered generator (§2.3). |
| `group` | banner lockups (symbol + wordmark); the **Branded folder** | One type, two uses. With a placement, it is a frame: children are placed relative to it (a lockup), so it moves and resizes as one. Without a placement, it is a **folder**: it only shows, hides, fades and orders its children, and each child keeps its own `target` (so a folder can hold a front header, a spine cap and a back mark). No auto-layout in v1. |

Every property has an **Auto** state that uses the built-in value, and a **Custom** state. The codebase already uses this convention (`box: null`, `textHeightMm` unset), so I'd generalise it.

### 2.2 Logos are images: raster, vector and tinted

A logo is an image whose source happens to be vector. One image layer type covers all of these:

```ts
type ImageSource =
  | { kind: 'role'; ref: ImageRef }                       // 'cover' | 'hero' | 'logo' | `screenshot:n`; resolved per item
  | { kind: 'asset'; id: string }                         // a design-level asset: raster or SVG (§2.4)
  | { kind: 'vector'; id: string; only?: number[]; crop?: [number, number, number, number] };
                                                          // built-in vector library (today's src/brands)

interface ImageLayer extends LayerBase {
  type: 'image';
  source: ImageSource;
  tint: string | null;          // recolour: every opaque pixel becomes this colour
  fit: 'fill' | 'fit';          // used when both axes have a numeric size
  focus: { x: number; y: number };   // 0-100, default 50/50: which part stays visible when a fill crops
}
```

- **Built-in vector library.** Today's [src/brands/](src/brands/) (Simple Icons paths plus the multi-colour logos with `only` and `crop`) becomes the `vector` source. The renderer keeps using `Path2D`, so existing brand drawing carries over. Nothing is removed (the platform logos stay, as you decided).
- **Tint** works for any image, raster or SVG, by drawing it to an offscreen canvas and compositing the colour with `source-in`. Without tint, a multi-colour logo keeps its colours.
- **User SVG uploads** are loaded as images, so they're sandboxed and can't run script. They can be tinted the same way.
- **`focus`** is new. Today a Fill image is always centred when cropped. A focal point lets users choose which part of a cover survives the crop, and, because it is a point rather than an offset, **the same image keeps its subject framed when the case changes** after the media was chosen. It is stored as a percentage of the image, so it survives resizing.
- **Automatic focal point (optional, after the manual control).** A suggested focus can be detected when an image is added, always overridable by hand. In order of cost:
  1. **Saliency heuristic** (a small, dependency-light "smart crop" scorer that favours edges, saturation and skin tones). Runs anywhere and is the sensible default.
  2. **Browser face detection** where the browser offers it (the Shape Detection `FaceDetector` is Chromium-only and experimental, so it is a progressive enhancement, not something to rely on).
  3. **A face/object model** (MediaPipe or similar, loaded lazily from a CDN). More accurate, but it is a multi-megabyte download, so it would be opt-in.
  Faces are tractable. **Logos are not detected reliably by any of these**; a logo is better handled by the saliency pass or by the user, and logos are usually placed as their own layers anyway. I'd ship the manual control first, then the saliency default.
- **Per-item roles still work.** A design saying "front image = cover" gives every game its own cover. A design saying "back image = asset `esrb-m`" gives every item the same rating badge.

### 2.3 Codes are generated content: a generator registry

`code` becomes a layer type, `generated`, which draws whatever a **generator** produces:

```ts
interface Generator<P> {
  id: string;                         // 'qr' | 'barcode' | ...
  label: string;
  defaults: P;
  params: ParamSpec[];                // drives the inspector UI automatically
  render(ctx, rect, params, item): void | Promise<void>;   // draw into the layer's rectangle
}

interface GeneratedLayer extends LayerBase { type: 'generated'; generator: string; params: unknown; }
```

- QR and the barcodes (EAN-13, UPC-A, Code 128) become built-in generators that reuse today's [src/engine/code.ts](src/engine/code.ts). The `{appId}` pattern tokens still work.
- The inspector for a generated layer is built from `params` (colour, text, select, number), so a new generator needs no UI code.
- **Extensibility is tiered, because arbitrary code in a design file is a security problem.** Designs get shared in `?c=` links and imported from JSON, so a design must never be able to carry executable code.

| Tier | What | Safety | When |
|---|---|---|---|
| 1. Built-in generators | QR, barcodes. Later: rating badge, gradient or pattern fills, tracklist (music), star rating, release date. | Ships with the app. | Phase 2 |
| 2. **SVG/HTML template generator** | The user writes an SVG (or limited HTML/CSS) with `{variables}`. It is drawn as an image, which cannot run scripts. | Safe by construction. Needs sanitising and has limits: no external resources, and fonts must be embedded. HTML via SVG `foreignObject` also has uneven browser behaviour, so I'd start with plain SVG. | Phase 4 |
| 3. Installable JS plugins | A third-party generator function. | Real risk. It would have to run in a sandboxed iframe or worker, be installed explicitly by the user, and **never be loaded from a share link or a design file**. | Deferred. The registry keeps the door open. |

So "a plugin which renders an image" and "custom HTML output" are both supported by the same registry, but only the first tier needs to exist for the first release, and tier 3 shouldn't happen without a sandbox design of its own.

### 2.4 Assets: references, not copies

Never in `localStorage` (about 5 MB, and today's code already keeps bytes in IndexedDB; `localStorage` holds only the small session JSON). An asset is a *reference* plus metadata:

```ts
interface Asset {
  id: string;
  name: string;
  source:
    | { kind: 'url'; url: string }          // remote: only the URL is stored
    | { kind: 'local'; ref: string };       // `local:<id>`: bytes in IndexedDB (existing mechanism)
}
```

| | Stored | Survives reload | Travels in share link | Travels in Save file |
|---|---|---|---|---|
| Remote URL | the URL only (tiny) | yes | **yes** | URL (or optionally embedded) |
| Local upload | bytes in IndexedDB | yes, this browser only | no (as today) | embedded (as today) |

- **Missing local files can be found again.** A local asset's record keeps its **name, size, pixel dimensions and a content hash**, even when the bytes aren't available (a design shared to another machine, or a cleared browser). The design still loads, with the layer showing a "missing: `logo-esrb.png`" placeholder that keeps its position and size. The user picks the file (or drops a whole folder), and the app matches by hash first, then by name and size, fills in every layer that used it, and stores the bytes. Nothing in the design needs editing. This gives shared designs the "reselect the missing asset and it populates" behaviour without needing a file path.
- A design that uses URL assets is reproducible anywhere: the full-size image is loaded on demand from the URL and cached in memory (`imageCache`), and refreshed if needed.
- **A local file's path can't be stored.** Browsers never expose it (the comment at the top of [src/storage/localImages.ts](src/storage/localImages.ts) says the same). The nearest options:
  - Keep the bytes in IndexedDB, which is what we do today.
  - On Chromium, optionally keep a `FileSystemFileHandle` in IndexedDB, so the app re-reads the original file from disk instead of copying it. The user would have to re-grant permission each session. I'd treat this as an optional later add-on.
- Remote images need CORS headers or the canvas becomes tainted and can't export. The existing proxy ([src/api/corsProxy.ts](src/api/corsProxy.ts)) already handles that for item art, and assets would use the same loader.
- Allow-listing hosts for shared links stays deferred, per your earlier decision. Arbitrary asset URLs in a shared link make that question a little more relevant, so it's worth revisiting.

### 2.5 Branded: ordinary editable layers

The Branded toggle no longer calls a special drawing routine. It adds ordinary layers, tagged `role: 'branded'`, to the stack.

**Can the existing trade dress be expressed as ordinary layers?** I checked [src/engine/official.ts](src/engine/official.ts). The data is already declarative (`Branding { front, spine, back }`, in fractions of the panel), so most of it maps directly. A few things need a slightly richer `shape`/`group`, which is why §2.1 includes them:

| Banner feature today | Expressed as |
|---|---|
| Flat band, tab, strip, plate | `shape` rect, solid fill |
| Diagonal tab edge, dome-topped spine cap, curved lower edges (`slope`, `arc`, `ease` depth functions) | `shape` **path**, with the depth function sampled into path points when the layers are generated |
| Gradients (`Paint`) | **gradient fill** on a shape |
| Lines with taper or shadow | `shape` path with stroke and shadow, or thin rects |
| Platform marks and lockups (symbol + wordmark in a row or stack, optional frame) | `group` containing `image` (vector source) and `text` layers |
| Xbox orb, 360 swoosh | `image` with a vector source (the 360 waves are already traced paths in `x360Waves.generated.ts`) |
| Spine title start inset, forced capitals, colour on a coloured spine | patches to the spine `text` layer's placement, case transform and colour, contributed with the branded set |

A generator function, `brandedLayers(kind, variantId)`, turns the existing `Branding` data into those layers. Curve depth functions sampled into path points mean a tiny difference from today's pixels, which is why §3's harness compares with a tolerance per platform.

**The Branded folder is the toggle.** The branded layers live in one `group` **folder** named "Branded" (no placement of its own, so its children can sit on the front, spine and back). The folder's eye icon replaces the Branded checkbox. Hiding it hides every child and **never deletes or resets anything**, so edits are kept and come back when you show it again. The toolbar checkbox can stay as a one-click shortcut bound to the same folder.

Every template's folder uses the same id (`branded`), so one hide/show applies across a mixed queue (a PS4 game and a DVD), and each case supplies its own children.

The branded layers belong to the **Template**, not to the user's design (§2.6), because they are specific to a case: a PS4 header belongs on a PS4 case. Layers resolve in this order:

```
default layers (generated for the case)
   → the template's own layers (the Branded folder, plus patches such as the spine title inset)
      → the design (its layers, and patches by layer id)
         → the item (patches by layer id)
```

Users edit a branded layer exactly like any other. The edit is stored as a **patch on that layer's id** in the design, such as `branded.front-band → { fill: '#ff0000' }`. Nothing is locked, and the layer stays "official" underneath, so:

- Delete a branded layer and it is stored as hidden, so it can be restored.
- "Reset to official" removes a layer's patch; "Restore official layers" brings back deleted ones.
- "Make editable copy" copies a branded layer into the design as a plain layer, independent of the template.
- A patch for a branded layer that the current case doesn't have is simply ignored, so a design stays portable.
- Removing the folder entirely (rather than hiding it) is available but not the default. You asked whether to remove or hide: **hide is the toggle, and removal is a separate, deliberate action.**

This is the natural use of the patch-by-id inheritance (§2.8).

This is the largest conversion in the plan (about 900 lines of drawing code and every platform). It gets its own phase (§7), and `drawOfficial` stays in the tree until each platform's generated layers pass the pixel comparison.

### 2.6 Cases, templates and designs

| Term | Meaning |
|---|---|
| **Case** | Physical dieline: panels, bleed, folds. Unchanged. |
| **Template** | What the user picks in the library: a **case plus its default design**, including its Branded folder (§2.5). |
| **Design** | A named, **case-agnostic, portable diff** over the template's default layers: the layers you added, the default layers you changed, hid or reordered. Only changes are stored, so a design is small. |
| **Preset** | A built-in design (read-only; picking one copies it into the user's own). |

- **A design is a diff, not a snapshot.** Default layers aren't stored in every design, which keeps designs, saves and share links small. This reverts the snapshot idea from revision 3, on your condition that designs stay reproducible (see below).
- **Items use the same diff structure** (§2.8), applied on top of the design, so "This item" edits work as they do today. Template, design and item are three levels of one mechanism.
- **Reproducibility.** A diff only reproduces the same cover if what it is a diff *of* stays put. So the default layers are treated as a **public, versioned format**:
  - A default layer's id and look are frozen once released.
  - Improvements ship as new layer ids, and a design records the defaults version it was made against (`base: n`). Layers introduced after `n` are hidden for that design unless the user opts in. Only a deliberate migration changes an existing layer.
  - Tests snapshot the default layers per case, so an accidental change fails CI.
  - A design can be **exported as a self-contained JSON file** (defaults flattened in) for sharing outside the app, so a recipient doesn't depend on our defaults.
- An item stores its template/case (`templateId`) and its design (`designId`) **independently**. People often print on a different case from the original (to save space, or because it's what they have), so switching case must never discard the design. The new case contributes its own default layers (and Branded folder), and the design's diff applies by layer id. A change to a layer the new case doesn't have is simply ignored.
- If a design has layers aimed at one case's geometry (a logo placed to clear a PS4 header), that's the user's choice. Presets can carry `forCases` hints without restricting where they can be used.

### 2.7 Placement: anchored, with a visual inspector

**The problem.** A start/end pair is how a box is *drawn*, but it's an awkward way to *author* one:

- A centred logo 10% wide means "45% from the left, 45% from the right", which is hard to compute and breaks when you change the width.
- A background block "from the left to 80%" is natural as *start + size*, not start + end.
- For Fit/Fill images, the box and what's inside it are different rectangles, so moving the box edges doesn't feel connected to what you see.

**The model.** Each axis is placed by an **anchor** plus a position and a size, as in design tools:

```ts
type Size = number | 'auto';   // % of the panel along this axis; 'auto' = from the content's aspect ratio

type Axis =
  | { anchor: 'start';   offset: number; size: Size }   // left/top edge at offset%
  | { anchor: 'center';  offset: number; size: Size }   // centre at offset%
  | { anchor: 'end';     offset: number; size: Size }   // right/bottom edge `offset`% in from the far edge
  | { anchor: 'stretch'; start: number;  end: number };  // inset from both edges (what a PanelBox is today)

interface Placement { x: Axis; y: Axis; }
```

| What you want | x | y |
|---|---|---|
| Solid block from the left edge to 80% | start, offset 0, size 80 | stretch, 0 and 0 (full height) |
| Logo 10% wide, centred in the panel, 5% from the top | center, offset 50, size 10 | start, offset 5, size **auto** (follows the logo's shape) |
| Strip across the top, 12% tall | stretch, 0 and 0 | start, offset 0, size 12 |
| Badge 8% in from the right, 4% from the bottom | end, offset 8, size 14 | end, offset 4, size auto |
| Full panel (the default today) | stretch, 0 and 0 | stretch, 0 and 0 |

Notes:

- **`auto` size** is how a logo or image keeps its shape without anyone doing aspect-ratio arithmetic. One axis gives a size; the other follows. (In millimetres, a percent of width and a percent of height differ, so the engine converts through the panel's real size.) When both axes are numeric, `fit` or `fill` decides how the content sits in the box.
- Negative values and values over 100% still reach into the bleed or beyond, as today.
- **The engine still draws a `PanelBox`.** `placementToBox(panel, placement, contentAspect)` is a pure function that turns the anchored form into the percent box that the existing helpers (`boxRect`, `fitInside`, `fillOver`, `computePlacement`) already take. So nothing downstream changes.
- **Migration is lossless.** Every existing `PanelBox` becomes `stretch` on both axes. `box: null` (automatic) stays as a per-type default placement.
- The anchor survives edits: changing the width of a *centred* layer keeps it centred, and changing a *start*-anchored layer's width keeps its left edge fixed. That is the whole point.

**Inspector (the "easy way").** For a selected layer:

```
 Position   ┌───────┐    X [ 50 ] %    Y [  5 ] %
 anchor     │ ▫ ▫ ▫ │    W [ 10 ] %    H [auto]  ⛓
            │ ▫ ● ▫ │    ↔ Stretch between edges     ↕ Stretch
            │ ▫ ▫ ▫ │
            └───────┘    ≈ 13.0 × 6.4 mm
```

- The 3×3 grid picks the **reference point**, as in Figma or Photoshop. Pick top-centre and X/Y mean "where the top-centre of this layer sits", and W/H grow around it. That sets each axis's anchor (start, centre or end) in one click.
- `↔ Stretch` switches an axis to left/right (or top/bottom) insets, for full-width bars and fills.
- `H: auto` or the lock icon keeps the content's shape.
- Align buttons (left, centre, right, top, middle, bottom) and "Fill panel" for the common cases.
- Numbers are typed inputs with a slider alongside, and a millimetre readout, so values can be exact.
- For Fit/Fill images, the 2D canvas shows both the dashed **box** and the **actual picture**, and the picture can be panned within a Fill box (`focus`).

This pairs with direct manipulation on the 2D canvas (§5.3): dragging writes the same anchored placement, snapping to centre lines, edges and trim/safe lines. That is the "more visual" control you suggested, and it covers the "sliders don't feel exact" problem, because you move and resize what you see.

### 2.8 Where layers are stored, and how inheritance works

The current sparse field-level overlays don't work for lists, so a layer-aware equivalent is needed. Every level (design and item) uses the same **diff by layer id**:

```ts
interface LayerDiff {
  patch:  Record<string, Partial<Layer>>;       // change fields of a layer that already exists lower down
  hidden: string[];                             // layers removed (kept as hidden, so they can be restored)
  added:  { layer: Layer; after?: string }[];   // new layers, placed above `after` (or on top)
  order?: string[];                             // optional full order, the one thing that can't be patched by id
}
```

Resolution is one function applied twice:

```
resolve = apply(item.diff, apply(design.diff, template.layers))
```

| | Whole-list replacement | Diff by id (**chosen**) |
|---|---|---|
| A one-field tweak | Detaches the whole list from what is below it | Changes just that field |
| Size in saves and links | Large | Small |
| Fits branded layers (§2.5) | No | **Yes: this is exactly how users tweak official layers** |
| Fits portability across cases | Poorly | Yes: unmatched ids are ignored |

The Default design is just a design with no (or the user's own) diff.

### 2.9 Built-in defaults

Today some defaults are computed in code (`defaultImageRef`, `defaultCodeKind`, default spine text). They become a generated **default layer list**, `defaultLayers(kind)`, with fixed ids named by target. For example `front.fill`, `front.image`, `spine.fill`, `spine.text`, `back.fill`, `back.image`, `back.barcode`. The barcode generator takes `kind: 'auto'`, so one list still means a barcode or nothing per case.

As described in §2.6, this list is a **versioned, frozen public format**, because every design and item diff is relative to it. That is the price of small diffs, and it is small: the defaults are a handful of layers per case.

### 2.10 Assembly panels: flaps and tabs are not designable

Parts of a dieline are folded away or glued shut and never seen on the finished piece. These become **assembly panels** and are not designable:

| Assembly (not designable) | Still designable (visible when assembled) |
|---|---|
| Glue tab (`glue`) | Front, back, spine and second spine |
| Top and bottom tuck flaps (`tuck`, `bottomTuck`) | Box lid and bottom faces (`top`, `bottom`) |
| Dust flaps (`dustTopLeft`, `dustTopRight`, `dustBottomLeft`, `dustBottomRight`) | The cassette's back flap (`flap`), which is a printed, visible wrap |

The split is read from the dieline definitions in `src/templates/definitions.ts`. Please check it matches your intent (Open question 2).

What changes:

- **Template data.** Each `PanelRect` gets an `assembly: true` flag (dust flaps already have `follows`). Assembly panels get a `follows` too: a glue tab or tuck flap takes the fill of the panel it extends, so the printed paper edge looks continuous.
- **Editor.** No tab for them in the panel list, and no layer can target them. The 2D view shades them with a hatch and a small label such as "Assembly flap, hidden when assembled", so it is clear why they can't be edited. The hatch is a preview aid only (like the guides) and is never part of the exported print.
- **Rendering.** An assembly panel draws only its leader's plain panel fill (§2.1, `followed` fills). No images, text, logos or codes, as dust flaps already behave.
- **Spanning layers** (§2.11) don't paint onto assembly panels either.
- **Behaviour change.** Today the glue and tuck panels have their own tabs and settings. After this change, any colour or image someone put on them in an existing save is dropped by the migration (it only affected hidden parts). The migration notes it.

### 2.11 Layers that span panels

**Short answer: moderate cost, not massive**, as long as the flat layer list (§2.1) is chosen now. Most of the machinery already exists: `renderCover` already draws the whole canvas and clips per panel.

What a `target: 'canvas'` layer needs:

| Piece | Work | Size |
|---|---|---|
| Flat list with a `target` (instead of a list per panel) | Data-model choice, made once in phase 1 | small now; a migration if added later |
| Canvas-relative placement | Same anchored `Placement` (§2.7), measured against a rectangle that covers the designable panels instead of one panel. `placementToBox` takes the target's rectangle. | small |
| Clipping | Clip to the **union of the designable panels' paint areas**, so fills don't land in gaps, past the cut, or on assembly flaps. The renderer already builds a union like this for `hideOutsideCut`. | small |
| UI | A "Canvas" tab beside the panel tabs, and a Target selector in the inspector. | small to medium |
| Direct manipulation | Dragging a canvas layer works the same as any other (§5.3). | included |
| Z-order across targets | One shared list handles it. | included |

**The canvas target is defined by assembly panels (§2.10):** it is the bounding rectangle of the **designable** panels only, and it clips to their union. That keeps tuck, glue and dust flaps out of both the coordinates and the paint, which settles the earlier question about what "whole canvas" means on a box.

Caveats worth knowing:

- **Portability.** A layer positioned across the spine joint is measured against the *canvas*, and canvases differ per case (the spine is 14 mm on one case and 7 mm on another). A spanning fill or gradient travels fine, but a spanning image placed to line up with the spine on one case will drift on another. Per-panel layers don't have this problem, which is a good reason for them to remain the default.
- 3D preview and exports need no change: they already use the whole-canvas render.

**Recommendation.** Build the **data model and renderer** for `canvas` targets in phases 1–2, so nothing needs migrating later. **Ship the UI** right after phase 2, or earlier if it turns out to be cheap in practice. Until then, the workaround of two layers, one on each side, works.

### 2.12 Fonts: Google Fonts, loaded remotely

**Recommendation: use the [Fontsource](https://fontsource.org) catalogue API, which mirrors Google Fonts, with no API key and nothing for you to maintain.** I checked it is reachable and CORS-enabled from a browser:

- `https://api.fontsource.org/v1/fonts` returns the whole catalogue (about 2,100 families: 1,984 Google fonts plus about 120 others) with category, weights, styles, subsets, licence and a `variable` flag. Categories include sans-serif, serif, display, handwriting, monospace, and pixel and retro faces such as *Press Start 2P* (which #14 asks for).
- Font files are served as `woff2` from a CDN (for example `https://cdn.jsdelivr.net/fontsource/fonts/press-start-2p@latest/latin-400-normal.woff2`), with `access-control-allow-origin: *`.
- The canvas draws them through the browser's `FontFace` API, and drawing text doesn't taint the canvas, so exports still work.

How it fits:

- **Recommended list first.** Before anything is typed, the picker shows a curated set for cover art, grouped by use. Every one of these exists in the catalogue (checked) and is OFL-1.1 or Apache-2.0:

  | Group | Fonts |
  |---|---|
  | Bold titles | Bebas Neue, Anton, Oswald, League Gothic, Staatliches, Teko, Archivo Black |
  | Clean sans | Inter, Montserrat, Poppins, Roboto Condensed |
  | Classic serif | Playfair Display, Cinzel, Cormorant Garamond, DM Serif Display, Abril Fatface, Lora |
  | Retro and pixel | Press Start 2P, Pixelify Sans, Silkscreen, VT323 |
  | Sci-fi and tech | Orbitron, Audiowide, Rajdhani, Michroma, Russo One |
  | Action and poster | Bungee, Black Ops One, Bangers, Righteous |
  | Script and handwritten | Pacifico, Lobster, Permanent Marker |
  | Typewriter and mono | Special Elite, Courier Prime, Space Mono |
  | Horror and novelty | Creepster, Monoton |

  The list is a short constant in the code, easy to edit. Typing in the search box searches the full catalogue, and a category filter (sans-serif, serif, display, handwriting, monospace) narrows it. Fonts already used in the design are pinned at the top.
- **Picker.** A searchable list of the whole catalogue, filtered by category, each family previewed in its own typeface (lazy-loaded as it scrolls into view). Nothing is bundled, so there is no list to keep up to date.
- **Only the chosen fonts are downloaded**, by weight, style and subset. Latin is the default. If a title contains Cyrillic, Greek or other characters, the matching subset is also loaded (the API lists each subset's `unicodeRange`).
- **A design stores the family name, weight and style**, not the font file, so it stays small and reproducible: opening a design later re-fetches what it needs. `preloadItem` awaits the fonts before drawing, then repaints.
- **Failure behaviour.** If the catalogue or a font can't be fetched (offline, blocked), the text falls back to a system font and the UI says so. A small built-in fallback list (about 10 safe families) keeps the picker usable offline.
- **Optional extras:** user-uploaded fonts (`.woff2`/`.ttf`) as assets, and "apply this font to every text layer".

**Is Fontsource reliable, and is the licensing compatible?** I checked, rather than assuming:

- **Project health.** Fontsource is open source (MIT-licensed, about 6,000 GitHub stars, last pushed within the past two weeks, not archived). Its npm packages are heavily used: the Inter package alone had about 2.8 million downloads in one week. Its catalogue API answered in roughly 0.15–0.2 seconds on three tries.
- **Licences.** Of the roughly 2,100 families in the catalogue, **1,944 Google fonts and 115 others are SIL Open Font License 1.1**, 36 are Apache 2.0, and a handful are CC0, MIT or Unlicense. Five are UFL 1.0 (the Ubuntu Font Licence). These licences allow using the fonts for commercial and personal print work, and we don't redistribute the font files: the browser fetches them from the CDN. The OFL's restrictions are about selling or renaming the font itself, not printing with it. The catalogue exposes each font's `license`, so the picker can show it and could exclude any family you'd rather not offer.
- **Residual risks.** It is a volunteer-run free service, so there is no SLA. The mitigations are the offline fallback list and the fact that the same fonts also exist on Google's own CDN, which could be added as a second source if Fontsource ever misbehaves. A design stores only the family name, so switching source later is invisible to users. (This is a judgement from the checks above, not a guarantee.)

Trade-offs to be aware of:

- **Dependency on a third-party service** (Fontsource's API and the jsDelivr CDN). It is free and widely used, but it is not under your control. Google's own CSS API is the alternative for *loading* fonts, but its catalogue endpoint needs an API key, so the keyless Fontsource route is simpler to run.
- **Privacy.** Loading fonts from a CDN means the visitor's browser contacts that CDN. This matters for some EU sites, so it is worth a line in the README. Fonts only load when a design uses them.
- **Offline use.** The app ships as a single HTML file, but remote fonts won't load without a connection. Everything else works offline, with fallbacks for fonts.

---

## 3. Data migration (session v2 → v3)

`SessionV2` has `version: 2`. v3 adds `assets` and replaces the `PanelSettings` fields with layers.

**Key idea.** The migrator turns the v2 settings into the *same default layer list with the same fixed ids* (§2.9, such as `front.image`), then converts each v2 field into a patch on that id. Existing designs are already sparse overlays in v2, so each one maps straight onto a v3 diff (§2.8), with no need to flatten it. Settings on the glue, tuck and dust panels are dropped, since those panels are no longer designable (§2.10). That covers `backgroundColor`, `image` and `transform`, `logo`, `code`, `border`, the spine style fields, and per-item `panels` and `spineOverride`. Old `PanelBox` becomes `stretch` placement, and the global `banner: true` becomes "Branded on". Old saves, old `?c=` share links and old deep links all keep working with no visible change. Legacy mm fields (`xMm`, `yMm`, `scale`, `widthMm`) are still honoured until the layer is next edited.

**Safety net before any UI work: a pixel-regression harness.** It renders a set of v2 fixtures through the old pipeline and through migrate-then-render, and asserts they match. The fixtures cover several cases, with and without Branded, with logos, codes and item overrides. `@napi-rs/canvas` is already a dev dependency and `scripts/measure-covers.ts` uses it, so this is feasible. The existing `templates.test.ts` snapshot covers geometry, not paint.

The same harness later checks branded conversion (§2.5): each platform's generated layers against `drawOfficial`, with a small tolerance for sampled curves.

---

## 4. Rendering changes

`renderCover` becomes, in outline:

```
layers = resolveLayers(default list → template layers → design → item)    // patches applied, hidden removed, folders flattened
for layer in layers (bottom → top):
  rect = rectOf(layer.target)                  // one panel's area, the canvas, or a group's frame
  clip to (panel's paint area | union of panel paint areas for canvas)
  draw(layer)                                  // dispatch on layer.type
```

- The separate logo, code, spine-text and banner passes go away. Each becomes a layer type's `draw`.
- Existing helpers (`computePlacement`, `drawLogo`, `drawCode`, `drawBorder`, `drawSpineText`) become the per-type draw functions. They are reused, not rewritten.
- `preloadItem` collects URLs from all image layers, and awaits font loading (`document.fonts.load`) for every font used, then repaints.
- Spine text keeps its auto-size behaviour (fit the title to the spine) as the text layer's "Auto" size, not as a special case.
- The 3D preview and all exports need no structural change, since they call `renderCover`.
- A panel-targeted layer is always clipped to its panel's paint area, as logos are today, so nothing spills onto a neighbour. A canvas-targeted layer is clipped to the union of the panels instead (§2.11).

---

## 5. UX

### 5.1 Layout

Keep the panel tabs (Front, Spine, Back, …) for the **designable** panels only (not assembly flaps, §2.10): they match the physical piece and the 3D view. Each tab filters the one flat list to the layers on that panel, and a **Canvas** tab (and an **All** view) shows layers that span panels, once that ships (§2.11). Below the tabs, replace today's stack of Background, Border, Image, Logo, Code and Spine sections with a **layer list** and an inspector for the selected layer.

```
┌─ Template · Design ───────────────────┐
│ [Front] [Spine] [Back]                │
├───────────────────────────────────────┤
│ Layers                      [+ Add ▾] │
│ ┌───────────────────────────────────┐ │
│ │ 👁 ▣ Branded                  ▾  │ │  ← folder: this eye is the toggle
│ │    ▭ Header band                  │ │
│ │    🖼 PlayStation mark            │ │
│ │ 👁 T  Title text              ⋮⋮ │ │   ← drag to reorder
│ │ 👁 🖼 Cover image             ⋮⋮ │ │
│ │ 👁 ▭ Panel fill               ⋮⋮ │ │
│ └───────────────────────────────────┘ │
├───────────────────────────────────────┤
│ Title text                            │
│  Text      [{title}            ▾]     │
│  Font      (Auto) Custom [Inter ▾]    │
│  Position  (anchor grid · X Y W H)    │
│  Colour    [■]   Opacity [───●──]     │
└───────────────────────────────────────┘
```

**Add** menu: Text, Image (cover / hero / screenshot / upload / vector library), Shape (rectangle, ellipse, path), Generated (QR, barcode, …), Group.
Row actions: show/hide, duplicate, delete, rename, drag to reorder, and "Reset to official" on branded layers.

### 5.2 Items, designs and edit scope

The existing "design vs. this item" scope switch stays. In design scope edits change the design's layers and patches. In "This item" scope they become the item's patches. Rows with an override get the dot indicator the panel tabs have today, plus a "reset" action. The Branded folder's eye icon is the toggle (§2.5). The existing toolbar checkbox can remain as a shortcut bound to the same folder.

### 5.3 Direct manipulation (its own phase)

Today the 2D canvas only selects a panel on click. With many layers, and given your point about exactness, it should do much more:

- Click a layer to select it.
- Drag to move it. Drag handles to resize it. Both write the anchored placement from §2.7 (so moving a centred layer keeps it centred unless you drag it off).
- Snap to panel edges, the centre line, trim and safe lines, and other layers' edges, with visible guides and millimetre readouts.
- Arrow-key nudge, Delete, duplicate, and a Fill-box pan for cropped images.

### 5.4 Undo and redo

I couldn't find any undo or redo in `src`. With sliders that was tolerable. With add, delete and reorder it isn't. **I recommend adding undo and redo (a history stack in the reducer) in phase 2.**

---

## 6. Issue mapping

| Issue | Delivered by | Phase |
|---|---|---|
| #3 Multiple images, z-order, screenshot grids, rating icons | Any number of `image` layers per panel; reorder; static assets | 2 |
| #12 Multiple backgrounds / colour blocks | `shape` layers with anchored placement; Start/End/Top/Bottom via the Stretch toggle | 2 |
| #14 Per-panel typography | `text` layers on any panel | 2 (basic), 4 (full) |
| Editable branding | Branded set as ordinary layers | 5 |
| Presets and "save as my own" | Presets are designs; fork flow; JSON import and export | 6 |
| #13 Slipcover | Template geometry only; independent, can run in parallel. It benefits from layers that span panels. | any |

---

## 7. Phased plan

Each phase leaves the app shippable. Phases 0–1 have no visible change.

**Phase 0: Safety net.** Pixel-regression harness and v2 fixtures. Write the type and migration spec.

**Phase 1: Engine and data model, no UI change.**
- `Layer` types (the **flat list with `target`**, including `canvas`), `Placement` and `placementToBox`, `resolveLayers` (patching, with template layers as a source), `defaultLayers`, the per-type draw dispatch, and the generator registry (QR and barcodes).
- Session v3 and the v2 → v3 migrator.
- `renderCover` and `preloadItem` rewired.
- `drawOfficial` stays untouched, wrapped as a temporary internal layer so Branded renders identically until phase 5.
- The existing sidebar writes through a thin adapter to the layer ids.
- Exit criteria: the harness shows identical renders, and existing unit tests pass.

**Phase 1 as built (done).** The renderer now draws layers and all 104 goldens match, strictly on the capturing machine. Changes from the plan above, made on purpose:

- **State stays in the slot shapes for now.** `resolveLayers` reads the Default design, the item's design and the item's overrides through `settingsToDiff`, which maps each slot field onto a patch on the matching layer id (`front.image`, `spine.text`, …). That mapping is the migration, so no separate v3 session was needed yet. Switching saved state and the reducer to diffs is part of phase 2, because it can't be separated from the layer-panel UI that writes them.
- **Only panel targets.** The `canvas` target (§2.11) is deferred to phase 2 with its UI; the types and renderer don't yet have it.
- **Glue, tuck and dust panels behave as before** (glue and tuck still designable). Making them assembly panels (§2.10) changes the output of a golden by design, so it lands in phase 2 with the editor change and a deliberate golden update.
- **Defaults are concrete per case.** The default list is generated for the case, so the barcode layer's kind is set directly (EAN-13 on the back of most cases, none on a cassette) instead of an `auto` kind.
- **Empty layers exist.** `front.logo`, `front.border` and the other slots are in the default list, drawing nothing until set. The layer panel in phase 2 should show them as "add" placeholders rather than empty rows.
- **Branded is still `drawOfficial`**, wrapped as the single `official` layer, shown while Branded is on. Phase 5 replaces it.

**Phase 2: Layer panel.**
- Layer list and inspector; add, remove, reorder, show or hide, rename for all types.
- Multiple images, shape blocks, basic text layers.
- The anchor-grid placement inspector.
- Asset library (URL and local).
- Per-item overrides and "reset".
- Undo and redo.
- Layers that span panels: the **Canvas** tab and Target selector (§2.11), if time allows here, otherwise straight after.

**Phase 2 as built.** The layer list and inspectors replace the old sections; all of §2.11 (layers across panels) and §2.10 (assembly panels) landed here, with:

- diffs stored beside the slot settings (`diff` on the Default design, each design and each item), not instead of them: the slot fields remain the storage for what older saves set, and are cleared with "Back to the default". Normalising them into diffs at load can follow, now that nothing in the UI writes slots any more except the legacy reducer actions.
- a session version 3 that reads 1 and 2, with every diff, layer and asset validated field by field on load;
- undo and redo with coalescing, and an asset library that keeps the name, size, dimensions and hash of uploads (relinking a missing file works from "Your images");
- placed shapes, text boxes, extra images, a focus point, hide/reorder, and a Canvas ("All panels") tab;
- the 2D "Folds away" shading for assembly panels;
- an e2e smoke pass in a real browser (Playwright, kept outside the repo) that added every kind of layer, undid and redid, edited per item and reset.

Left for phase 3 and later: dragging on the canvas, the Google Fonts picker (the font menu is still the four built-in stacks), drag-to-reorder in the list (it has up/down buttons), and presets.

**Phase 3: Canvas direct manipulation.** Select, drag, resize, snap, nudge and fill-box pan on the 2D canvas.

**Phase 3 as built.** Clicking a layer on the 2D canvas picks it (and its tab); dragging moves it; the eight handles of the selected layer resize it (a corner keeps a picture's shape, Shift frees it); edges snap to the panel's edges, middle and safe margin and to other layers, with guide lines and a size readout (Alt switches snapping off); arrow keys nudge (Shift ×10), Delete removes, Ctrl/⌘+D duplicates, Escape lets go. Moves write the same anchored placement as the inspector, keeping how each axis is anchored (a centred layer stays centre-anchored, an auto length stays auto) and turning an automatic placement into one stretched between edges; a drag is one undo step. Rotated layers can be moved but resized only from the inspector. Not done: panning the focus point by dragging inside a cropped picture (the focus pad does it), and highlighting the selected layer in 3D.

**Phase 4: Text depth, generators and fonts.**
- Google Fonts picker and on-demand loading via Fontsource (§2.12).
- Stroke, shadow, letter-spacing, "apply font to all panels", spine orientation.
- Tier-2 SVG template generator.

**Phase 4, fonts and text depth, as built.** Text can use any Google font: the picker opens on the recommended list (grouped as in §2.12) with the system fonts, and searching reaches the whole Fontsource catalogue (lazy-loaded; "couldn't reach the font list" offline). A design stores the CSS family (`"Lobster", sans-serif`); a font's files load only when text uses it, by weight, style and the character sets the words need, before drawing (so the 2D view, the 3D texture and exports all wait for them). Text boxes gained letter spacing, an outline and a drop shadow, and "Use this font on every text layer" sets one font across a design in a single undo step. The spine title keeps its fixed bold look (no spacing, outline or shadow yet).

**Phase 4, custom graphics, as built.** The tier-2 generator is a `generated` layer with `generator: 'svg'`: SVG with `{title}`, `{year}`… variables (escaped, so a title can't break the markup), cleaned before every draw (scripts, foreign content, handlers, animation, links out, imports and external urls removed; DOCTYPE/ENTITY, non-SVG and over 20,000 characters refused) and drawn as a picture, so it can't run or fetch anything; checked not to taint the canvas in a real browser. Four starting points (ribbon banner, edition seal, rating badge, star rating) ship with it. Sandboxed JS plugins (tier 3) remain deferred.

**Phase 5: Branded as editable layers.**
- Gradient and path shapes and `group`.
- `brandedLayers(kind, variantId)` for each platform and format, checked against `drawOfficial` by the harness.
- The Branded folder's eye shows or hides the set; "Reset to official", "Restore official layers" and "Make editable copy".
- Remove `drawOfficial` when every variant passes.
- This is the largest single conversion: every platform's trade dress is re-expressed, one at a time.

**Phase 5 as built.** The Branded dress is ordinary layers. Rather than re-express every platform by hand, the dress's drawing code (headers, bands, tabs, strips, caps, marks, the Xbox orb and the 360 swoosh) was refactored to describe what it draws to a `Sink`; one sink paints a canvas (so the old rendering is unchanged, checked by all the existing goldens), and `LayerSink` turns the same description into layers: rectangles, outlines with gradient fills, marks (a logo's layers, crop or one colour), one-line text, ridges and orb as shapes with radial gradients. `brandedLayers(template)` caches them per case, all filed in a `branded` folder with ids named by panel and piece (`branded.front.band`, `branded.spine.cap`, `branded.front.mark-1`). While Branded is on, the dress also tells the spine title how to fit round it (room at the top, capitals, a colour when the chosen one wouldn't show), as patches on `spine.text`. Every case's layers are checked against the old canvas drawing (`layers/branded.test.ts`): at most 0.42% of pixels differ by more than 24 levels (edge anti-aliasing), and the two images look the same side by side. The folder's eye is the Branded switch; the 30-odd goldens that include the dress were re-captured once, deliberately. `drawOfficial` stays as the reference the layers are tested against.

Known limits: a layer is clipped to its panel (the old drawing wasn't), a lockup's parts are separate layers (moving a mark and its wordmark together means selecting both), and the Xbox 360's swoosh glow is 64 layers' worth of strips in a six-row approximation.

**Phase 6: Presets and designs.** Built-in presets, fork and save-as, design JSON export and import, preset picker.

**Phase 6 as built.** Six presets (Blank, Poster, Screenshot grid back, Retro arcade, Minimal, Gradient sleeve) are read-only diffs over the default layers, placed by percent so they fit any case; "New design from a preset" shows each drawn on the selected item and copies the chosen one into a design of the user's own. "Save this item's changes as a design" lays the item's own changes on the design it used (diffs merge, slot settings merge) so the cover looks exactly as before, and leaves the item with none. A design exports to `<name>.coverforge-design.json` (its settings, layers and the images its layers use, uploads embedded) and imports with the same validation as a session, a design id of its own, and asset ids remapped when one is already taken. Designs record the version of the default layers they were made against (`base`, `DEFAULTS_VERSION`), and a snapshot test freezes every case's default layer ids, kinds and targets so the format can't change by accident. Deviation from §2.6: an exported design is a diff plus its images, not "defaults flattened in": the frozen, versioned defaults make that unnecessary.

**Phase 7 (parallel, independent): Slipcover (#13).**

Rough size, as a guide: phases 0–1 are large and risky (migration and renderer), phase 2 is the biggest UI change, and phase 5 is a long tail of per-platform work. Phases 3, 4 and 6 are each roughly one focused chunk.

---

## 8. Risks and things to flag

1. **"Vector" export claims in #12 and #14.** The issues ask for PDF/SVG with vector text and shapes. Today's PDF and SVG exports embed the **raster** canvas inside a vector wrapper with vector cut lines ([src/export/svgExport.ts](src/export/svgExport.ts) embeds a JPEG). Layers don't change that. Percent boundaries stay exact, but text and shapes stay raster at 300 DPI. True vector output would be a separate renderer (an SVG/PDF backend beside the canvas one). Layers make that more feasible, since every layer type could get a vector `draw`, but I'd treat it as a follow-up and adjust those acceptance criteria.
2. **Migration correctness** is the main risk, so phase 0's harness is not optional.
3. **Branded conversion fidelity.** Sampled curves and re-expressed gradients may differ by a few pixels. The tolerance per platform needs your eye on the real covers, not just the test.
4. **Share-link size.** Links embed the whole session and are capped at 6,000 characters (`MAX_SHARE_URL`). Layers are more verbose than sparse fields, but case layers (branded) aren't stored in the link, only user edits to them are. URL-based assets travel in links; local ones don't. Mitigations: short keys, omit defaults.
5. **Remote fonts.** Google Fonts via Fontsource (§2.12) adds a third-party dependency, a privacy consideration for some regions, and no custom fonts offline (fallbacks apply). The app still builds as one HTML file.
6. **Generator security.** Tier 3 (JS plugins) is deliberately deferred. Design files and share links must never carry executable code.
7. **Existing decisions are respected:** percent boxes with Fill/Fit, platform logos stay and become editable, retro wear stays removed, and there is no image host allow-list for now.

---

## 9. Open questions and decisions needed

### Decided in review

| Topic | Decision |
|---|---|
| Layers spanning panels | Wanted, if not too complex. Moderate cost; flat list with `target` from phase 1, UI right after phase 2 (§2.11). Workaround of two layers is fine until then. |
| Branded | A folder of layers whose eye icon is the toggle; hiding keeps edits (§2.5). |
| Fonts | Google Fonts via Fontsource (approved), with a curated recommended list shown first (§2.12). |
| Undo and redo | Yes, in phase 2. |
| Designs | Diffs over the template's default layers, provided they stay reproducible: versioned, frozen defaults (§2.6, §2.9). |
| Dust and assembly flaps | Not designable; shown as hidden-when-assembled. Split approved (§2.10). |
| Focal point | Yes: manual control in phase 2, automatic detection later (§2.2). |
| Local assets | Metadata kept so a missing file can be relinked and the design repopulates (§2.4). |

### Still open

1. **Terminology.** Template = case + default design; Case = geometry; Design = diff over the default layers; Preset = built-in design. Does the wording match how you'd like the UI to read? You said you'd reread the document; this can wait for that.
2. **Chromium file handles.** Beyond name-based relinking, should the optional "re-read the original file from disk" handle be planned, or skipped?
3. **Generators.** Are tiers 1 and 2 (built-in plus SVG template) enough for now, with sandboxed JS plugins left for later?
4. **Starting presets.** Which built-ins ship first? Candidates: "Blank", the per-platform Branded looks (already covered by the template's Branded folder), and a "Screenshot grid back" for issue #3.

None of these blocks phases 0–1.
