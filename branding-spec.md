# Branding spec: front headers and spines

What the official ("Branded") trade dress looks like on each platform's cover, precisely enough to draw it. It
replaces the earlier table, which gave every platform the same kind of full-width top band. Real covers use several
different shapes: full-width bands, bands with a curved or sloped lower edge, corner tabs, L-shapes, vertical strips,
and no header at all.

**Scope.** The app supports **US releases only**. Where US and other regions differ (PS1, PS2, GameCube), implement the
US design. The PAL and NTSC notes below are reference only.

## How to read this

**Units.** Front sizes are fractions of the **front panel's trim size**; spine sizes are fractions of the spine:

- `H`: front panel height
- `W`: front panel width
- `L`: spine length (the same as `H` on keepcases)
- `S`: spine width

For example, `10% H` on a 160 mm-tall PS4 front is 16 mm. Colours are sRGB hex.

**Confidence.** Each value is marked with how it was obtained:

| Mark | Meaning |
| :--- | :--- |
| **W**, measured on a wrap | Measured in pixels on a full wrap (back, spine and front) in `cover-art/`, ±0.5%. These are the most reliable. Some wraps are fan-made, but they follow the retail pattern. |
| **F**, measured on a front | Measured on a retail front cover from Wikipedia, ±0.5% H. |
| **R**, reported | Stated in press coverage of the design, with sources below. Not measured. |
| **U**, unverified | From general knowledge; check it against a physical case before relying on it. |

Colours come from scanned JPEGs, so they vary by ±10 per channel between scans. Where an official brand colour exists,
use it; it is marked "official".

**Logos.** Simple Icons (our `src/brands`) has the PlayStation family: `playstation` (the PS symbol), `playstation2`,
`playstation3`, `playstation4`, `playstation5`, `playstationportable`, `playstationvita`. It has no Nintendo, Xbox,
Games for Windows or Blu-ray marks, because those owners don't allow it. For those, draw the wordmark as text and treat
it as an approximation.

**Rotation.** Spine wordmarks on every platform measured here are **rotated 90° clockwise, reading top-to-bottom**, the
same way as the spine title.

---

## Summary

| Platform | Era | Front header | Front size | Spine top | Spine length | Conf. |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PS1 | 1995–2000 | black vertical strip, left | 15.5% W | – (jewel case) | – | F |
| PS2 | 2000–2013 | black top band | 8.7–9.5% H | PS symbol in a white square, then "PlayStation 2" on black | black, full length | W, F |
| PS3 | 2006–2009 | black vertical strip, left | 10% W | "PLAYSTATION 3" | – | F |
| PS3 | 2009–2017 | black band fading to grey, crimson line | 8.3% H + 0.4% line | black cap with "PS3" | 16.5% L | W, F |
| PS4 | 2013–2021 | blue gradient band, white line | 10.3% H + 0.6% line | blue cap: PS symbol, "PS4" | 23% L | W, F |
| PS5 | 2020– | white band, **navy line** | 11.1% H + 0.6% line | white cap: PS symbol, "PS5" | 23% L | W, F |
| PS Vita | 2011–2019 | blue gradient band, white line | 7.5% H | blue cap | – | F, U |
| N64 | 1996–2002 | red L: top band + left block | 16.3% H band | red, "NINTENDO 64" | full length | W |
| GameCube | 2001–2007 | black band, sloped lower edge, white line | 11.2% H at left → 7.2% H at right | black cap: cube icon, "NINTENDO GAMECUBE" | 17.5% L | W, F |
| Wii | 2006–2013 | white header deepening to the right, grey line | 1.7% H at left → 12.2% H at right | white; grey "Wii" | white, full length | W, F |
| Wii U | 2012–2017 | cyan band, convex edge, yellow-green line | 3.5% H at the edges, 9.5% H in the centre | white; "Wii U" | white, full length | W, F |
| Switch | 2017– | red corner tab, top-left | 22.4% W × 12.5–13.4% H | red; Joy-Con icon | red, full length | W, F |
| Switch 2 | 2025– | red band, full width | 12.9% H | red; icon + "2" | red, full length (third-party) | W, R |
| Xbox | 2001–2008 | black band, orb right, LIVE strip | 10% H (+4% strip) | black cap: X, "XBOX", "ONLINE ENABLED" | ≈17% L | W, F |
| Xbox 360 | 2005–2016 | white band, green swoosh right | 12.1% H | white cap: orb, "XBOX 360" | ≈25% L | W, F |
| Xbox One | 2013–2021 | green band, centred logo | 8% H | black: sphere, "XBOX ONE" | full length | F, W |
| Xbox Series X\|S | 2020–21 | green band + black "Optimized" strip | ≈8% H | – | – | R |
| Xbox | 2021–2024 | none; white box top-left listing the systems | – | green square | – | R |
| Xbox Series X\|S | 2024– | green block over the spine top and front top-left, diagonal edge | 8.8% H | green block top, then black: sphere, "XBOX" | 8.8% L green | W |
| PC (Games for Windows) | 2006–2013 | white bevelled band | 11% H | – | – | F |
| DVD, Blu-ray, CD, VHS, cassette, vinyl | – | no front header (Blu-ray film: blue band, U) | – | format logo small, on the spine or back | – | U |

