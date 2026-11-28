# Scans needed

Where more scans would settle the branding measurements. Worked out from `scans-report.md` and `branding-spec.md`
on 2026-11-27, when each platform had 3 scans and 1 fan template.

Scans are only used for where the branding sits and its colours; sizes come from each case's documented standard (see
`sizing-audit.md`, step 1). A value counts once **at least two images agree** within 1 percentage point. So more
examples do two things: they confirm the values, and they outvote recreations, crops and altered images, which then
show up as outliers you can remove.

## What makes a scan useful

- **A full wrap, trimmed at the cut line.** Back, spine and front in one image, with no table, border or bleed round it
  (or say how much bleed it has).
- **Straight, not cropped into the art.** An image whose proportions are more than 3 % off the standard is flagged and
  not counted.
- **Any resolution.** It is stretched to the standard size first, so the DPI tag doesn't matter. Higher is better for
  small logos.
- **Region and year in the file name**, for example `ps2-us-2003-<title>.jpg`. Several platforms changed their dress
  over time or by region (see below). The measuring doesn't group by these yet, but it will need to.
- **Five or more per platform** is a good target. Three agreeing out of five is much stronger than two out of three.

Put them in `scans/<platform>/` as now. A scan to leave out, or one with bleed, goes in `scripts/scan-manifest.json`.

## Priority 1: can't decide yet

| Platform | Problem | What would help |
| :--- | :--- | :--- |
| **Xbox Series X** | All 3 scans are 5 % taller in proportion than the standard (266 × 156 mm against 266 × 149), so none count. | 3+ more full wraps, and ideally a ruler measurement of a real insert. If they're all 156 tall, the standard is wrong. |
| **PS1** | 2 of 3 scans are 3.2 % off the standard and have a much narrower strip (about 10 % of the front against 15.5 %). Only 1 scan and the template count. | 4+ more, with the year. They are probably two print runs (a narrower strip on later or Greatest Hits releases?) or two layouts of the tray card and booklet. |
| **PC (DVD case)** | No scans at all. | 5 PC game wraps in DVD cases, with the year: the header's tab may differ between eras. |
| **3DS** | The front header disagrees completely: band width 11–100 %, height 14–31 %. | 6+, labelled by region. US and EU 3DS covers use different headers. |
| **GameCube** | Front band height splits 7–9 % against 21–24 %; the spine band is 9 % against 31 %. | 6+, with region and year. Probably two dress styles. |
| **Game Boy** | Front band height ranges 4–30 %. | 6+ of the boxed DS-size reprints that the app's template targets, not the original cardboard boxes. |
| **Xbox One** | Front band height 10–33 % and logos disagree. | 6+, with the year: the early green band and the later layout differ. |

## Priority 2: agreed, but only by two

These have consensus from just 2 images, or the spine logo disagrees. 2 or 3 more each would confirm them.

| Platform | Weak or missing values |
| :--- | :--- |
| **SNES** | Front band width and x; spine band height; spine logo size and position (logo width 80–94 % of the spine). |
| **Xbox** | Front band height; front logos (logo 1 width 30–48 %); spine logo position. |
| **Wii U** | Front band border; front logo x; spine band and logo. |
| **Wii** | Spine band height; spine logo size and position. |
| **GBA** | Front band height; spine band height. |
| **PS2** | Spine band (one scan full-length black, one 28 %); spine logo. |
| **PS3** | Second front logo (width 31–48 %); spine logo. |
| **Xbox 360** | Spine logo size and position; front logo width (one scan reads 94 %). |
| **Switch 2** | Spine band height; spine logo. |
| **PS4, PS5, PS Vita, DS, NES, GBC, Switch** | Mostly agreed. The spine logo's position or the thin band border has only 2 readings. 2 more each would do. |

## Not needed yet

- **Atari, Genesis, Master System, Mega Drive, N64:** the folders hold only a fan template, and the app has no case for
  them, so there is no standard to fit to. Scans become useful if those cases are added.
- **CD, DVD and Blu-ray (films and music):** the app prints no platform branding on these.
