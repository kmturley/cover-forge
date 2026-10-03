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

