# Case size research

For each physical case, every source found is listed with a link, so no single page is treated as ground truth. All measurements are in millimetres — no inches.
**Mode is computed per column independently** (the most frequent width across sources, the most frequent height
across sources, the most frequent depth across sources) — not as one source's whole row. Every table below carries a
Mode row. Where a column had no repeated value, more sources were specifically sought out for it (see the "Additional
research" notes); where that still didn't produce agreement, the honest result is stated rather than invented.

**Every case is split into two sections: Case exterior (the plastic/cardboard shell) and Printed cover (the artwork,
a few mm smaller so it slides inside — or, for formats with no separate insert, the surface that actually gets
printed).** Our templates model the printed cover. Where one section genuinely doesn't apply to a format, that's
stated explicitly rather than left out.

One recurring insert-level source is the [r/customcovers wiki, "coversizes" page](https://www.reddit.com/r/customcovers/wiki/index/coversizes/)
— the origin of an earlier list checked against this project. It's a community wiki, explicitly marked "under
construction" on the page itself, so it's treated as one source among several, not as authoritative on its own.

---

## 1. CD jewel case (CD, PS1, Dreamcast)

### Case exterior

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Wikipedia, *Keep case* | 142 | 125 | 9.9 | [en.wikipedia.org/wiki/Keep_case](https://en.wikipedia.org/wiki/Keep_case) |
| Wikipedia, *Optical disc packaging* | 142 | 125 | 10 | [en.wikipedia.org/wiki/Optical_disc_packaging](https://en.wikipedia.org/wiki/Optical_disc_packaging) |
| dvdnextcopy.com | 142 | 125 | 10 | [dvdnextcopy.com/dvd-case-dimensions](https://www.dvdnextcopy.com/dvd-case-dimensions) |
| **Mode (per column)** | **142** (3/3) | **125** (3/3) | **10** (2/3) | |

### Printed cover

Two separate pieces: the front booklet cover, and the back tray card (which wraps around two spine flaps).

**Front insert (booklet cover) — flat card, no depth**

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Wikipedia, *Optical disc packaging* | 120 | 120 | — | [en.wikipedia.org/wiki/Optical_disc_packaging](https://en.wikipedia.org/wiki/Optical_disc_packaging) |
| Avery, official Template 8693 spec | 121.4 | 120.6 | — | [avery.com/products/labels/8693](https://www.avery.com/products/labels/8693) |
| ChilliPrinting | 120.65 | 120.65 | — | [chilliprinting.com](https://www.chilliprinting.com/online-printing-blog/cd-insert-sizes-dimensions-for-printing-explained/) |
| r/customcovers wiki, "Playstation OG" | 120 | 120 | — | [reddit.com/r/customcovers/wiki/index/coversizes](https://www.reddit.com/r/customcovers/wiki/index/coversizes/) |
| **Mode** | **120** (2/4) | **120** (2/4) | — (not applicable) | |

**Back tray card, total width including two spine flaps — flat card, no depth**

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Wikipedia, *Optical disc packaging* | 150 | 118 | — | [en.wikipedia.org/wiki/Optical_disc_packaging](https://en.wikipedia.org/wiki/Optical_disc_packaging) |
| ChilliPrinting | 150 | 117.5 | — | [chilliprinting.com](https://www.chilliprinting.com/online-printing-blog/cd-insert-sizes-dimensions-for-printing-explained/) |
| SoonPak (main panel 139 + two 6 mm spine flaps = 151 total) | 151 | 118 | — | [soonpak.com](https://soonpak.com/the-standard-cd-inlay-dimensions-guide-sourcing-and-printing-templates-for-jewel-cases/) |
| **Mode** | **150** (2/3) | **118** (2/3) | — (not applicable) | |

*Additional research found SoonPak, which broke the earlier 117.5/118 tie in favour of 118 and confirmed the ~150 mm total width.*

**Ours:** front 120 × 120 mm ✅. Back (137) + two 6.5 mm spine cards = **150 mm total** ✅, height 118 ✅. Matches the mode on total width and height; only the internal front/spine split differs from the sources' single wraparound card.

**Additional finding: the two spine flaps aren't equal width on real PS1 cover art.** All the sources above describe
a generic CD tray card, symmetric by construction. `scripts/measure-covers.ts`, run against 3 real PS1 full-wrap
scans (`scans-report.md`, *Gran Turismo*, *Harvest Moon: Back to Nature*, *Jade Cocoon*), measured the total wrap at
272.5 mm — matching our 270 mm total (150 + 120) closely — but consistently split it as roughly 6.3–6.4 mm nearest
the back and 4.7–12.4 mm nearest the front (wide variance; back-derived flap is the tighter, more consistent number).
The flap nearest the front is drawn noticeably wider than 6.5 mm on every sample, plausibly because it carries the
disc's rating/logo/NTSC information and needs the room — closer to the jewel case's own **10 mm exterior depth**
(this section's Case exterior mode, above) than to the tray card's nominal 6.5 mm flap. This is a much thinner
evidence base than the rest of this file (3 informally-scanned fan covers, not multiple independent published specs)
and may reflect a cover-art convention rather than the tray card's true printed dimension — flagged here rather than
folded into the table above.

---

## 2. DVD keepcase (DVD, PC, PS2, Xbox, Xbox 360, GameCube‑US, Wii, Wii U)

### Case exterior

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Wikipedia, *Keep case* | 135 | 190 | 15 | [en.wikipedia.org/wiki/Keep_case](https://en.wikipedia.org/wiki/Keep_case) |
| Wikipedia, *Optical disc packaging* | 135 | 190 | 14 | [en.wikipedia.org/wiki/Optical_disc_packaging](https://en.wikipedia.org/wiki/Optical_disc_packaging) |
| Walvis Products, manufacturer (PS2 / Xbox 360 / GameCube / Wii U product pages) | 135 | 190 | 14 | [walvisproducts.eu](https://www.walvisproducts.eu/c-4612560/blue-ray-boxes-game-cases/) |
| Trevor Tyler Lee, measured collection | 135 | 190 | — | [trevortylerlee.com](https://www.trevortylerlee.com/posts/39-video-game-case-dimensions/) |
| ronyasoft.com | 135 | 190 | 14 | [ronyasoft.com](https://www.ronyasoft.com/products/cd-dvd-label-maker/articles/popular_dvd_case_dimensions/) |
| dvdfab.cn | 135 | 190 | 14 | [dvdfab.cn](https://www.dvdfab.cn/resource/dvd/dvd-case-size) |
| **Mode (per column)** | **135** (6/6) | **190** (6/6) | **14** (4/5) | |

### Printed cover

What our template draws:

| Source | Width | Height | Depth (spine) | Link |
| :--- | :--- | :--- | :--- | :--- |
| CoverStitch | 130 | 184 | 14 | [coverstitch.io/dimensions.html](https://coverstitch.io/dimensions.html) |
| games-t.com (derived from a 273 × 183 wrap) | 129.5 | 183 | 14 | [games-t.com/ps4-game-cover-dimensions](https://www.games-t.com/ps4-game-cover-dimensions) |
| r/customcovers wiki — "DVD" and separately "PlayStation 2, Xbox OG, Xbox 360, Gamecube, Wii" (both give the same figure, derived from a 273 × 183 wrap) | 129.5 | 183 | 14 (implied, not stated separately) | [reddit.com/r/customcovers/wiki/index/coversizes](https://www.reddit.com/r/customcovers/wiki/index/coversizes/) |
| **Mode** | **129.5** (2/3) | **183** (2/3) | **14** (2/2 stated) | |

**Ours:** 129.5 × 183, spine 14. 5.5–7 mm smaller than the case exterior each way (the normal insert margin) and matches the mode exactly. **No change indicated.**

---

## 3. DVD Slim

### Case exterior

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| dvdnextcopy.com | 135 | 190 | 7 | [dvdnextcopy.com](https://www.dvdnextcopy.com/dvd-case-dimensions) |
| Mediaxpo (via manufacturer listing) | 135 | 190 | 7 | search-aggregated, no single stable product URL |
| ronyasoft.com ("Super‑Slim Amaray") | 130 | 184 | 7 | [ronyasoft.com](https://www.ronyasoft.com/products/cd-dvd-label-maker/articles/popular_dvd_case_dimensions/) |
| dvdfab.cn | 135 | 190 | 7 | [dvdfab.cn](https://www.dvdfab.cn/resource/dvd/dvd-case-size) |
| Panmer / USDISC / Maxtek (product names, "7mm slim") | — | — | 7 | [panmer.com](https://www.panmer.com/products/2-disc-black-slimline-dvd-case-with-7mm-spine-2), [usdisc.com](https://www.usdisc.com/products/usdisc-dvd-cases-slimline-7mm-premium-single-1-disc-clear-orange) |
| **Mode (per column)** | **135** (3/4) | **190** (3/4) | **7** (6/6, unanimous) | |

*Additional research found dvdfab.cn as a fourth exterior source, strengthening width and height to a clear majority.*

### Printed cover

| Source | Width | Height | Depth (spine) | Link |
| :--- | :--- | :--- | :--- | :--- |
| r/customcovers wiki, "Slim DVD" (derived from a 266 × 183 wrap; spine = 266 − 2×129.5) | 129.5 | 183 | 7 | [reddit.com/r/customcovers/wiki/index/coversizes](https://www.reddit.com/r/customcovers/wiki/index/coversizes/) |
| **Mode** | only one direct value: **129.5** | only one direct value: **183** | only one direct value: **7** | |

*Additional research (RonyaSoft's own Slim DVD template page, 4over4.com, print.dvdcover.com) was tried but none of those pages exposed numeric insert dimensions in their fetchable content — only the case-exterior table above could be strengthened. The insert width/height stay single-sourced at the insert level, though they follow the same ~5.5 mm margin pattern confirmed on every other case in this document.*

**Ours:** 129.5 × 183, spine 7 mm ✅ — spine width is the best-supported number in this whole case (unanimous across both sections). **No change indicated.**

---

## 4. The tall Blu-ray-class case (PS3, PS4, PS5, retail Blu-ray movies)

### Case exterior

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Wikipedia, *Keep case* / *Optical disc packaging* | 135 | 171.5 | 13 | [Optical disc packaging](https://en.wikipedia.org/wiki/Optical_disc_packaging) |
| Walvis Products — PS4 (manufacturer) | 135 | 170 | 15 | [Walvis PS4 case](https://www.walvisproducts.eu/a-46284729/blue-ray-boxes-game-cases/playstation-4-game-case-colour-transparent-blue/) |
| Walvis Products — PS5 (manufacturer) | 135 | 170 | 15 | [Walvis PS5 case](https://www.walvisproducts.eu/a-69846920/blue-ray-boxes-game-cases/playstation-5-game-case-colour-transparent-blue/) |
| Walvis Products — PS3 (sold as their generic 15 mm Amaray Blu-ray box; no separate shorter product) | 135 | 170 | 15 | [Walvis category page](https://www.walvisproducts.eu/c-4612560/blue-ray-boxes-game-cases/) |
| Trevor Tyler Lee, measured — states PS4 and PS5 "same as PS3" | 135 | 175 | — | [trevortylerlee.com](https://www.trevortylerlee.com/posts/39-video-game-case-dimensions/) |
| cdrom2go.com | 135 | 171.5 | 13 | [cdrom2go.com](https://www.cdrom2go.com/dimensions-blu-ray-case) |
| dvdnextcopy.com | 135 | 171 | 14 | [dvdnextcopy.com](https://www.dvdnextcopy.com/dvd-case-dimensions) |
| dvdfab.cn (spine options: 5, 12, 14 or 24 mm depending on configuration) | 135 | 171 | 12 (its default figure) | [dvdfab.cn](https://www.dvdfab.cn/resource/dvd/dvd-case-size) |
| Blu-ray Forum — user comparing a PS4 case to a movie Blu-ray case by hand: "about the same width/thickness, only slightly shorter" | — | ≈ same as retail Blu-ray | — | [forum.blu-ray.com](https://forum.blu-ray.com/showthread.php?t=230309) |
| ronyasoft.com, "US Blu-ray Case" | 128.5 | 148 | 12 | [ronyasoft.com](https://www.ronyasoft.com/products/cd-dvd-label-maker/articles/popular_dvd_case_dimensions/) |
| **Mode (per column)** | **135** (8/9) | **170–171.5 cluster** (8/9 within that band; 171 itself is the most-repeated single value at 2/9) | **12–15 cluster, no single winner** (dvdfab.cn confirms depth genuinely varies by product: 5/12/14/24 mm all exist commercially) | |

*Additional research (dvdfab.cn) confirmed depth isn't a single number in the real market — Blu-ray-class cases are commercially sold in several spine widths — so no further searching will resolve that column to one value; it's reported here as a real, sourced range rather than a gap.*

### Printed cover

Two separate readings, since PS3 and PS4/PS5 turned out to differ at the insert level even though they may share the same outer shell (see the Finding below).

**PS3**

| Source | Width | Height | Depth (spine) | Link |
| :--- | :--- | :--- | :--- | :--- |
| CoverStitch | 128 | 148 | 14 | [coverstitch.io](https://coverstitch.io/dimensions.html) |
| r/customcovers wiki | 129.5 | 149 | 14 (implied) | [reddit.com/r/customcovers/wiki/index/coversizes](https://www.reddit.com/r/customcovers/wiki/index/coversizes/) |
| VGBoxArt PS3 template — "1920×1052 px at 179 ppi = 27.2 × 14.9 cm" (derived: 272mm ÷ 2 for one front panel ≈ 129) | 129 | 149.3 | — | [vgboxart.com/resource/3877/playstation-3-template](https://vgboxart.com/resource/3877/playstation-3-template/) (page itself blocks automated fetches; quoted from a search-engine snippet of it) |
| **Mode** | no exact repeat, but now a tight 128–129.5 cluster across 3 independent sources | no exact repeat, but a tight 148–149.3 cluster across 3 independent sources | only one clear value: **14** | |

*Additional research found VGBoxArt's community template, a third independent source. It didn't produce an exact repeated digit, but it did turn "only one direct value" into three sources agreeing to within 1.5 mm — as close to resolved as decimal-rounded, independently-measured web sources are likely to get.*

**PS4 / PS5**

| Source | Width | Height | Depth (spine) | Link |
| :--- | :--- | :--- | :--- | :--- |
| Walvis, insert pocket height (manufacturer; width not stated at insert level) | — | 162 | 15 (case-level depth) | [Walvis PS4](https://www.walvisproducts.eu/a-46284729/blue-ray-boxes-game-cases/playstation-4-game-case-colour-transparent-blue/), [Walvis PS5](https://www.walvisproducts.eu/a-69846920/blue-ray-boxes-game-cases/playstation-5-game-case-colour-transparent-blue/) |
| CoverStitch | 128 | 148 | 14 | [coverstitch.io](https://coverstitch.io/dimensions.html) |
| r/customcovers wiki | 129.5 | 161 | 14 (implied) | [reddit.com/r/customcovers/wiki/index/coversizes](https://www.reddit.com/r/customcovers/wiki/index/coversizes/) |
| **Mode** | no exact repeat — cluster 128–129.5 | **161–162** (2/3 — Walvis and reddit agree; CoverStitch's 148 is the outlier) | **14** (2/2 stated) | |

**Finding:** the case-exterior sources (above) largely agree PS3, PS4 and PS5 all use the *same outer shell* (~170–175 mm). But at the insert level, the source that states PS3 and PS4/PS5 separately — the r/customcovers wiki — gives PS3 a **shorter usable insert (149 mm) than PS4/PS5 (161 mm)**, matching what our code already does, and this is now backed by a third independent source (VGBoxArt) for PS3 specifically. This isn't necessarily a contradiction with the case-exterior data: Xbox One's case (section 5) shows the same pattern — a 170 mm shell shared with PS4, but a shorter 150 mm insert pocket than PS4's 162 mm, because the internal disc tray differs. PS3 likely works the same way: same outer case as PS4/PS5, but a shorter insert window.

**Verdict: no change recommended.** Three independent insert-level readings now cluster PS3 at 128–129.5 × 148–149.3, matching our current 129.5 × 149 far more closely than the case-exterior figures suggested.

---

## 5. Xbox One / Xbox Series X\|S

### Case exterior

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Walvis Products, manufacturer | 135 | 170 | 11 | [Walvis Xbox One case](https://www.walvisproducts.eu/a-46287304/blue-ray-boxes-game-cases/11-mm-xbox-one-game-case-colour-transparent-green/) |
| Mediaxpo, manufacturer (via search) | 135 | 170 | 12.5 | search-aggregated |
| Generic replacement-case listings (Amazon/Square Deal/CheckOutStore, "12mm" cases) | 135 | 170 | 12 | [amazon.com listing](https://www.amazon.com/50-XBOX-ONE-Translucent-Replacement/dp/B00JZZMTWS) |
| **Mode (per column)** | **135** (3/3) | **170** (3/3) | **12–12.5 cluster, no single winner** — depth genuinely varies by product line (11/12/12.5 mm all sold) | |

### Printed cover

| Source | Width | Height | Depth (spine) | Link |
| :--- | :--- | :--- | :--- | :--- |
| Walvis, insert pocket height (manufacturer) | 128 | 150 | 11 | [Walvis Xbox One case](https://www.walvisproducts.eu/a-46287304/blue-ray-boxes-game-cases/11-mm-xbox-one-game-case-colour-transparent-green/) |
| GenesysDTP (reseller, same figure repeated across their and others' 11 mm case listings) | — | 150 | 11 | [genesysdtp.com](https://genesysdtp.com/xboxone1d12mm.htm) |
| r/customcovers wiki, "Xbox One & Series X/S" (derived from a 267 × 149 wrap; spine = 267 − 2×128) | 128 | 149 | 11 | [reddit.com/r/customcovers/wiki/index/coversizes](https://www.reddit.com/r/customcovers/wiki/index/coversizes/) |
| **Mode** | **128** (2/2 stated) | **150** (2/3) | **11** (3/3, unanimous) | |

**Ours:** 128 × 149, spine 11 ✅ — three sources now agree on the spine and on width/height within 1 mm. **No change indicated.**

---

## 6. Nintendo Switch

### Case exterior

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Wikipedia, *Keep case* | 104 | 170 | 10 | [en.wikipedia.org/wiki/Keep_case](https://en.wikipedia.org/wiki/Keep_case) |
| Walvis Products, manufacturer | 105 | 170 | 11 | [Walvis Switch case](https://www.walvisproducts.eu/a-56765724/blue-ray-boxes-game-cases/nintendo-switch-game-case-colour-transparent/) |
| GenesysDTP, manufacturer | 105 | 168 | 10 | [genesysdtp.com](https://www.genesysdtp.com/nintendoswitchclr1d10mm.htm) |
| **Mode** | **105** (2/3) | **170** (2/3) | **10** (2/3) | |

*Additional research found GenesysDTP as a third manufacturer source, turning every column of this table from a "no exact repeat" cluster into a real 2/3 majority.*

### Printed cover

| Source | Width | Height | Depth (spine) | Link |
| :--- | :--- | :--- | :--- | :--- |
| SwitchSpines.com | not stated | 161 | 10 | [switchspines.com/dimensions](https://switchspines.com/dimensions/) |
| Miketendo64.com (derived: width = (208 wrap − 10 spine) / 2) | 99 | 161 | 9–10 | [miketendo64.com](https://miketendo64.com/2018/09/29/guide-make-your-own-alternate-switch-box-art-covers/) |
| **Mode** | only one direct value: **99** | **161** (2/2) | **10** (2/2, taking Miketendo64's upper bound) | |

**Ours:** 99 × 161, spine 10. Height and spine match the mode exactly; width has only one insert-level source but is consistent with the case-exterior mode (105 mm case, minus the usual ~5–6 mm margin). **No change indicated.**

---

## 7. PlayStation Vita

### Case exterior

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Walvis Products, manufacturer | 105 | 135 | 11 | [Walvis Vita case](https://www.walvisproducts.eu/a-54220929/blue-ray-boxes-game-cases/playstation-vita-game-case-colour-blue/) |
| **Mode** | only one source: **105** | only one source: **135** | only one source: **11** | |

### Printed cover

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Cheap Ass Gamer forum, reported full cover (derived: width = (207 wrap − 9 assumed spine) / 2) | 99 | 125 | 9 (assumed, not stated) | forum post, cited earlier in this research; no stable direct link found on re-search |
| **Mode** | only one source: **99** | only one source: **125** | only one source: **9** | |

**Additional research conducted and unsuccessful:** searched specifically for PS Vita print-template pixel/DPI specs (Cover Project, VGBoxArt, DeviantArt templates by AaronMon97, RazorClaw46 and ETSChannel), Wikipedia (covers PSP, not Vita), and case-manufacturer listings beyond Walvis. None exposed a second independently-verifiable millimetre figure for either the case or the insert. **This remains the lowest-confidence case in the set — one case-exterior source, one insert source, no true second measurement of either.** Ours (99 × 125, spine 9) is plausible by the pattern seen everywhere else, but unverified beyond that pattern.

---

## 8. VHS

### Case exterior

| Source | What it measures | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Search-aggregated, "cardboard slipcase" (the closest match to a plain printable retail box, our template's actual subject) | the outer cardboard **slipcase** | 104 | 190 | 25 | search-aggregated; no single stable page found on re-fetch |
| ShunPoly.com / Amazon "Size A" listing (same product cited by both) | an aftermarket plastic **protector sleeve** (not the original box) | 105 | 190 | 26 | [shunpoly.com](https://shunpoly.com/article/what-size-are-plastic-vhs-boxes), [amazon.com](https://www.amazon.com/Standard-Plastic-Protective-Protectors-Sleeve/dp/B09CPTW834) |
| **Mode** | two different objects, so a literal mode mixes unlike things | no exact repeat — cluster 104–105 | **190** (2/2) | no exact repeat — cluster 25–26 | |

*Additional research found a "cardboard slipcase" figure (structurally the closest match to what our template represents) and confirmed the plastic-sleeve figure is the same product listed by two retailers, not two independent measurements. Height now has a real match; width and depth remain a tight, unresolved 2-way cluster.*

### Printed cover

VHS art wraps around the box itself, not a separate insert card — so the printed cover *is* the case exterior above:
the same 104–105 × 190 × 25–26 mm box, printed directly on its cardboard or plastic surface.

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Search-aggregated, "cardboard slipcase" | 104 | 190 | 25 | search-aggregated; no single stable page found on re-fetch |
| ShunPoly.com / Amazon "Size A" listing | 105 | 190 | 26 | [shunpoly.com](https://shunpoly.com/article/what-size-are-plastic-vhs-boxes), [amazon.com](https://www.amazon.com/Standard-Plastic-Protective-Protectors-Sleeve/dp/B09CPTW834) |
| **Mode** | no exact repeat — cluster 104–105 | **190** (2/2) | no exact repeat — cluster 25–26 | |

For reference only, the cassette **shell** inside the box (a different object again, not something the user prints)
is 103 × 187 × 25 mm per [Wikipedia: VHS](https://en.wikipedia.org/wiki/VHS).

**Ours (105 × 190, depth 25):** matches the height mode exactly, matches the low end of the depth cluster, and sits at the top of the width cluster. **No change indicated**, though width and depth are the two figures here that stayed a cluster rather than a clean majority.

---

## 9. Cassette (compact audio cassette)

### Case exterior

The plastic cassette shell that holds the tape is not something our template prints — only the paper J-card that
slides into the case is user-printable (see "Printed cover" below). No case-exterior dimensions were researched for
the shell itself, since nothing in our templates depends on them.

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| *(not researched — not needed for this project)* | — | — | — | — |

### Printed cover

The J-card. Front, spine and back flap are its three panels — the equivalent of width, height and depth, since the
card's height is constant and not separately measured by any source.

| Source | Front (width) | Spine (depth) | Back/tracklist flap | Link |
| :--- | :--- | :--- | :--- | :--- |
| Wikipedia, *J-card* | 65.0875 | 12.7 | 26.9875 | [en.wikipedia.org/wiki/J-card](https://en.wikipedia.org/wiki/J-card) |
| Template providers (bandcds.co.uk, tapeline.info, Ultra Ferric — all state the same figures) | 65.0875 | 12.7 | 26.9875 | [bandcds.co.uk PDF](https://www.bandcds.co.uk/wp-content/uploads/2026/04/Cassette-Standard-J-Card-Template-Front.pdf), [tapeline.info PDF](https://www.tapeline.info/downloads/j_card_template.pdf) |
| **Mode** | **65.0875** (2/2) | **12.7** (2/2) | **26.9875** (2/2) | |

**Caveat:** these providers may all be citing the same original spec rather than measuring independently — the mode agreement here is real but shallow. Wikipedia also notes: "the other flaps are 1.5875 mm less than the one before" — a longer accordion fold than our 3-panel model.

**Ours:** front 65.1 ✅, spine 12.7 ✅, back **25.4** vs. the mode's 26.9875 for the first flap (26.9875 − 1.5875 = 25.4, which is exactly ours — so our number may be citing the *second* flap of a longer fold, not the first). Minor, 1.6 mm.

---

## 10. Floppy disk (3.5-inch)

### Case exterior

The disk shell — a rigid plastic cartridge, not something the user prints, but sourced here since our 3D preview
models it.

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| ANSI X3.171-1989 / ISO/IEC 9529, official standard | 90 | 94 | 3.3 | cited via [Wikipedia: Floppy disk](https://en.wikipedia.org/wiki/Floppy_disk) and industry standards summaries |
| **Mode** | only one source: **90** | only one source: **94** | only one source: **3.3** | |

### Printed cover

The square label stuck to the shell's face.

| Source | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- |
| Avery Template 5196/5296, official product spec | 69.85 | 69.85 | — | Avery product spec (square label templates) |
| OnlineLabels.com, product OL225 | 69.85 | 69.85 | — | [onlinelabels.com/products/ol225](https://www.onlinelabels.com/products/ol225) |
| **Mode** | **69.85** (2/2, exact match across two independent retailers) | **69.85** (2/2) | — (not applicable, flat label) | |

*Additional research found OnlineLabels.com as a second, independent retailer confirming the exact same square label size as Avery — this was previously single-sourced and is now resolved.*

Note: a rectangular alternative (~68 × 51 mm, sold as "2 11/16 × 2 in" diskette labels) also exists commercially alongside the square one, corroborating that both shapes are real products; we use the square variant, matching two of two sources for that shape specifically.

**Our 3D preview shell (90 × 94 × 3.3) matches its only source exactly. Our label (69.85 × 69.85) now has genuine two-source agreement.** No change indicated.

---

## Summary

| Case | Sourcing | Verdict |
| :--- | :--- | :--- |
| CD/PS1, DVD, DVD Slim (exterior), Xbox One/Series, Switch, floppy label | Real per-column majorities (2/2 to 6/6), several strengthened this round | **No change needed** |
| **PS3** | 3 independent insert-level sources now cluster tightly (128–129.5 × 148–149.3) | **No change** — confirms current 129.5 × 149 |
| Blu-ray-class depth, Xbox One/Series exterior depth | Research shows these genuinely vary across real commercial products (5–24 mm and 11–12.5 mm respectively) | Not a gap in research — a real range; no single "true" value exists to converge on |
| PS Vita | Additional research conducted, no second source found for either the case or the insert | Lowest confidence in the set, unresolved |
| VHS width/depth, DVD Slim insert, cassette back flap | Improved but not fully resolved this round | Plausible, minor/no priority to change |
| Cassette case exterior, floppy shell | Not researched — not needed for what our templates print | N/A by design |



## 11. Slipcovers and boxes (clearance)

A slipcover or box is printed on card, folded and glued, so it is the case's outside size (the "Case exterior" tables
above) plus some room to slide on. **No published figure for that room was found**: print vendors' templates cover
inserts and wraps (e.g. [4over4](https://www.4over4.com/guide/dvd-cover-size-dimensions-and-print-specs),
[Duplication.ca](https://www.duplication.ca/bluray-trapsheets-offset.html)), not hand-folded sleeves. The code uses
assumed values and says so:

| Piece | Added to the case's width, height and depth | Source |
| :--- | :--- | :--- |
| Slipcover | 1.5 mm | assumed |
| Box | 2 mm | assumed |

Outside sizes used for the pieces: DVD, PC, PS2, Wii, Wii U, GameCube, Xbox and Xbox 360 135 × 190 mm; Blu-ray, UHD,
PS3, PS4 and PS5 135 × 171 mm (sources give 170–171.5; 171 is the most repeated); Xbox One and Series 135 × 170 mm;
Switch 105 × 170 mm; Vita 105 × 135 × 11 mm (one source); CD jewel and PS1 142 × 125 × 10 mm; floppy 90 × 94 × 3.3 mm;
a record jacket its own size. **Cassette**: the case wasn't researched, so it is the J-card plus the margin a DVD case
adds to its insert (5.5 × 7 mm), and is marked derived. Depth is the insert's spine width unless noted.

## 12. Blu-ray 4K UHD multi-disc cases (Severin)

[Severin Films](https://severin-films.com/products/black-blu-ray-cases) sells replacement black cases: single, 2-disc and
3-disc 4K UHD at **12.5 mm**, and a 4-disc 4K UHD at **15 mm**. We offer these as UHD variants `elite-12.5` and
`multi4-15`. Severin publishes no outer or insert dimensions, so both reuse the Blu-ray-class size (135 × 171 mm case,
128 × 149 mm front); a retailer lists the 4-disc case at 171.5 × 136 × 15 mm
([desertcart](https://www.desertcart.nl/products/313337750-new-1-official-4-discs-4k-uhd-replacement-case-black.md)) and
a distributor lists 129 mm panels with a 15 mm spine, which agree within 1 mm. Not measured on a physical case.

## 13. Nintendo DS

Measured from three 300 dpi scans in `scans/ds` (git-ignored, like the other scans) and the fan-made `template.png`.
Every file is a 276 × 116 mm wrap laid out back | spine | front.

### Size

| Measure | Value | How it was found |
| :--- | :--- | :--- |
| Front and back | 130 × 116 mm | the spine/front fold is a sharp black-to-white step at 145.9 mm on all three scans; the front is 276 − 145.9 = 130.1 mm |
| Spine | 16 mm (15.9 measured) | 276 − 2 × 130; the back/spine fold is hidden by the art, so it is taken as symmetric |
| Case outside (box, slipcover) | 136 × 124 mm, 19 mm deep | the footprint is shared with the 3DS and the depth is the DS's own; see §15 for the sources |

`scripts/measure-covers.ts` locked onto the wrong edge on one scan (GTA: back 138, spine 8): the white strip beside the
spine looks like a spine to an edge detector. The other rows and the Mode are right, and the known 16 mm spine is the
fallback, as for the other cases.

### Trade dress (what Branded draws)

The DS front has no header band. It has a **white strip down the left**, 18.9 mm wide at the top and bottom and 21.7 mm in
the middle (14.6–16.7 % of the front's width), and the cover art starts at its curved right edge. The edge was read from
the template's alpha channel (opaque white where the strip is, transparent where the art goes):

- **A gradual curve.** The edge reaches 18.93 mm from the front's left at the top and bottom and 21.72 mm at mid-height, and is symmetric about the middle (19.69 at 10 % and 90 %, 20.37 at 20 % and 80 %, 21.05 at 30 % and 70 %, 21.47 at 40 % and 60 %). It is nearly straight for the first third, then flattens.
- **A black border**, a constant 1.27 mm, along that edge.
- **An angular cutout** from 42.5 mm to 74.5 mm down (36.6 % to 64.2 % of H). The white pulls back to 18.25 mm from the front's left, slanting in over 3 mm (42.5 to 45.5 mm) and out over 4 mm (70.5 to 74.5 mm). The border is 3 mm thicker in between, which is the thumb notch the black wedge in the template shows.
- **The logo** (`src/brands/svg/ds.svg`) reads **bottom to top** (rotate −90, N at the bottom, the DS and ™ at the top). Its ink spans 151.8–160.4 mm across and 26.3–88.2 mm down (22.6–76.1 % of H), 62 mm long. The first version had it reading top to bottom, 180° the wrong way round.
- **The spine** has a white cap down to 34.1 mm (29.4 % of L), carrying a small copy of the logo reading top to bottom (136.3–140.2 mm across, 3.5–31.0 mm down). Below it the spine is the game's own colour. **Two subtle curves**: the white cap's bottom-left corner is itself rounded (about 1 mm, so the black shows through), and the coloured area's top-right corner is rounded (about 1 mm, so the white cap runs down into the gap).

The engine got two small features for this, both optional on existing branding data (`src/engine/official.ts`):
`edge` on a `strip` header (a curve, a border and a cutout, drawn as two ordinary layers) and `corners` on a spine cap (a positive radius rounds the area below, a negative one rounds the cap's own corner).

### How the match was checked

`npm run compare:covers -- ds --scans` renders the app's cover with Branded on and no artwork (`compare/ds/app.png`, 300 dpi, on the same pixel grid as the scans) and writes an overlay of it against the template. The overlay score and the logo positions, from the ink bounding boxes of the app and the template:

| Step | Overlay match | Logo error |
| :--- | :--- | :--- |
| Straight strip, logo the wrong way round | 84.6 % | n/a |
| Curved edge, border, cutout, logo rotated, spine corners | 94.8 % | up to 0.4 mm and 7 % in size |
| Logo and cap positions tuned to the template | 98.0 % | within 0.1 mm |

What is left: the template has no art, so the app's dark base colour shows where the template is transparent, and the
border can't be told from it in the overlay. The edge is a polyline sampled 96 times (not a true curve), which is
indistinguishable at print size.

## 14. Nintendo 3DS

Measured from three 300 dpi scans in `scans/3ds` (Kirby: Planet Robobot, Rayman 3D, Tetris Axis; git-ignored) and the
fan-made `template.png`. The 3DS wrap is the DS's turned round: the white strip is on the **right** of the front.

### Size

| Measure | Value | How it was found |
| :--- | :--- | :--- |
| Wrap | 274 × 116.2 mm (scans), 276 × 116 mm (template) | the template is 2 mm wider than all three scans |
| Front and back | 131 × 116 mm measured; **130 × 116 mm in the app** (the DS's, see §15) | the spine's white run is 131–143 mm on all three scans (130.7–131.2 mm at the left, 142.7–143.1 mm at the right), and the report's Mode is 130.9 back, 131.0 front |
| Spine | 12 mm (12.0–12.4 measured) | 274 − 2 × 131; the template's spine is 12.1 mm |
| Wrap in the app | 272 × 116 mm | 130 + 12 + 130 |
| Case outside (box, slipcover) | 136 × 124 mm, 12.5 mm deep | Walvis lists the 3DS case at 136 × 124 × 12.5 mm; see §15 |

The scans and the template disagree by about 1 mm on each side. The app follows the scans for the spine, the strip and the logos, but takes the DS's 130 mm for the front and back (§15). The overlay score is lower than the DS's for the same reason (see below). The edge detector got Tetris Axis wrong
(back 127.2, spine 15.7) because the game's own art has a white run near the spine.

### Trade dress

- **Strip.** White, down the **right** edge of the front, 13.5 mm wide on the scans (10.3 % of the front's width; the template has 14.3 mm). Its left edge is straight (260.1–261.1 mm on the three scans) with a **soft grey shadow** fading from about `#b1b1b1` at the edge to white over 3.5 mm (read from the template; the scans' shadow is a little shorter and lighter). Ours is a horizontal gradient from the strip's left edge.
- **Logo** (`src/brands/svg/3ds.svg`, "NINTENDO 3DS" with a red 3 and grey squares): reads **bottom to top**, like the DS's. Ink 7.2 mm across and 26.8–87.8 mm down (23.1–75.7 % of H); its right edge is 3.2 mm in from the wrap's right edge.
- **Spine.** All white, full length. The logo is at the top, reading top to bottom, 2.9 mm across and 2.8–27.0 mm down on the scans (2.4–23.3 % of L), centred a little right of the spine's middle. Ours sits 1.2 mm lower (4.0 mm down, 3.4–24.3 % of L) so it isn't tight against the top edge. Below it the game's own icon and title (the app's spine title takes the dark-grey fallback on white, as the Wii does).
- **No curve, border, cutout or rounded corners**: unlike the DS, the 3DS strip's edge is straight and its spine has square corners.

The engine got one small feature for it: `side: 'right'` on a `strip` header (the curved `edge` is for the left side only).

### How the match was checked

`npm run compare:covers -- 3ds --scans` renders the app (`compare/3ds/app.png`, 300 dpi on the scans' pixel grid) and the same ink-bounding-box check as the DS, against the template and the scans:

| | Front logo (x, y, mm) | Spine logo (x, y, mm) |
| :--- | :--- | :--- |
| App, first version | 264.2–271.5, 26.6–88.0 | 135.7–138.6, 2.4–26.1 |
| Kirby / Rayman / Tetris scans | right edge 271.0 / 270.7 / 270.5, 26.7–87.5 / 26.8–87.8 / 27.3–88.2 | 135.8–138.7, 2.8–27.0 / 2.9–27.1 / 3.6–27.8 |
| App, tuned to the scans | 263.6–270.8, 27.0–87.9 | 135.7–138.6, 3.0–27.0 (since moved down 1.2 mm) |

The overlay against the template is 90.0 %: it was 91.0 % before the logos were moved onto the scans, because the template
is 2 mm wider and its logos sit about 0.7 mm differently, so this score understates how well it matches the scans.

## 15. Nintendo DS and 3DS side by side

**Question:** the DS and 3DS wraps differ by 1 mm per panel (130 vs 131) and the spines by 4 mm (16 vs 12). Are the cases
the same size, or different? **Answer, from the cases themselves: the same footprint, but the DS case is much thicker.**

### Case exterior

| Source | Case | Width | Height | Depth | Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Walvis Products (manufacturer) | Nintendo 3DS, white | 136 | 124 | 12.5 (insert pocket 118 mm tall) | [walvisproducts.eu](https://www.walvisproducts.eu/a-54221072/blue-ray-boxes-game-cases/nintendo-3ds-game-case-colour-white/) |
| Walvis Products (shown as "customers also bought" on that page) | Nintendo DS | 136 | 124 | 19 | same page |
| shop4tech, titled "Fits all Nintendo DS and 3DS Games" | 12 mm standard, white | 134 | 123 | 12 | [shop4tech.com](https://www.shop4tech.com/item10280.html) |
| shop4tech | 3DS standard, black | 134 | 125 | 14 | [shop4tech.com](https://www.shop4tech.com/item10812.html) |
| Pearl.fr | 3DS | 135 | 125 | 15 | [pearl.fr](https://www.pearl.fr/article/TG3011/boitier-pour-jeux-nintendo-3ds) |
| ZedLabz | 3DS, white | 137 | 125 | 13 | [zedlabz.com](https://www.zedlabz.com/en-eu/products/game-case-for-nintendo-3ds-retail-compatible-cartridge-replacement-white-zedlabz) |
| Coolshop | DS-compatible replacement | 136 | 124 | 20 | [coolshop.dk](https://www.coolshop.dk/produkt/AC3TM9/) |
| Stone Age Gamer | DS replacement | — | — | 14 | [stoneagegamer.com](https://stoneagegamer.com/nintendo-ds-replacement-cartridge-case.html) |
| Wikipedia, *Nintendo Game Card* | the cards themselves | 33–35 | 35 | 3.8 | [wikipedia.org](https://en.wikipedia.org/wiki/Nintendo_Game_Card) |
| **Mode (per column)** | | **136** | **124** | DS **19–20** (Walvis, Coolshop), 3DS **12–13** (four sellers, 12.5 most repeated) | |

- **The footprint is the same**: every source is 134–137 × 123–125 mm, with 136 × 124 the most repeated (Walvis for both, Coolshop). Cards are the same size too, and shop4tech sells one case that "fits all Nintendo DS and 3DS games".
- **The thickness is not**: 3DS cases are 12–15 mm (12.5 from the manufacturer), the DS case 19–20 mm from the two sources that give one. A single 14 mm DS figure and the 12 mm "fits both" case disagree, so the DS depth rests on two sources; the scans' 16 mm DS spine against a 19 mm case suggests the printed spine is a little narrower than the shell, which the other cases here don't do.
- **The insert pocket** is 118 mm tall on the 3DS case (Walvis), 2 mm more than the scans' 116 mm covers, which is the usual margin. No source gives a pocket *width*, so the scans stand for the 1 mm per panel difference.

### The covers, measured

Both were measured the same way (the white run of the spine at three rows, on all three scans of each):

| | DS | 3DS |
| :--- | :--- | :--- |
| Wrap (width × height) | 276.0 × 116.0 mm | 274.0 × 116.2 mm |
| Back / spine fold | 129.8–130.3 mm | 130.7–131.2 mm |
| Spine / front fold | 145.9 mm (all three scans) | 142.7–143.1 mm |
| Back, spine, front | 130, 16, 130 | 131, 12, 131 |
| Front strip | left, 18.9–21.7 mm, curved, bordered, with a cutout | right, 13.5 mm, straight, soft shadow |

Each platform's three scans agree to about 0.3 mm, so the 4 mm spine difference is real (and matches the 19 vs 12.5 mm
cases). The 1 mm per-panel difference is within the ±0.5 mm that scans from different sources are trimmed to, the 3DS scans are 0.2 mm
taller, and the cases have one footprint, so it may not be a real difference between the covers. It was first kept as measured because no source says the covers are the same; then set to 130 for both (see below).

### What the app uses

Insert: 130 × 116 mm front for both, with each platform's own spine (DS 16 mm, 3DS 12 mm). The 3DS scans measure 131 mm; it was set to 130 because the cases share one 136 × 124 mm footprint, the usual shell-to-cover gap on every other case here is 5.5–7 mm (so 130 on 136), and 1 mm is inside scan trimming tolerance. The 3DS strip and logos are anchored to the right edge and the spine logo to the spine's fold, so they sit where the scans have them (3.3 mm in from the right edge; 4.8 mm in from the fold). Box and slipcover: the
shared 136 × 124 mm footprint with each case's own depth, DS 19 mm and 3DS 12.5 mm (`src/templates/pieces.ts`).

## 16. Nintendo Game Boy

Measured from three 300 dpi scans in `scans/gb` (Kirby's Dream Land, Super Mario Land 2, Wario Land: Super Mario Land 3;
git-ignored) and the fan-made `template.png`. The Game Boy is normally a cardboard box, so the first question was what
to default to.

### Case or box?

**The app defaults to a DS-size case**, and the original box is a Box type round it. Three things point there:

| Evidence | What it says |
| :--- | :--- |
| The scans | all three are 276.0 × 116.0 mm (the template 275.8), the same 130 + 16 + 130 mm wrap as the DS. People print Game Boy covers for a DS-size case, not a box |
| [Retro Game Cases](https://www.retrogamecases.com/gameboy-gameboy-color-gameboy-advance/) | sells Game Boy, Game Boy Color and Game Boy Advance cases and says they are "the same size as the Nintendo DS case", with clips that hold the cartridge. The page gives no millimetres |
| The cartridge ([Wikipedia](https://en.wikipedia.org/wiki/Game_Boy_Game_Pak)) | 65.5 × 57 × 7.5 mm for the Game Boy and Game Boy Color, 35 × 57 × 7.5 mm for the Game Boy Advance. A DS *card* is 33–35 × 35 mm, so a DS case's tray won't hold a Game Boy cartridge as it is: it takes a case made for it, at the DS case's outside size |

No source gives the original retail box's size, so the Box type is not that box: it is a tuck-end box round the DS-size
case, like the Box type of every other case here. A true retail Game Boy box would need its own template once someone
has a box to measure.

The case outside is the DS's, 136 × 124 mm and 19 mm deep (§15), on the strength of that one seller's statement; it is not
a measurement of a Game Boy case.

### Size

| Measure | Value | How it was found |
| :--- | :--- | :--- |
| Wrap | 276.0 × 116.0 mm | all three scans (275.7 for Super Mario Land 2) |
| Spine / front fold | 145.7–145.9 mm | the silver strip starts where the blue spine ends |
| Front and back | 130 × 116 mm | 276 − 145.9 = 130.1; the template's back is 130.0 |
| Spine | 16 mm (15.7 on the template) | 276 − 2 × 130 |

### Trade dress

- **Front strip.** Brushed silver, down the left of the front, 32.7 mm wide (25.2 % of its width), from 145.8 to 178.5 mm on all three scans and the template. The colour runs from `#eef5f6` at the top to `#adbfc3` at the foot (median of the two scans' text-free pixels per tenth of its height), with fine vertical brushing: see "The metal effect" below. The wordmark GAME BOY is in `#001497` and reads bottom to top: 19.1 mm across and 6.2–113.6 mm down (5.3–97.9 % of H).
- **Spine.** A silver cap 33.2 mm long (28.6 % of L; 33.1 on the template), the same brushed metal as the strip but lighter and flatter (`#eff6f7` at the top to `#e5eef0` at the foot), with the wordmark small, reading top to bottom: 5.1 mm across and 2.3–30.8 mm down. Below it the game's own colour. It was first drawn plain white; the scans and template have it metal.
- **No back band.** Two of the three scans print a 14.0 mm silver band down the left of the back (Wario Land 3's has none, and the template has none), but the app draws nothing there: the back is left to the game's own art.
- **The Nintendo oval** at the top of the front strip, from `src/brands/svg/nintendo.svg`: 18.6 × 4.6 mm at 152.5–171.1 mm across and 1.35–5.9 mm down, in the scans' red `#ed1c24` (the SVG's own `#cc2131` is drawn flat in that red, `mono`). Its inside is clear, as on the template, so the silver shows through. The app's mark sits exactly on the template's (152.5, 1.35 to 171.1, 5.9) and 0.2 mm left of the scans'.
- **The wordmark colour.** `gb.svg` bakes in `#393c9f`, but the template and scans print `#001497`, so the wordmark is drawn flat in `#001497` (`mono`).

The engine got one small feature, `brushed`, on a strip or a spine cap (the metal texture below). The logo generator also gained `<polyline>` and `<polygon>`: `gb.svg` draws its E and Y as polylines, which it
ignored, so the first render read "GAM BO".

### The metal effect

A plain top-to-bottom gradient gets the colour right but looks like painted plastic. Measured on the scans, what makes the
strip read as metal is **fine vertical brushing**: a column-by-column average of the strip's pixels (text left out) has a
spread of about 5 levels out of 255, and neighbouring pixels are alike (correlation 0.68 at one pixel, so streaks are
about 1–3 px, 0.1–0.25 mm, wide). The template has the same, a little noisier (5.5 spread, 0.54).

So the metal is two layers in the Branded folder, not one:

1. **The base**, a vertical gradient fitted to the scans: ten stops from `#f4fcfd` to `#b2c4c8`, each 2.6 % lighter than the measured medians, because the texture darkens by that much on average.
2. **A brushed texture** (`branded.front.strip-brush`, `branded.spine.cap-brush`) over the base: one left-to-right gradient of black, mostly transparent stops about 0.1 mm apart (327 across the strip, 160 on the cap), each opacity 0.026 ± 0.022 following a smoothed random walk (`0.55 × the last + noise`). Opaque black at varying strength rather than white and black mixed, because gradients between a white and a black stop pass through a muddy grey. The same seed gives the same streaks every time, so exports and goldens are stable.

What else was considered and why it was left out: a *specular sheen* (a bright band across the strip, as on polished
metal) isn't in the scans, whose columns vary by under 2 % across the strip; *noise from an image* would need a texture
file or asset per piece; and a *gradient with a few stops* can't carry streaks this fine. Measured on the render (Kirby
scan in brackets):

| | Strip | Spine cap |
| :--- | :--- | :--- |
| Mean level | 207.3 (205.9) | 232.9 (232.2) |
| Column spread | 4.3 (5.2) | 4.2 (3.8) |
| Correlation at 1 px | 0.74 (0.68) | 0.69 (0.52) |
| Level down the strip, every 20 mm | 236, 230, 221, 213, 200, 180 (238, 231, 220, 213, 200, 177) | 239, 236, 232, 231, 230 (240, 237, 232, 229, 228) |

The texture is generated, so it has hundreds of stops: the layer editor shows a note for a gradient with more than 16
stops instead of a row each, and saved designs keep up to 600.

### Space around the logos

On the scans the logos nearly touch the edges (the spine wordmark is 2.4 mm from the top of the spine, 2.4 mm short of the cap's foot): the Nintendo oval is 1.35 mm from the top and the wordmark 2.4 mm
from the bottom. The app indents them: the oval is 4.1 mm from the top (4.6 mm tall, down to 8.6 mm), then 2.6 mm of
space, then the wordmark from 11.3 to 112.0 mm, 4.0 mm from the bottom. The wordmark shrinks to fit (100.7 mm long, 17.6 mm
across, from 107.4 and 19.1), keeping its shape, and sits 7.1 mm and 8.0 mm in from the strip's two edges. The
spine wordmark is moved down to 4.1 mm from the top and shrinks to end 2.6 mm above the cap's foot (26.6 mm long, from
28.5). The trade-off is a less faithful reprint for a cover that doesn't look cramped, and a print that is less likely to lose the
oval to the trim. To put them back, `from`/`to` in `src/engine/official.ts` are 0.0116 to 0.0511 for the oval, 0.0533
to 0.9789 for the front wordmark and 0.0197 to 0.2657 for the spine wordmark.

### How the match was checked

`npm run compare:covers -- gb --scans`, and the ink bounding box of the blue wordmark on the app's render against the scans:

| | Front wordmark (x, y mm) | Spine wordmark | Nintendo oval |
| :--- | :--- | :--- | :--- |
| Scans | 152.1–171.4, 6.2–113.6 | 135.6–140.7, 2.3–30.8 | 152.7–171.3, 1.35–5.9 |
| App | 153.1–170.7, 11.3–112.0 (indented, see below) | 136.0–140.6, 4.1–30.7 (indented) | 152.5–171.1, 4.1–8.6 (indented) |

The three logos were first placed within 0.4 mm of the scans, then deliberately moved in from the edges (below), so they no longer match them. The overlay against the template is 74.3 % (95.7 % before that move) (it was 72.6 % with the back band, and the cap white); what is left is the app's dark base colour where the template is transparent, and the streaks, which are not the template's own.

## 17. Nintendo Game Boy Color

Measured from four 300 dpi images in `scans/gbc` (Mario Golf, Space Invaders, Winnie the Pooh; git-ignored) and the
fan-made `template.png`, all 276.0 × 116.0 mm. The case is the Game Boy's: the same DS-size case and the same wrap
(130 + 16 + 130 mm), so see §16 for why it is a case and not a box. The cartridge is the same 65.5 × 57 × 7.5 mm, and
[Retro Game Cases](https://www.retrogamecases.com/gameboy-gameboy-color-gameboy-advance/) sells one case for all three
Game Boys. It is `gbc` in `GAME_CASE` and `GAME_OUTER` (136 × 124 × 19 mm).

### Trade dress

The layout is the Game Boy's: a silver strip down the left of the front (25.2 % of its width, 0.2519) and a silver cap on
the top 28.6 % of the spine, nothing on the back. What differs:

- **The silver is paler and cooler**, and shaded in two directions at once (see "The silver" below), so it is a near-white base with overlaid shades, not a gradient. The scans are smooth, not streaked, so the Game Boy's `brushed` texture is **off** here.
- **No Nintendo oval.** The top of the strip holds the new multicolour **COLOR** logo, reading upwards, with GAME BOY in
  `#001497` below it: COLOR at 2.2–31.4 % of the strip's length, GAME BOY at 30.7–97.8 %, so the Y overlaps COLOR's C,
  as in the scans.
- **On the spine, GAME BOY and COLOR sit side by side**, both reading top to bottom: GAME BOY on the right at 2.2–15.7 %
  of the length, COLOR on the left at 5.5–25.9 %.

### The logo

`src/brands/svg/color.svg` is the COLOR word only (five letters in teal `#00938A`, purple `#4E4BA8`, green `#6EB122`,
red `#B80A41` and yellow `#DAAC06`), each with two inner shadows (see "SVG effects"), which give the puffy look. The
scans' colours are still brighter (cyan R, yellow `#f5e100`). Both lockups reuse `gb.svg` instead of a combined SVG: the engine places
the two logos as two marks, which lets each sit where the scans put it (the front has them in a row, the spine side by
side, with different sizes). GAME BOY is the Game Boy's wordmark, a little narrower than the Color box art's (the
scans' letters are about 20 % wider).

### SVG effects

`color.svg` has Figma inner-shadow filters (a white highlight and a dark shade, offset opposite ways) and `gamecube.svg`
paints four shapes with `mix-blend-mode: hue` at 0.4 opacity. macOS Preview and VS Code show them because they run a
full SVG renderer; the logo generator used to flatten every shape to a plain path and drop them, which is why the
letters were flat and the GameCube's cube was a flat blue-grey. It now carries three things per shape into
`logos.generated.ts`, and `paintLogoLayers` draws them wherever a logo is drawn (canvas, layers, export, 3D):

| From the SVG | Becomes | Drawn as |
| :--- | :--- | :--- |
| Figma drop or inner shadow (`feOffset` + `feGaussianBlur` + `feComposite` + `feColorMatrix`), or `feDropShadow` | `effects: [{ type, dx, dy, blur, color }]` | a drop shadow is the canvas shadow behind the shape. An inner shadow is a big frame round the shape, drawn out of sight with its shadow shifted back inside, clipped to the shape |
| `mix-blend-mode` | `blend` | the layer's composite operation. Blending acts on the logo's own layers only, so such a logo is drawn on a scratch canvas first and placed on the page (otherwise `hue` would tint the art behind it) |
| `fill-opacity` / `opacity` | `opacity` | the layer's alpha |

A flat (`mono`) logo has none of them. Not carried over: layer blurs, masks and filters other than shadows. The 3DS,
DS, Game Boy and other logos have no filters, so nothing else changed.

Separately, a **lockup** can carry its own `shadow` (colour, dx, dy mm): a flat copy faded in three offset steps, drawn
underneath, as editable layers. GAME BOY and COLOR use it (0.5 mm right, 0.55 mm down).

### The silver

One top-to-bottom gradient can't make this metal: the template is darker down the left edge in the top half and down the
right edge in the bottom half, with a crease between. Measured in 16 rows by 6 columns with the logos left out (median
of the unmarked pixels), the left edge goes from `#f1` to about `#c6` between 10 and 50 % down while the right stays
white, and below the crease the right edge darkens to `#c0` while the left is white again.

So the strip and cap are a pale base with **shades** laid over it (`shade` on a strip or cap: translucent gradients over
part of its length and width, drawn in order). The strip has five: the top half's dark left edge, a white one over its
lower end that fades the edge out through the crease, the bottom half's dark right edge, a white one over its upper end
that fades it in, and the soft foot. The white shades are what make the hard edges of the others disappear. The cap
mirrors it with its own four. The engine's radial gradients are circles, so a tall, narrow blob like the left shading
can't be one; the overlay of linear gradients stands in for it.

### Match

The app against the template is 89.2 % the same (the rest is the metal's shading and the letters' shadows). The
registered mark, the shadow under the letters and the ® next to GAME BOY are not drawn.