---

## PlayStation

### PS1 (F), measured on *Crash Bandicoot* and *Spyro*; CD jewel case
- A black strip down the **left** edge, **15.5% W** wide, full height.
- At its top: the four-colour PS symbol, centred, about 80% of the strip width.
- Below it: "PlayStation" in white, **rotated −90° (reads bottom-to-top)**, about 55% H long.
- The ESRB box sits at the bottom of the strip.

### PS2 (W, F), measured on *GTA: San Andreas*, *Jak and Daxter* and *Ratchet & Clank*
- **Front:** a full-width black band at the top, **8.7–9.5% H**, colour `#000000`–`#10131A`.
  - Left: "PlayStation®2" in white, inset **2% W**, cap height about **3.5% H**, vertically centred.
  - Right: the four-colour PS symbol, inset **2% W**, about **6% H** tall.
  - An "NTSC U/C" or "PAL" tag sits below the band on the right.
- **Spine:** black along its full length.
  - At the top: the four-colour PS symbol on a **white square** filling the spine width, at 0.6–6.7% L.
  - Below it: "PlayStation 2" in white, rotated 90° clockwise, at about 7–25% L.
  - The title follows, then the product code at the bottom.

### PS3, first era (2006–2009) (F), measured on *Warhawk*
- **Front:** a black strip down the left edge, **10% W** wide, full height.
  - "PLAYSTATION 3" in silver, in the "Spider-Man" typeface (`playstation3` mark), rotated −90° (reads bottom-to-top),
    about 80% H long.
  - A small PS symbol on a white square at the top of the strip.
  - Optional: a thin black band, 3% H, across the top of the artwork with "PlayStation Network".

### PS3, second era (2009–2017) (W, F), measured on *Madden NFL 25*, *Grease Dance* and *Bakugan*
- **Front:** a full-width band at the top, **8.3% H**.
  - Black from the left to about **60% W**, then a horizontal gradient to grey **`#888888`** at the right edge.
  - Under it, a **crimson line 0.4% H** (`#8D1214`, and about `#B0102A` on other scans).
  - Left: the PS symbol followed by the "PS3" wordmark, white, inset **3.5% W**, about **4.5% H** tall.
  - Right, optional: the PlayStation Network logo in white, or a PlayStation Move or "Only on PlayStation" tab.
- **Spine:** a **black cap from the top to 16.5% L**, holding "PS3" in white, rotated 90° clockwise, at about 2–14% L.
  Below it, the title on **white**, or on the artwork.
- **Back:** the same black-to-grey band with the crimson line, holding the PSN logo.

