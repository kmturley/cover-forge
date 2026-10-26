import type { Stops } from '../../types/layers';

export type Pt = [number, number];

/** Douglas–Peucker: the polyline with points that sit within `eps` of the line between their neighbours dropped. */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    let far = -1;
    let dist = eps;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > dist) {
        dist = d;
        far = i;
      }
    }
    if (far !== -1) {
      keep[far] = true;
      stack.push([a, far], [far, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A polygon cut to a rectangle (Sutherland–Hodgman). Empty when nothing is left. */
export function clipPolygon(pts: Pt[], r: { x0: number; y0: number; x1: number; y1: number }): Pt[] {
  type Edge = { inside: (p: Pt) => boolean; cut: (a: Pt, b: Pt) => Pt };
  const edges: Edge[] = [
    { inside: (p) => p[0] >= r.x0, cut: (a, b) => [r.x0, a[1] + ((b[1] - a[1]) * (r.x0 - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= r.x1, cut: (a, b) => [r.x1, a[1] + ((b[1] - a[1]) * (r.x1 - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= r.y0, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (r.y0 - a[1])) / (b[1] - a[1]), r.y0] },
    { inside: (p) => p[1] <= r.y1, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (r.y1 - a[1])) / (b[1] - a[1]), r.y1] },
  ];
  let out = pts;
  for (const e of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const [cur, prev] = [input[i], input[(i + input.length - 1) % input.length]];
      if (e.inside(cur)) {
        if (!e.inside(prev)) out.push(e.cut(prev, cur));
        out.push(cur);
      } else if (e.inside(prev)) out.push(e.cut(prev, cur));
    }
    if (out.length === 0) return [];
  }
  return out;
}

export const boundsOf = (pts: Pt[]) => ({ x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) });

/** True when the polygon is just an axis-aligned rectangle (its corners, in order, with nothing between). */
export function isRect(pts: Pt[], eps: number): boolean {
  const p = pts.length > 1 && Math.hypot(pts[0][0] - pts.at(-1)![0], pts[0][1] - pts.at(-1)![1]) < eps ? pts.slice(0, -1) : pts;
  if (p.length !== 4) return false;
  return p.every((a, i) => {
    const b = p[(i + 1) % 4];
    return Math.abs(a[0] - b[0]) < eps || Math.abs(a[1] - b[1]) < eps;
  });
}

/** `n` points round a circle. */
export const circlePoints = (cx: number, cy: number, r: number, n = 72): Pt[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)] as Pt);

/** Points along a quadratic curve, excluding its start. */
export const quadPoints = (a: Pt, c: Pt, b: Pt, n = 16): Pt[] => Array.from({ length: n }, (_, i) => {
  const t = (i + 1) / n;
  return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]] as Pt;
});

// ——— Colour and gradients ———

type Rgba = [number, number, number, number];

/** A CSS colour (#rgb, #rrggbb, #rrggbbaa, rgb() or rgba()) as [r, g, b, a]; black for anything else. */
export function parseColor(c: string): Rgba {
  const s = c.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)).concat(1) as Rgba;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1];
  const f = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (f) return [Number(f[1]), Number(f[2]), Number(f[3]), f[4] === undefined ? 1 : f[4].endsWith('%') ? parseFloat(f[4]) / 100 : Number(f[4])];
  return [0, 0, 0, 1];
}

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/** The colour as the shortest string that keeps it: #rrggbb when opaque, rgba() otherwise. */
export function formatColor([r, g, b, a]: Rgba): string {
  return a >= 0.999 ? `#${hex2(r)}${hex2(g)}${hex2(b)}` : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Number(a.toFixed(3))})`;
}

/** The colour of a gradient at offset `o`, holding the end colours beyond its ends (as a canvas does). */
export function colorAt(stops: Stops, o: number): string {
  const s = [...stops].sort((a, b) => a[0] - b[0]);
  if (o <= s[0][0]) return s[0][1];
  if (o >= s[s.length - 1][0]) return s[s.length - 1][1];
  const i = s.findIndex((st) => st[0] >= o);
  const [[o0, c0], [o1, c1]] = [s[i - 1], s[i]];
  const t = o1 === o0 ? 0 : (o - o0) / (o1 - o0);
  const [a, b] = [parseColor(c0), parseColor(c1)];
  return formatColor(a.map((v, k) => v + (b[k] - v) * t) as Rgba);
}

/**
 * The same gradient seen from a smaller or larger box: a gradient running from `g0` to `g1` along an axis, as stops for
 * a box spanning `b0` to `b1` on that axis. Stops outside the box are dropped and the ends take the colour the gradient has there.
 */
export function remapStops(stops: Stops, g0: number, g1: number, b0: number, b1: number): Stops {
  const span = b1 - b0;
  if (span <= 0 || g1 === g0) return [[0, colorAt(stops, 0)], [1, colorAt(stops, 1)]];
  const offsetAt = (pos: number) => (pos - g0) / (g1 - g0);
  const out: Stops = [[0, colorAt(stops, offsetAt(b0))]];
  for (const [o, c] of [...stops].sort((a, b) => a[0] - b[0])) {
    const t = (g0 + o * (g1 - g0) - b0) / span;
    if (t > 1e-6 && t < 1 - 1e-6) out.push([Number(t.toFixed(4)), c]);
  }
  out.push([1, colorAt(stops, offsetAt(b1))]);
  return out;
}
