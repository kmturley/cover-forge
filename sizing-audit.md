# Sizing and positioning audit

What every part of the app measures against, where each size is set, and how good the reference data is. Written to give
accuracy a solid base before more visual fixes. Measured on `feature/realistic-cases` at 6862868.

## Summary

| Area | Verdict |
| :--- | :--- |
| Layer placement (2D) | Consistent: every layer is a percentage of the panel's **trim**. But layers that paint into the bleed get boxes outside 0–100 %, and the editor draws those boxes. |
| Brand dress | Positioned from the **trim**, as fractions that mix the panel's width, height and spine length. Five separate mechanisms convert those fractions back to mm when a panel isn't the reference size. |
| 3D textures | Correct: UVs sample the trim; no face stretches its art (checked all 127 templates and pieces). |
| 3D shapes | Two models. The jewel case is built at the **case's** real outside size; every other case is the **paper insert** wrapped round a box, so it is smaller than the real case. |
| Case sizes | Set in several places: the jewel case's 142 × 125 × 10 in two files, and case outsides that only slipcovers and boxes use. |
| Reference scans | The weakest link: the image's edges are assumed to be the trim, its DPI tag is trusted, and fold lines are estimated from the app's own sizes when not found. Half the "measurements" are partly circular. **Since fixed (step 1):** sizes come from the standard, and scans are stretched to it and used for branding only. |
| Export | Correct: the page is the template, bleed included. |

The biggest risk isn't the drawing code, which mostly agrees with itself. It's that the numbers going in (from scans) and
checking the result (the app's own render, measured by the same tool) aren't reliable. So "matches the measurements" has
meant "matches numbers that may be wrong."

## 1. The PS1 screenshot

Nothing in the PS1 branding is cut off. Measured from the app's PS1 front:

- The strip is 18.6 mm wide, which is 15.5 % of the 120 mm front, as defined. Every mark (PS symbol, wordmark, ®, Sony)
  sits inside the trim.
- The strip's fill also paints the 3 mm bleed on the top, left and bottom. Its layer box is
  `x: -2.51 % … 84.5 % from the right`, `y: -2.5 % … -2.5 %`, so the selection handles sit 3 mm outside the visible strip.
- The 2D view clears everything outside the cut lines (`CanvasRenderer.ts:25`), so what you see is the trimmed piece, but
  the box drawn round it is the paint area.

The cause is real, though: the editor shows the trim but outlines the paint area. Any layer that runs into the bleed (side
strips, header bands, spine fills, the cover picture, whose placement ends at `-2.5 %`) looks cropped.

## 2. Coordinate frames in use

| System | Frame | Units | Where |
| :--- | :--- | :--- | :--- |
| Template panels | Canvas, from the top-left of the sheet (bleed margin included); each panel is its trim rect | mm | `types/template.ts` `PanelRect` |
| Paint area | Trim plus bleed on cut edges, none on folds | mm | `templates/geometry.ts:31` `paintRect` |
| Layer placement | Percent of the panel's trim width and height; may go below 0 or over 100 into the bleed | % | `engine/layers/placement.ts`, `engine/box.ts` |
| Auto-filled picture | Sized to the trim; its edge pixels are stretched across the bleed | mm | `engine/placement.ts:33`, `engine/layers/draw.ts:176` |
| Brand dress | Fractions from the trim corner: band `w`/`h` of panel W/H; front marks `h` of H, `inset` and `dx` of W, `cy` of H; strip and spine marks `from`/`to` of length, `across`/`dx` of width | fraction | `engine/official.ts` (25 platforms, 55 marks) |
| Brand fills | Run from the trim out into the bleed | px | `engine/branding.ts:296`, `:516` |
| 3D textures | UVs over each panel's trim | 0–1 | `three/PreviewGeometry.ts:16` |
| 3D model size | The insert's own panels (front width × height × spine); the jewel case uses its outside size | mm | `preview` in `templates/definitions.ts` |
| 2D measurements | Trim | mm | `engine/MeasurementOverlay.ts` |
| PDF and raster export | The whole canvas, bleed included | mm | `export/pdfExport.ts:76` |
| Scan measuring | The image's edges taken as the trim; mm from the image's DPI tag | mm, % | `scripts/measure-covers.ts:4` |

**Takeaways:**

- Trim is the de facto frame everywhere except the scan measuring script, which can't know whether an image has bleed and
  assumes none.
- Fractions mix axes. A front mark's height is a share of the panel's height while its inset is a share of the width, so
  on a panel of another shape the mark moves and resizes unevenly. That is why these compensations exist:
  - `pinned` and `turnedFrom` (`branding.ts:252`);
  - `keepSize` (`branding.ts:272`);
  - `tiedMarks` (`official.ts:679`);
  - `fitted` for spines (`official.ts:636`);
  - the strip's `keep()` (`branding.ts:423`).

  Each fixes one case (a taller front, a narrower one, a turned panel, a longer spine). Storing marks in mm from the trim
  corner would make all five unnecessary.

## 3. Where sizes are set

| Size | Set in | Also in | Problem |
| :--- | :--- | :--- | :--- |
| Jewel case outside 142 × 125 × 10 | `definitions.ts:281` `JEWEL_CASE` | `pieces.ts:75` `JEWEL` | Duplicated |
| Jewel case parts (base 122.8, hinge 12, tray, well, tabs) | `three/JewelCase.tsx` `CASE` | none | 3D only; the 2D template doesn't know them (for example the booklet's 3 mm margin is set separately as `bookletMarginMm`) |
| Tray card's side walls | `definitions.ts:339` `sideWallMm: (142 − 137) / 2` | none | Derived from the card, not the case |
| Case outsides (DVD 135 × 190, Blu-ray 135 × 171, DS 136 × 124 × 19, …) | `pieces.ts:39` `GAME_OUTER` | `case-research.md` (prose) | Used for slipcovers and boxes only; the 3D insert preview ignores them |
| Insert sizes and spines | `definitions.ts` (`GAME_CASE`, `DVD`, `BLURAY`, …) | `case-research.md` | Two copies kept in sync by hand |
| MiniDisc, 8 cm slim, cassette, Betamax and card-box shells | `definitions.ts:355–496` | none | One-off constants, each with its own shape |
| Brand marks | `official.ts` | `branding-spec.md` (generated from scans) | Tuned by hand toward the scans, never checked against them automatically |