### PS4 (W, F), measured on *Resident Evil Origins Collection* and *Worms Battlegrounds*
- **Front:** a full-width band at the top, **10.3% H**.
  - A horizontal gradient from `#0271B8`/`#003CA5` at the left to `#048FD2` at the right, with a lighter highlight at
    about 85% W. The scans vary.
  - Under it, a **white line 0.6% H**.
  - Left: the PS symbol followed by "PS4" (`playstation4` mark), white, inset **2.5% W**, about **5.5% H** tall.
- **Spine:** a **blue cap from the top to 23% L**, the same blue as the band, closed by a white line of 0.6% L.
  - At the top: the white PS symbol, horizontal and not rotated, about 60% of the spine width, at 2–6% L.
  - Below it: "PS4" in white, rotated 90° clockwise, at about 8–21% L.
  - Then the title, rotated 90° clockwise, on the artwork or a solid colour. The product code sits at the bottom.

### PS5 (W, F), measured on *Black Myth: Wukong* and *MotoGP 26*
- **Front:** a full-width band at the top, **11.1% H**, white `#FFFFFF`.
  - Under it, a **navy line 0.6% H**, `#1B3A70`. This corrects the earlier spec, which dropped the line.
  - Left: the PS symbol followed by "PS5" (`playstation5` mark), **black**, inset **2.5% W**, about **5.5% H** tall.
- **Spine:** a **white cap from the top to 23% L**.
  - The black PS symbol, horizontal, at about 3–6% L.
  - "PS5" in black, rotated 90° clockwise, at about 8–19% L.
  - Then the title, as on PS4.

### PS Vita (F), measured on *LittleBigPlanet PS Vita*
- **Front:** a full-width band at the top, **7.5% H**, gradient `#075DAA` → `#1B8DCC`, with a white line of 0.5% H
  under it.
  - Left: the PS symbol followed by "PS VITA", white, inset 2% W, about 4% H tall.
  - Right, optional: the PlayStation Network logo.
- **Spine (U):** a blue cap with the PS Vita mark, laid out like PS4.

## Nintendo

### N64 (W), measured on *Mario Party 3*; this is a cardboard box, not a keepcase
- **Front:** a red **L-shape**, Nintendo red about `#E80002`.
  - A full-width band at the top, **16.3% H**, holding "NINTENDO⁶⁴" in bold white italic caps, centred, about 6% H
    tall.
  - It joins a red block down the left side, about 16% W wide, reaching about 30% H.
  - Top right: the four-colour N64 cube logo on a white square, about 12% W, with an "Only For" white corner flash
    beneath it.
- **Spine:** red, with "NINTENDO⁶⁴" in white, rotated 90° clockwise, at about 3–26% L. Then the title on the artwork.
- **Back:** a red band along the bottom, about 18% H, holding the seal, the N64 logo and the rating.
- There is no N64 template yet. It would be a new box format.

### GameCube (W, F), measured on *Super Smash Bros. Melee* (PAL), *Super Mario Sunshine* and *Pikmin*
- **Front:** a full-width black band at the top.
  - Its lower edge **slopes**: about **11.2% H** at the left and middle, and **7.2% H** at the right edge.
  - A **white line 0.5% H** runs along the lower edge.
  - **Centred:** the indigo cube icon, then "NINTENDO" (small, widely spaced) above "GAMECUBE" (bold), in white. Total
    height about **6% H**.
  - Top left: an "ONLY FOR" flash, about 14% W, overlapping the band. It's an indigo roundel on PAL covers and a blue
    triangle on NTSC ones.
- **Spine:** a **black cap from the top to 17.5% L**.
  - The indigo cube icon, horizontal, at 5–9% L.
  - "NINTENDO GAMECUBE" in white, rotated 90° clockwise, below it.
  - The rest of the spine is dark, with the title in white.

### Wii (W, F), measured on *Disney Universe* and *Wii Sports*
- **Front:** a white header whose lower edge is a curve.
  - It's about **1.7% H** deep at the left and deepens to **12.2% H** at the right.
  - A **grey line 0.5% H** (`#A5A5A6`) runs along the curve.
  - The grey "Wii" wordmark (≈ `#8C8C8C`) sits right-aligned in the deep part, inset **3% W**, about **7% H** tall.
  - This is standard on third-party covers too, not a first-party exception.
