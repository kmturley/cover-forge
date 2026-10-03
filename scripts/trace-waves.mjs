// Traces src/brands/svg/xbox360-waves.png (the Xbox 360 swooshes) into vector bands: src/engine/x360Waves.generated.ts.
// The canvas renderer is synchronous and has no bitmap decoder in Node, so the swooshes are drawn from shapes instead.
// Each colour boundary is followed down the image as a curve; a band is everything to the right of its boundary,
// painted left to right so later bands cover earlier ones. Run with `node scripts/trace-waves.mjs`.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const { data, info } = await sharp(fileURLToPath(new URL('../src/brands/svg/xbox360-waves.png', import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x, y) => [0, 1, 2].map((k) => data[(y * W + x) * 4 + k]);
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const JUMP = 9;
const GAP = 12; // rows a boundary may go undetected (weak contrast) before it counts as ended
const MIN_RUN = 3;

/** Boundaries (x positions) and the colour just right of each, for one row. A run of 1-2 pixels is an anti-aliased edge, not a band. */
function rowEdges(y) {
  const runs = [];
  let start = 0;
  for (let x = 1; x <= W; x++) {
    const jump = x === W || Math.max(...px(x, y).map((v, k) => Math.abs(v - px(x - 1, y)[k]))) > JUMP;
    if (jump) {
      runs.push([start, x - 1]);
      start = x;
    }
  }
  const real = runs.filter(([a, b]) => b - a + 1 >= MIN_RUN);
  return real.slice(1).map(([a], i) => {
    const left = real[i];
    const x = (left[1] + a) / 2 + 0.5;
    const [l, r] = [px(Math.max(0, Math.round(a - 4)), y), px(Math.min(W - 1, Math.round(a + 4)), y)];
    return { x, color: px(Math.min(W - 1, Math.round((a + (real[i + 2]?.[0] ?? W)) / 2 - 0.5)), y), delta: Math.max(...l.map((v, k) => Math.abs(v - r[k]))) };
  });
}

// Follow boundaries down the rows, matching each to the nearest track within a few pixels.
const tracks = [];
for (let y = 0; y < H; y++) {
  const open = tracks.filter((t) => y - t.last <= GAP);
  for (const e of rowEdges(y)) {
    const reach = (t) => 5 + (y - t.last) * 0.6;
    const near = open.filter((t) => !t.taken && Math.abs(t.pts.at(-1)[0] - e.x) <= reach(t)).sort((a, b) => Math.abs(a.pts.at(-1)[0] - e.x) - Math.abs(b.pts.at(-1)[0] - e.x))[0];
    if (near) {
      near.pts.push([e.x, y]);
      near.colors.push(e.color);
      near.deltas.push(e.delta);
      near.last = y;
      near.taken = true;
    } else tracks.push({ pts: [[e.x, y]], colors: [e.color], deltas: [e.delta], last: y, taken: true });
  }
  for (const t of tracks) t.taken = false;
}

// Keep tracks that run for a while, smooth them, and describe each by a few points and colours.
const STEP = 8;
// A seam inside a band (its own shading) has little contrast across it; a real edge between two bands has a lot.
const median = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
const keep = tracks.filter((t) => t.pts.length >= 14 && median(t.deltas) >= (t.pts.length < 200 ? 30 : 20));
const xAt = (pts, y) => {
  const i = Math.max(1, pts.findIndex((p) => p[1] >= y));
  const [a, b] = [pts[i - 1], pts[i] ?? pts[i - 1]];
  return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1);
};
const bands = keep
  .map((t) => {
    const pts = [];
    for (let i = 0; i < t.pts.length; i += STEP) {
      const win = t.pts.slice(Math.max(0, i - 3), i + 4);
      pts.push([win.reduce((s, p) => s + p[0], 0) / win.length, t.pts[i][1]]);
    }
    const lastPt = t.pts.at(-1);
    if (pts.at(-1)[1] !== lastPt[1]) pts.push(lastPt);
    // The colour right of the boundary every ~10 rows, as gradient stops along the rows it spans.
    const stops = [];
    const n = t.colors.length;
    for (let i = 0; i < n; i += 10) stops.push([Math.round((i / Math.max(1, n - 1)) * 1000) / 1000, hex(t.colors[i])]);
    if (stops.at(-1)[0] < 1) stops.push([1, hex(t.colors[n - 1])]);
    return { pts: pts.map(([x, y]) => [Math.round(x * 10) / 10, y]), stops };
  })
  // Paint order is left to right: by where each boundary's straight-line fit crosses the middle row.
  .map((band) => {
    const n = band.pts.length;
    const [mx, my] = [band.pts.reduce((m, p) => m + p[0], 0) / n, band.pts.reduce((m, p) => m + p[1], 0) / n];
    const slope = band.pts.reduce((m, p) => m + (p[0] - mx) * (p[1] - my), 0) / (band.pts.reduce((m, p) => m + (p[1] - my) ** 2, 0) || 1);
    return { band, key: mx + slope * (H / 2 - my) };
  })
  .sort((a, b) => a.key - b.key)
  .map(({ band }) => band);

// Each band spans from its own boundary to the nearest boundary on its right, row by row, so no band has to be
// painted over another and a boundary that fades out leaves its neighbour to fill the gap.
const ROW = 2;
const covers = (b, y) => y >= b.pts[0][1] && y <= b.pts.at(-1)[1];
const shapes = bands.map((band) => {
  const left = [];
  const right = [];
  const [y0, y1] = [band.pts[0][1], band.pts.at(-1)[1]];
  for (let y = y0; y <= y1; y = y === y1 ? y1 + 1 : Math.min(y1, y + ROW)) {
    const x = xAt(band.pts, y);
    const next = bands.filter((o) => o !== band && covers(o, y)).map((o) => xAt(o.pts, y)).filter((ox) => ox > x + 0.5).sort((p, q) => p - q)[0];
    left.push([Math.round(x * 10) / 10, y]);
    right.push([Math.round((next ?? W + 40) * 10) / 10, y]);
  }
  return { left, right, stops: band.stops };
});

writeFileSync(
  new URL('../src/engine/x360Waves.generated.ts', import.meta.url),
  `// GENERATED by scripts/trace-waves.mjs from src/brands/svg/xbox360-waves.png. Do not edit by hand.\n// ${W}x${H} px. Each band lies between a left and a right edge (top to bottom) and is filled with a vertical gradient.\n\nexport const X360_WAVES_SIZE = { w: ${W}, h: ${H} };\n\nexport const X360_WAVES: { left: [number, number][]; right: [number, number][]; stops: [number, string][] }[] = ${JSON.stringify(shapes)};\n`,
);
console.log(`${shapes.length} bands`);
if (process.env.DEBUG) for (const t of tracks) console.log(t.pts.length, 'rows', t.pts[0][1], '-', t.last, 'x', t.pts[0][0], '->', t.pts.at(-1)[0], 'delta', median(t.deltas), 'keep', keep.includes(t));