**3D size versus the real case** (all cases except the jewel case model the paper):

| Case | 3D model | Real case outside | Difference |
| :--- | :--- | :--- | :--- |
| DVD (PS2, Wii, Xbox, …) | 129.5 × 183 × 14 | 135 × 190 × 14 | −5.5 × −7 |
| Blu-ray (PS3/4/5) | 129.5 × 149/161 × 14 | 135 × 171 | −5.5 × −10/−22 |
| Xbox One / Series | 128 × 149 × 11 | 135 × 170 | −7 × −21 |
| Switch | 99 × 161 × 10 | 105 × 170 | −6 × −9 |
| DS / GB / GBC / GBA | 130 × 116 × 16 | 136 × 124 × 19 | −6 × −8 × −3 |
| 3DS | 130 × 116 × 12 | 136 × 124 × 12.5 | −6 × −8 × −0.5 |
| PS Vita | 99 × 125 × 9 | 105 × 135 × 11 | −6 × −10 × −2 |

This is the "2D sized correctly, 3D not" you've seen. The 3D shows the insert as if it were the case. The case's plastic
border, and the insert sitting inside it, are missing.

## 4. Reference data quality

From `scans-report.md` and `branding-spec.md` (89 images over 23 platforms):

- **Fold lines estimated in 43 of 89 images.** When no fold is found, the script places it using the app's own spine
  width and assumes the front and back are equal width. The app then agrees with those rows because it supplied the
  numbers. DS and Wii show `+0.0` everywhere for that reason.
- **The DPI tag is trusted.** Every image tagged at a DPI other than 300 is rejected, but those that claim 300 aren't
  checked:
  - Xbox 360: two of three scans come out at about 363 × 242 mm against a real 273 × 182, so they were scanned at about
    400 DPI.
  - Switch 2: one scan is 209 mm wide and two are 243 mm, for the same insert.
  - Those platforms' Mode rows are then 30–45 mm off, and the app looks "wrong" by that much.
- **Bleed is never declared.** The script assumes the image edge is the trim. A fan template that includes bleed, or a
  scan cropped inside the trim, shifts every percentage. Xbox Series X scans are 156 mm tall against a 148 mm template.
- **PS1 scans don't agree.**
  - The strip measures 6.8 %, 16.2 %, 9.7 % and 15.8 % of the front width; the "Mode" of 12.8 % is the median of
    disagreeing values.
  - The scans are 117.2–117.9 mm tall when the tray card is 118 and the booklet 120.