- **Spine:** **white along its full length**. The grey "Wii" wordmark, rotated 90° clockwise, at about 3–12% L. The title
  art follows.
- **Back:** a small white tab top-right, with the Wii Remote icon.

### Wii U (W, F), measured on *Rayman Legends* and *Project Zero: Maiden of Black Water*
- **Front:** a full-width cyan band with a **convex lower edge**: **3.5% H** deep at the left and right edges, **9.5% H**
  in the centre, a single arc.
  - A **yellow-green line 0.5% H** (`#E7F237`) follows the curve.
  - The scans disagree on the colour: `#01D2E3` (NTSC) and `#0099C2` (PAL). The official Wii U blue is `#009AC7`.
  - The "Wii U" wordmark in white, **centred horizontally**, about 4.5% H tall, in the upper 6% H.
  - Optional: a Nintendo Network badge top-right, on white.
- **Spine:** **white along its full length**. The "Wii U" wordmark, grey "Wii" with a cyan "U" box, rotated 90°
  clockwise, at about 3–15% L. A small game icon follows, then the title logo.

### Switch (W, F), measured on *Super Mario Party Jamboree* and *Nerf Legends*
- **Front:** no full-width band. The artwork runs full bleed, with a red **corner tab** at the top left.
  - The tab is **22.4% W × 12.5–13.4% H**, flush with the top and left trims, square corners, **`#E60012`** (official
    Nintendo red).
  - Inside it: the white Joy-Con icon, about **5% H** tall, centred horizontally, in the upper part.
  - Under the icon: "NINTENDO" (small, spaced) over "SWITCH" (bold), in white, centred, about 3.5% H in total.
- **Spine:** 10 mm × 161 mm, **red along its full length**.
  - Top: the white Joy-Con icon, horizontal, at about 2–4.5% L.
  - Title in white, rotated 90° clockwise, starting at about 8% L.
  - Bottom: a white rounded "Nintendo" pill, rotated, or the publisher logo.
- **Back:** a red frame around the back artwork, carrying the rating and legal panels.

### Switch 2 (W, R), measured on *Pac-Man World 2 Re-Pac*
- **Front:** a **full-width red band** at the top, **12.9% H**, `#E60012`.
  - **Centred:** the Joy-Con icon with a "2" beside it, over "NINTENDO SWITCH", in white, about 9% H in total.
- **Spine:** this third-party cover is **red along its full length**, with the icon and "2" stacked at 0–10% L and the
  title in white, rotated 90° clockwise.
  - Press coverage says **first-party Nintendo Switch 2 covers wrap the front artwork round the spine** instead, with
    the title in white on the upper half (R).
  - So offer both: a red spine and wrapped art.
- **Case:** the plastic is tinted red (R).

## Xbox

### Xbox (original) (W, F), measured on *Sid Meier's Pirates!*, *MVP Baseball 2004* and *England International Football*
- **Front:** a full-width black band at the top, **10% H**.
  - Left of centre: the green "X" mark followed by the "XBOX" wordmark, light green (≈ `#9BC848`), starting about
    8% W in, about 5% H tall.
  - Top-right corner: a large glowing **green orb with an X**, about 25% W wide, cropped by the top and right trims.
  - Optional: an orange "LIVE | ONLINE ENABLED" strip under the band, **about 4% H**.
- **Spine:** a black cap to about **17% L**.
  - The green X, horizontal, at about 4.5–7% L.
  - "XBOX" in green, rotated 90° clockwise, below it.
  - Optional: an orange "ONLINE ENABLED" block beneath.
  - The rest is the artwork.

