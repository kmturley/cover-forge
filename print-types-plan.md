# Print types plan: insert, slipcover and box for every case size

Status: **built on branch `feature/print-types`, uncommitted, for testing.** (Originally a proposal; the editor calls a piece a *Type*, the code still says `piece`.) Builds on the layer system (see [layer-system-plan.md](layer-system-plan.md)) and absorbs [#13 Slipcover](https://github.com/kmturley/cover-forge/issues/13).

## 0. Decisions so far

| # | Decision |
|---|---|
| 1 | Slipcover is a full 4-panel wrap: front, back, two spines, plus a glue tab. No 3-panel U-shape. |
| 2 | A box encloses the case, card or media: the case size plus clearance (NFC card + clearance = NFC box). It is one piece whether it holds a case or the media directly. |
| 3 | Branded stays **on by default** for every piece; users can turn it off with the folder's eye, as now. |
| 4 | Scope is self-printed pieces: print on a sheet of card, cut, fold, glue. No factory-made paperboard cases (digipak, gatefold), no obi strips. |
| 5 | Every case gets all pieces, even the uncommon ones, except NFC stickers (decision 9). |
| 6 | Clearances are researched and sourced in `case-research.md` before building. |
| 7 | No new label types. The existing label templates (floppy, NFC card, NFC sticker) stay as they are; only Slipcover and Box are new. |
| 8 | Switching piece keeps the design and every per-item edit. Layers on panels the new piece doesn't have are kept but hidden. |
| 9 | NFC stickers get no slipcover or box. A piece button that a case doesn't support is **disabled**, not hidden. |
| 10 | The second spine mirrors the first by default. |
| 11 | A piece bigger than the paper shows an informational message that it needs a larger printer. Splitting and scaling are left to the print dialog. |

## 1. Fact check of the original list

| Item | Verdict | Notes |
|---|---|---|
| **Label / inserts**: slide inside a case or stick on the media | Right, but two different things | An insert (cover sheet, inlay, J-card, tray card) slides into a case. A label sticks to the media. In this app both are the *Insert* piece: the existing template for that case, whatever shape it has. |
| **Cases**: have their own size | Right as a size source, wrong as a print type | A plastic case isn't printed. It supplies the dimensions the other pieces derive from. |
| **Slipcovers**: go round the outside, no top and bottom flaps | Right | Open-ended paperboard sleeve with a glued seam: front, spine, back, second spine, glue tab (decision 1). Inside size is case + clearance, so it differs from the insert. |
| **Boxes**: go round the case, with flaps | Right, with a wider meaning | Closed ends: tuck flaps and dust flaps. A box is often the container itself (retro cartridge boxes, VHS, NFC), not something round a case. Same net either way (decision 2). |

Vocabulary: a **Case** is the format and its size (PS1, DVD, NFC card…). A **Piece** (called a **Type** in the editor) is what you print for it: **Insert**, **Slipcover** or **Box**.

## 2. What the code does today

- `TemplateConfig` is flat: `kind` + `variantId`, id `${kind}-${variantId}` (`src/templates/definitions.ts`, `src/types/template.ts`). `kind` mixes format and piece: `dvd` and `bluray` are inserts, `nfc-box` and `vhs` are tuck-end boxes, `floppy`, `nfc-card` and `nfc-sticker` are labels or cards.
- Dimensions are repeated per template. `wrap()` builds back | spine | front from `w, h, spine`. `tuckBox()` builds a box net from `w, h, d`. `GAME_CASE` holds per-platform sizes. Nothing says "this slipcover is that case plus clearance".
- Panels already have every id a slipcover and a box need: `front`, `back`, `spine`, `spineRight`, `glue`, `tuck`, `bottomTuck`, `top`, `bottom`, `dust*`. **No new panel ids.**
- Layers and designs are keyed by panel id (`front.image`, `spine.text`) and placed in percent, so a design for a DVD insert already applies to any template with a `front`.
- Branded dress is per template (`brandedLayers(template)`).
- The library is flat, one row per variant, grouped by media. Items store one `templateId`.
- 3D: `PreviewSpec` `box` maps panels to faces; `slab` is for cards and disks. Open ends and a case seen inside a sleeve don't exist.
- Export (imposition, Avery) places any template by its total size.

## 3. Proposed model

### 3.1 One source of truth for size: `CaseSpec`

A case spec per format and variant: `{ w, h, depth, … }` (for a card, `depth` is its thickness). Pieces derive from it:

| Piece | Size | Builder |
|---|---|---|
| Insert | exactly today's numbers, unchanged | existing builders |
| Slipcover | case + clearance on width, height and depth; adds `spineRight` + `glue` | new, built from `wrap()`'s row plus the two extra panels via `assemble()` |
| Box | case + clearance; depth from the case; tuck and dust flaps | existing `tuckBox()`, generalised |

Clearances are sourced and written to [case-research.md](case-research.md) first (decision 6). Where no published figure exists, the plan is an explicit stated assumption in the code and the UI ("measure yours"), not a silent guess.

Self-print constraints matter more than for inserts, since people print on card:
- Card thickness eats clearance. Offer a **card thickness** setting (default ~0.3 mm), or at least fold the allowance into the clearance.
- A slipcover or box is larger than an insert and may not fit A4 or Letter. The export and print-sheet preview show an informational message that the template needs a larger printer or paper size (decision 11). No splitting or scaling: the print dialog handles that.

### 3.2 Template identity

Add `piece: 'insert' | 'slipcover' | 'box'` to `TemplateConfig`.

- Inserts keep today's ids (`dvd-std-14`, `game-case-ps1`). Saves, share links, goldens and the frozen default-layer snapshot stay valid.
- Others get a suffix: `dvd-std-14~slipcover`, `game-case-ps1~box`. `isTemplateId`, `upgradeTemplateId` and `buildTemplateById` learn the suffix. Built lazily from `CaseSpec` and cached, so nothing is hand-listed.
- Templates that are already boxes (`vhs`, `nfc-box`) become the `box` piece of their case rather than being renamed. Existing ids keep resolving, so nothing is migrated. Example: `nfc-box-card` is the box piece of the NFC card.
- The NFC Card Wallet is a folded wallet, not a slipcover. Keep it as it is, and fix the README wording that calls it a slip cover.
- Cases with no insert-shaped template (VHS, NFC box) have no insert, so the Insert button is disabled for them (decision 9).

### 3.3 Layers, designs and Branded per piece

- Every piece gets the existing default layers from its panels (`${panelId}.fill / image / border / logo / code / text`). The layer format doesn't change.
- New templates add new snapshot rows. Existing rows are untouched, so `DEFAULTS_VERSION` doesn't change.
- **Keep-but-hide (decision 8).** Per-item diffs and design diffs refer to layer ids. When the active piece has no such panel, the layer is kept in the stored data and not drawn, listed, or counted, and it reappears if you switch back. This needs one rule in layer resolution (skip diffs whose target panel is absent) and tests for round trips: insert → slipcover → insert gives byte-identical layers.
- **Two spines (decision 10).** A slipcover or box has `spine` and `spineRight`. The right spine mirrors the left one's layers by default (text, image, Branded cap). Implementation: `spineRight.*` default layers `follow` the matching `spine.*` layers, as dust flaps already follow their panel, until the user edits them. Mirroring a vertical spine title is a plain copy, not a flip, so both read the same way round the case.
- **Different shape, same design.** Percent placement and Fill / Fit mean artwork re-flows to the new panel proportions. An image set to Fill crops differently, which is expected and what the focus point is for.
- **Branded:** on by default for every piece (decision 3), same folder and eye as now. The dress is built per template (`brandedLayers(template)`), so each new piece needs its dress generated from the same sink code for its panels: banner and marks on `front`, cap on `spine` (and `spineRight` when mirrored), the format mark on `back`. This needs checking by eye per platform, since a banner sized for an insert may crowd a box front.
- Glue tabs, tuck flaps and dust flaps stay "Folds away" and non-designable.

### 3.4 UI: pick the case, then the piece

```
Library:   Games | Movies & TV | Music | Labels, cards & NFC     (unchanged: one row per case)
Selected:  PS1
           Piece:  ( Insert ) ( Slipcover ) ( Box )
```

- The piece switch sits in `CaseBar` / `TemplatePickerModal` beside the case name. A button for a piece the case doesn't support is disabled with a tooltip saying why (decision 9). Today that is stickers (no slipcover, no box) and any case without an insert.
- Switching piece keeps the item, its design and its images (decision 8). The 2D view re-lays out, and only the panels that exist are shown.
- The queue shows `PS1 · Slipcover`. `short` and `detail` in `LibraryEntry` gain the piece. The "last picked per media type" memory remembers case and piece.

### 3.5 3D preview and export

- **Slipcover:** a `box` preview with no `+y` / `-y` faces and a visible open end. Optionally show the case inside. This is the one new `PreviewSpec` feature.
- **Box:** exists. **Insert:** exists.
- Export needs no new paths beyond the larger-printer message.

## 4. Case coverage

Every case gets Insert, Slipcover and Box. Worth sanity-checking because a few are odd:

| Case | Insert | Slipcover | Box | Notes |
|---|---|---|---|---|
| DVD, Blu-ray, UHD, game cases, PS1 jewel, CD | exists | new | new | standard |
| Cassette | exists | new | new | small; 3 pieces at tiny sizes |
| VHS | none today (button disabled) | new | exists | |
| Vinyl 7 / 10 / 12" | exists (sleeve) | new | new | large; exceeds A4 |
| Floppy | label exists | new | new | label is the "insert" |
| NFC card | card exists | new | exists (`nfc-box-card`) | |
| NFC sticker (25 / 30 / 35 mm) | sticker exists | disabled | disabled | decision 9 |

## 5. Phases

1. **Refactor, no behaviour change.** `piece`, `CaseSpec`, id suffix handling; tag every current template. Gate: all goldens and snapshots pass untouched.
2. **Keep-but-hide** rule in layer resolution, with round-trip tests. Can be done before any new piece exists, using test fixtures.
3. **Slipcover (#13).** Builder, open-ended 3D preview, goldens for representative cases, clearance research in `case-research.md`.
4. **Piece switch in the UI** (`CaseBar`, picker, queue labels, last-picked memory).
5. **Box for every case** (generalise `tuckBox` from `CaseSpec`, and fold existing `vhs` / `nfc-box` into it).
6. **Self-print polish:** card thickness and the larger-printer message.

Each phase adds goldens for its new templates plus a dimensions test (piece size = case size + clearance).

## 6. Risks

- **Unsourced dimensions** (decision 6 addresses it). Suppliers differ by 1–2 mm even for inserts.
- **Template count:** ~100 cases × 3 pieces. Lazy building keeps the code small, but goldens have to be sampled, not exhaustive.
- **Keep-but-hide** touches layer resolution, where designs and diffs are most fragile. The round-trip tests are not optional.
- **Large pieces on small paper:** vinyl slipcovers and boxes don't fit A4 / Letter at all. The message tells the user; nothing else is done.
- **Branded on pieces it wasn't drawn for:** the dress must be checked per platform on slipcover and box, since it stays on by default.
- **3D "case inside"** is the only real new rendering work. A plain open sleeve is an acceptable first version.

## 7. Open questions

None outstanding. Two details to settle when building, neither blocking:
- The exact wording and placement of the larger-printer message (export modal and print-sheet preview).
- Whether the card-thickness setting is a user control or just folded into the sourced clearance.