- **The app's own render is mismeasured.** The comparison reports the app's PS1 strip as 10.8 % when it draws 15.5 %. The
  render has a near-black page background (#111) under a black strip, and an empty band under the shorter tray card,
  which the edge detection misreads. So `app − Mode` can't be trusted in either direction.
- **The summary statistic is weak.** "Mode, else median" over 3–4 images, one of them a fan template, includes outliers
  rather than rejecting them.

## 5. Checked and fine

- 3D faces match their panels in all 127 templates and pieces: no art is stretched.
- Every layer, brand mark and auto-filled picture measures from the same trim rect.
- The cover picture is fitted to the trim, so cover art (which has no bleed) is never cropped by the bleed.
- 2D measurement labels show trim sizes.
- Export includes the bleed; sheet layouts cap it at half the gap to the next label.

## 6. Recommended order of fixes

1. **Use the references only for what they're good at.** *(done)*

   This turned out to be a wrong assumption in its own right: the scans were being used to measure insert sizes, spines
   and folds, which scanners, crops, rotation and re-saves all change. Now:
   - **Sizes come from the documented standard.** Each case's template (sourced in `case-research.md`) gives the
     insert's size, spine and fold positions. Nothing measures them from a scan any more.
   - **Every scan is stretched to its standard size**, so its folds land where the standard puts them. Wrong DPI tags,
     rescans and rescaling stop mattering: for example, the two Xbox 360 scans tagged 300 DPI but scanned at about 400
     now agree with the rest, 4 out of 4.
   - **Scans measure only what is printed:** where the band, strip, logos and spine cap sit, and their colours, as
     shares of each panel.
   - **A scan whose proportions are more than 3 % off the standard is listed but not counted.** It is cropped,
     includes a border or bleed, is another edition, or isn't a full wrap. Currently flagged: 2 PS1 scans (+3.2 %) and
     all 3 Xbox Series X scans (−5 %).
   - **The summary is a consensus:** the median of the largest group agreeing within 1 point, shown as
     `value (agree/counted)`, and `—` when fewer than two agree.
   - `scripts/scan-manifest.json` records, per scan, bleed to crop off before stretching or a reason to leave it out.
     It is committed even though `scans/` isn't, and stays empty until a scan has been checked.
   - The app's comparison render is mid grey where nothing is printed. Its PS1 strip measures 15.4 % (it was misread
     as 10.8 %) against a consensus of 15.5 %.

   **Open questions:**
   - **Xbox Series X:** all three scans are 266 × 156 mm in proportion, against the app's 266 × 149. Is the real
     insert taller, or do the scans include something extra?
   - **The larger `app − Consensus` gaps in `branding-spec.md`** (for example the Wii, Xbox 360 and NES spine logos,
     and the GBC front logo) are candidates for step 3. Some are detection quirks, such as a tab on the right being
     reported as a band.

2. **One case spec per physical case.** *(done)*

   [`src/templates/cases.ts`](src/templates/cases.ts) now holds every physical size, each with its `case-research.md`
   section:
   - each case's real outside (DVD, Blu-ray, Xbox One, Switch, DS, 3DS, Vita and jewel shells);
   - each printed insert and its spines (DVD, Blu-ray and UHD variants, every game platform);
   - the jewel case's booklet, tray card, walls and moulded parts;
   - MiniDisc, 8 cm CD, cassette, VHS, Betamax, card box, vinyl, floppy, CR80 and NFC sizes.

   It replaced these copies:
   - `definitions.ts`: `JEWEL_CASE`, `GAME_CASE` sizes, the DVD/Blu-ray/UHD spine tables and the one-off constants;
   - `pieces.ts`: `JEWEL`, `DVD_CASE`, `TALL_CASE` and `GAME_OUTER` (its insert margin is now worked out from the DVD
     case and insert);
   - `library.ts`: the `STANDARDS` table;
   - `official.ts`: `CASE_REF`, the branding's reference sizes;
   - `JewelCase.tsx`: its `CASE` part measurements.

   Every template, slipcover, box, case size, library name and branding reference size was checked byte-identical
   before and after. `cases.test.ts` adds fit tests: every insert fits inside its case, and the jewel case's booklet and
   tray card fit inside its lid, base and tray.