### Xbox 360 (W, F), measured on *NeverDead*, *Tetris Evolution* and *Supremacy MMA*
- **Front:** a full-width white band at the top, **12.1% H**, fading to light silver.
  - **Green ribbon swooshes** fill the band's right third, from about 67% W: lime `#D3E753` to green `#8EC645`/`#46A82D`.
  - Left: the Xbox 360 logo, a silver sphere with a green X followed by "XBOX" in green and "360" in grey. Inset
    about 5% W, the sphere about 7% H tall.
- **Spine:** a white cap to about **25% L**.
  - The sphere, horizontal, at about 2.5–6.5% L.
  - "XBOX 360" in grey and green, rotated 90° clockwise, below it.
  - Then the artwork or a solid colour with the title.

### Xbox One (2013–2021) (F, W)
- **Front (F), measured on *Street Outlaws: The List*:** a full-width band at the top, **8% H**, flat **`#107C10`** (the
  official Xbox green, measured exact). **Centred:** the white Xbox sphere followed by "XBOX ONE", about 3.5% H tall.
  - The *FIFA 18* wrap in `cover-art/` has no front band. It's probably a fan edit; retail covers carried the green
    band.
- **Spine (W), measured on *FIFA 18*:** **black along its full length**.
  - The white Xbox sphere, horizontal, at 2.4–6.4% L.
  - "XBOX ONE" in white, rotated 90° clockwise, at about 7–20% L.
  - Then the title.

### Xbox Series X|S
- **2020 to June 2021 (R):** as Xbox One, with "XBOX SERIES X" centred in the green band. A black "Optimized for Xbox
  Series X" strip sits under the band at the left.
- **June 2021 to about 2024 (R):**
  - No green band.
  - A **white box in the top-left corner** lists the compatible systems in black, e.g. "XBOX SERIES X | XBOX ONE".
  - The Series X logo sits on the artwork at the top right.
  - Edition names appear in a "racing stripe".
- **About 2024 onwards (W), measured on *Forza Horizon 6*:**
  - **No front band.** A green block (≈ `#4DAA14`, a lighter green than `#107C10`) covers **the spine's top 8.8%** and
    continues onto the front's top-left corner.
    - On the front it is **17% W wide at the top and 10% W at its lower edge**: a diagonal right edge, 8.8% H tall.
    - It holds the white Xbox sphere, about 6% H, on the front part.
  - "XBOX SERIES X" in black bold caps at the **top right** of the artwork, inset about 3% W, about 2% H tall.
  - **Spine:** the green block (0–8.8% L), then **black** below it, with the white sphere and "XBOX" rotated 90°
    clockwise at about 11–22% L, then the title. The rating and product code sit at the bottom.

## PC

### Games for Windows (2006–2013) (F), measured on *Microsoft Flight Simulator X*
- **Front:** a full-width band at the top, **11% H**, a vertical gradient from `#F2F2F0` to `#FBFBFB` with a soft
  bevelled lower edge.
  - Left: the Games for Windows logo, the four-colour Windows flag orb followed by "Games" over "for Windows" in blue
    (≈ `#3C6FB4`). Inset 2% W, about 7% H tall.
  - Right: "PC DVD" in grey, "PC" light and "DVD" bold, inset 2% W, about 3% H.
- **Other PC releases (U):** no standard band. A small "PC DVD-ROM" badge near the rating.

## Film and music formats (U)

- **Blu-ray film:** a blue band at the top, ≈ 8% H, with the white "Blu-ray Disc" logo centred. The spine has a blue
  cap with the BD logo. We have no licensed mark, so draw it as text.
- **DVD, VHS, CD, cassette, vinyl:** no front header. The format logo (DVD Video, Compact Disc) is small, on the spine
  or back only.
  - "Branded" should add only a spine cap and a back logo for these, not the front banner the code draws today.

---

## Cover art sizes

The printed cover art for US cases: the full wrap (back, spine and front) at trim size, without bleed. These are the
values in `definitions.ts`. Spine widths are the US case standards, and the front width is what the wrap leaves.

Every size below was cross-checked in a dedicated investigation, [`case-research.md`](case-research.md): for each
physical case, multiple independent sources (Wikipedia, case manufacturers, community references) were gathered with
links, and a mode was computed per dimension (width, height, depth) rather than trusting any single page. **None of
the sizes already in the codebase needed to change** — the investigation confirmed all of them, several more strongly
than before. The Confidence column below reflects how many independent sources back each row; see `case-research.md`
for the full source-by-source breakdown, including cases where sources disagree and why.

| Template | Full cover (mm) | Front W × H, spine (mm) | Confidence |
| :--- | :--- | :--- | :--- |
| DVD, PC | 273 × 183 | 129.5 × 183, 14 | Strong — 6 case sources and 3 insert sources agree |
| DVD Slim | 266 × 183 | 129.5 × 183, 7 | Strong on spine (unanimous across 6 sources); front size single-sourced at the insert level |
| Blu-ray | 267 × 149 | 128 × 149, 11 | Strong — same insert class as Xbox One (below); the case's outer spine genuinely varies (5–24 mm) across commercial products, but our 11 mm insert-level figure is confirmed by a manufacturer and a community source |
| CD, PS1 (jewel case) | 120 × 120 booklet | 120 × 120; 6.5 mm spine cards on the tray card | Strong on total size — front confirmed by 4 sources, back tray total width and height each confirmed by 2 of 3. **Low** on the 6.5/6.5 split specifically: real PS1 scans measured by `scripts/measure-covers.ts` consistently draw the flap nearest the front wider than the one nearest the back (see `case-research.md`) — not yet applied to the code, which still splits the tray card symmetrically |
| PS2, Xbox, Xbox 360, GameCube, Wii, Wii U | 273 × 183 | 129.5 × 183, 14 | Strong — same insert data as DVD above |
| PS3 | 273 × 149 | 129.5 × 149, 14 | Moderate — the case's *outer shell* may be shared with PS4/PS5 (see Sources), but 3 independent insert-level sources cluster tightly at 128–129.5 × 148–149.3, confirming this value specifically |
| Xbox One, Xbox Series X\|S | 267 × 149 | 128 × 149, 11 | Strong — 3 sources agree on width/height within 1 mm, unanimous on the 11 mm spine |
| PS4, PS5 | 273 × 161 | 129.5 × 161, 14 | Strong — a case manufacturer's insert-pocket spec (162 mm) and a community wiki (161 mm) agree |
| Switch, Switch 2 | 208 × 161 | 99 × 161, 10 | Strong on height and spine (2 sources, exact match); width single-sourced but consistent with the case exterior |
| PS Vita | 207 × 125 | 99 × 125, 9 | **Low** — one case source, one derived insert source; a dedicated further search found no second source for either |

Wii U, Switch and PS Vita aren't on the r/customcovers wiki reference list. Wii U uses the DVD-size case, and Switch
and PS Vita come from published full-wrap sizes (see Sources). Blu-ray Elite was removed; saves that used it now get
Blu-ray.

---

## How the renderer implements it

`src/engine/official.ts` holds the branding as data, one entry per game case (`GAME_CASE_BRANDING`) and per format
(`FORMAT_BRANDING`), drawn by `drawOfficial` when **Branded** is on:

- **Front shapes:** `band` (full width, with a lower edge from `flat`, `slope`, `arc` or `ease` and an optional edge
  line), `tab` (a corner block, with a diagonal edge when `wBottom` is set), `strip` (down the left edge) and `none`.
- **Fills:** a colour or a horizontal or vertical gradient.
- **Marks:** lockups of Simple Icons marks, text and drawn icons (Joy-Con, Xbox sphere, GameCube cube, Windows flag),
  side by side or stacked, with alignment, inset, height and rotation.
- **Spines:** a full-length `fill`, a `cap` with its own length and line, and marks placed along the spine. The title
  starts after them and switches to `titleColor` when the chosen colour would not show on the spine's fill.
- **Back:** small format logos for DVD, CD, VHS, cassette and vinyl, which have no front header.