3. **Brand marks in mm from the trim corner.** *(done, with one change of approach)*

   The marks keep their numbers as shares of the platform's **own insert** (its `ref`, from `cases.ts`), not mm
   literals. Those shares are exactly what `branding-spec.md` now measures, on scans fitted to the standard size, so
   each number can be checked against the consensus directly. They become mm in one place:
   - `dressFrame` in `branding.ts` says what the shares are taken of: the own insert's width always, and its height
     unless the panel is shorter (then it shrinks to fit). A turned panel uses its portrait size.
   - Marks anchor to the edge they belong to: left, right or centred across; a foot band and its marks from the bottom;
     strip marks with the top, bottom or middle. A ® or ™ stays against its logo.
   - `pinned`, `keepSize`, `tiedMarks`, the turned-panel adjustments in `drawFrontMark` and the strip's own pinning are
     gone. The strip's anchoring and the tag rule remain, as plain rules in that frame.
   - The spine keeps its single fit rule, `pinnedSpine` (with `fitted` for narrower spines).

   **Result:**
   - Every platform's own case, every turned-panel render and the 3DS-on-jewel dress are pixel-identical to before.
   - Six golden images changed, all wider panels where the dress used to stretch a little with the width: PS1 and
     Switch slipcovers and boxes, and the SNES dress on a DVD case and box. It now keeps its own case's mm.
   - `dressFrame.test.ts` pins down the rule.
   - Format logos (DVD, Blu-ray, CD) have no `ref` yet, so they still follow the panel. Giving them one is a small
     follow-up, but it would change the DVD slim's own spine, so it needs a look first.

4. **Editor: show the trim and the bleed honestly.** *(done)*
   - **A Bleed toggle in the 2D view** (beside Guides and Measurements). It shows the bleed round each piece, dimmed, so
     you can see what is printed past the cut line. Off by default, and never in the 3D texture or exports.
   - **Selection outlines at the trim.** A layer that runs into the bleed (a side strip, a header band, the cover
     picture) is outlined solid where the trimmed piece ends; the rest of its box, where the handles are, is faint and
     dashed. Selecting the PS1 strip no longer looks like it is cut off.
   - Tests: `LayerOverlay.test.ts` for the outline, and a golden of the dimmed-bleed view (`view/dim-outside-cut`).
   - **Not done: keeping layer placements inside 0–100 % of the trim**, with bleed overflow as its own setting. A
     layer reaching into the bleed (−2.5 %) is correct for full-bleed elements, and with the outline now explaining it,
     changing the saved format isn't worth the migration.

5. **3D: model the case, not the paper.** *(done)*
   - Every game case with a known outside, and the DVD, Blu-ray and 4K UHD cases, are drawn at the `cases.ts` outside,
     with the insert inside at its own size: the front and back from the spine edge, the spine centred down its edge,
     the case's plastic showing round the rest, the glossy print standing in for the clear sleeve.
   - Inserts much shorter than their case stand 3.5 mm above the bottom under the case's own top: the clear PS3 case
     with its moulded Blu-ray logo, the blue Blu-ray case likewise, the black UHD case with its 4K Ultra HD logo, the
     Xbox One's green top with its printed logo. There the band is the case's, so that case's insert leaves out the
     printed band and spine cap (`headerOnCase`); the dress on any other case, slipcover or box still prints it.
   - The Xbox Series insert is the newer case's taller one, 129.5 × 161 (case-research.md §5). The 3DS case is white.
   - The 3D measurements span the insert where it sits. Still open: the jewel case shows none (built from parts), and
     the NES and SNES boxes have no case size, so they stay at the print's size.
6. **Tolerance tests.** *(partly done)*
   - Fit tests (`cases.test.ts`): every case drawn in 3D at its real outside, the insert narrower than it and inside
     its height, the spine no wider than its depth; and the jewel case's booklet and tray card inside its parts.
   - `npm run check:dress`: the dress on every case × dress (about 3,000), flagging marks that overlap, run off their
     panel, cross a spine cap's edge or run into the title; `--against <ref>` lists every combination that changed.
     It finds 2 today: the Xbox Series plate runs off the 25 and 30 mm NFC stickers.
   - Not done: tests against the scans' consensus with a tolerance per field. The scans proved too uneven (crops,
     recreations, case generations) to fail a build on; they stay a report.

The PS1 jewel case is a good pilot for 2–6: its case spec is mostly measured already (section 3), and it has the most
recent references.