Not done yet: era variants (PS3 2006, Xbox Series 2020 and 2021, a wrapped-art Switch 2 spine), N64, the Xbox LIVE strip,
four-colour PlayStation symbols, and the Nintendo pill at the bottom of Switch spines. Nintendo, Xbox and Games for
Windows marks are drawn approximations, since Simple Icons does not carry them.

---

## Sources

- **Full wraps (W):** `cover-art/*.jpg` in this repo: *Resident Evil Origins Collection* (PS4), *Black Myth: Wukong*
  (PS5), *Madden NFL 25* (PS3), *GTA: San Andreas* (PS2), *Super Mario Party
  Jamboree* (Switch), *Pac-Man World 2 Re-Pac* (Switch 2), *Disney Universe* (Wii), *Rayman Legends* (Wii U), *Super
  Smash Bros. Melee* (PAL GameCube), *Mario Party 3* (N64), *Sid Meier's Pirates!* (Xbox), *NeverDead* (Xbox 360),
  *FIFA 18* (Xbox One), *Forza Horizon 6* (Xbox Series X). Some are fan-made.
- **Retail fronts (F):** non-free files on Wikipedia, used for measurement only: *Crash Bandicoot*, *Spyro the Dragon*,
  *Jak and Daxter*, *Ratchet & Clank*, *Warhawk*, *Grease Dance*, *Bakugan: Defenders of the Core*, *Worms
  Battlegrounds*, *MotoGP 26*, *LittleBigPlanet PS Vita*, *Nerf Legends*, *Wii Sports*, *Project Zero: Maiden of Black
  Water*, *Super Mario Sunshine*, *Pikmin*, *MVP Baseball 2004*, *England International Football*, *Tetris Evolution*,
  *Supremacy MMA*, *Street Outlaws: The List*, *Microsoft Flight Simulator X*.
- [PS5 box design: Push Square](https://www.pushsquare.com/news/2020/07/heres_your_first_look_at_official_ps5_game_box_art)
  and [GameSpot](https://www.gamespot.com/articles/this-is-the-ps5-game-box-design/1100-6479531/)
- [PS3 box redesign: Kotaku](https://kotaku.com/and-the-ps3-box-redesigns-begin-5353069),
  [AList](https://www.alistdaily.com/media/ps3-box-art-changes-begin/)
- [Xbox 2021 box redesign: Game Informer](https://gameinformer.com/2021/06/15/xbox-game-cases-are-still-green-but-look-different),
  [Hypebeast](https://hypebeast.com/2021/6/xbox-series-x-s-one-game-box-art-changes),
  [Pure Xbox (2020 design)](https://www.purexbox.com/news/2020/07/take_a_closer_look_at_the_official_xbox_series_x_box_art),
  [ResetEra (spine square)](https://www.resetera.com/threads/did-xbox-change-their-physical-box-art-design-again-games-now-have-an-ugly-green-square-on-the-spine.674095/)
- [Switch 2 cases: Nintendo Life](https://www.nintendolife.com/news/2025/04/nintendo-appears-to-have-given-its-game-cases-a-makeover-on-switch-2),
  [Game Rant](https://gamerant.com/nintendo-switch-2-game-cases-spines-change/)
- [Wii U box art: Nintendo World Report](http://www.nintendoworldreport.com/news/31263/first-look-at-wii-u-game-case-design),
  [Nintendo Life](https://www.nintendolife.com/news/2012/08/wii_u_box_art_breaks_cover)
- [Switch spine size: SwitchSpines](https://switchspines.com/dimensions/),
  [Switch full wrap: Miketendo64](https://miketendo64.com/2018/09/29/guide-make-your-own-alternate-switch-box-art-covers/)
- [Case sizes and insert pockets: Walvis Products](https://www.walvisproducts.eu/c-4612560/blue-ray-boxes-game-cases/)
- [PS Vita cover size: Cheap Ass Gamer](https://www.cheapassgamer.com/threads/ps-vita-cover-art.346268/)
- [Insert sizes: CoverStitch](https://coverstitch.io/dimensions.html),
  [case sizes: Trevor Tyler Lee](https://www.trevortylerlee.com/posts/39-video-game-case-dimensions/),
  [PS4 print size: games-t](https://www.games-t.com/ps4-game-cover-dimensions)

### Size cross-check ([full investigation: `case-research.md`](case-research.md))

- [Wikipedia: Keep case](https://en.wikipedia.org/wiki/Keep_case),
  [Optical disc packaging](https://en.wikipedia.org/wiki/Optical_disc_packaging),
  [VHS](https://en.wikipedia.org/wiki/VHS), [J-card](https://en.wikipedia.org/wiki/J-card),
  [Floppy disk](https://en.wikipedia.org/wiki/Floppy_disk)
- [r/customcovers wiki, "coversizes"](https://www.reddit.com/r/customcovers/wiki/index/coversizes/) — a community
  reference, explicitly marked "under construction"; treated as one source among several, not authoritative alone
- [dvdnextcopy.com](https://www.dvdnextcopy.com/dvd-case-dimensions), [dvdfab.cn](https://www.dvdfab.cn/resource/dvd/dvd-case-size),
  [cdrom2go.com](https://www.cdrom2go.com/dimensions-blu-ray-case), [ronyasoft.com](https://www.ronyasoft.com/products/cd-dvd-label-maker/articles/popular_dvd_case_dimensions/)
- [SoonPak, CD inlay dimensions guide](https://soonpak.com/the-standard-cd-inlay-dimensions-guide-sourcing-and-printing-templates-for-jewel-cases/),
  [ChilliPrinting, CD insert sizes](https://www.chilliprinting.com/online-printing-blog/cd-insert-sizes-dimensions-for-printing-explained/),
  [Avery Template 8693](https://www.avery.com/products/labels/8693)
- [GenesysDTP, Switch case](https://www.genesysdtp.com/nintendoswitchclr1d10mm.htm),
  [GenesysDTP, Xbox One case](https://genesysdtp.com/xboxone1d12mm.htm),
  [OnlineLabels.com, floppy disk labels](https://www.onlinelabels.com/products/ol225)
- [VGBoxArt, PlayStation 3 template](https://vgboxart.com/resource/3877/playstation-3-template/) (site blocks
  automated fetches directly; quoted via a search-engine snippet)
- [ShunPoly, VHS box dimensions](https://shunpoly.com/article/what-size-are-plastic-vhs-boxes)
- [Blu-ray Forum, PS4 vs. PS3 case comparison](https://forum.blu-ray.com/showthread.php?t=230309)

### Branding cross-check (measured, `scripts/measure-covers.ts` → `scans-report.md`)

A separate, later pass: rather than reading percentages off individual covers by eye, this tool measures the front
header band's height and colour directly from pixels (DPI-scaled, median per row) across 3 real retail covers per
platform — different titles than the ones already cited above (F/W marks), so this is independent corroboration, not
a repeat of the same measurement. **PS2, PS3, PS4 and PS5's documented header heights all held up; none changed:**

| Platform | Spec (this file) | Measured (median of 3 covers) | Titles measured |
| :--- | :--- | :--- | :--- |
| PS2 | 8.7–9.5% H | 9.0% H | *God of War II*, *GTA: San Andreas*, *Spawn: Armageddon* |
| PS3 | 8.3% H | 8.1% H | *Darksiders*, *Future Tactics*, *Mass Effect 3* — one of three correctly identified as a black→grey **gradient**, not a flat colour |
| PS4 | 10.3% H | 10.7% H | *Madden NFL 19*, *Marvel's Spider-Man*, *Mortal Kombat X* |
| PS5 | 11.1% H, white | 11.2% H, `#ffffff` | *Kena: Bridge of Spirits*, *Marvel's Spider-Man 2*, *Tales of Arise* |

PS1's front strip is vertical (down the left edge), not a horizontal band, so this tool's header-band detector
doesn't apply to it and wasn't used to check the 15.5% W figure — see `case-research.md` for what it did measure on
PS1 (the tray card's spine-flap widths, flagged in the sizes table above).
