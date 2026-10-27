import { describe, expect, it } from 'vitest';
import { boundsOf, circlePoints, clipPolygon, colorAt, formatColor, isRect, parseColor, quadPoints, remapStops, simplify, type Pt } from './geometry';

describe('simplify', () => {
  it('drops points on a straight run and keeps the corners', () => {
    const line: Pt[] = Array.from({ length: 50 }, (_, i) => [i, 0]);
    expect(simplify(line, 0.01)).toEqual([[0, 0], [49, 0]]);
    const l: Pt[] = [...Array.from({ length: 10 }, (_, i) => [i, 0] as Pt), ...Array.from({ length: 10 }, (_, i) => [9, i + 1] as Pt)];
    expect(simplify(l, 0.01)).toEqual([[0, 0], [9, 0], [9, 10]]);
  });
  it('keeps a curve to within the tolerance', () => {
    const curve = quadPoints([0, 0], [50, 100], [100, 0], 200);
    const out = simplify(curve, 0.2);
    expect(out.length).toBeLessThan(40);
    expect(out.length).toBeGreaterThan(5);
  });
  it('leaves two points alone', () => {
    expect(simplify([[0, 0], [1, 1]], 1)).toEqual([[0, 0], [1, 1]]);
  });
});

describe('clipPolygon', () => {
  const r = { x0: 0, y0: 0, x1: 10, y1: 10 };
  it('keeps what is inside, whole', () => {
    const sq: Pt[] = [[2, 2], [8, 2], [8, 8], [2, 8]];
    expect(clipPolygon(sq, r)).toEqual(sq);
  });
  it('cuts what pokes out', () => {
    const b = boundsOf(clipPolygon([[-5, -5], [5, -5], [5, 5], [-5, 5]], r));
    expect(b).toEqual({ x0: 0, y0: 0, x1: 5, y1: 5 });
  });
  it('is empty when nothing is inside', () => {
    expect(clipPolygon([[20, 20], [30, 20], [30, 30]], r)).toEqual([]);
  });
  it('cuts a circle to the part inside', () => {
    const b = boundsOf(clipPolygon(circlePoints(10, 5, 8), r));
    expect(b.x1).toBeCloseTo(10);
    expect(b.x0).toBeGreaterThan(1.9);
    expect(b.y0).toBeCloseTo(0);
    expect(b.y1).toBeCloseTo(10);
  });
});

describe('isRect', () => {
  it('recognises the four corners, with or without the closing point', () => {
    expect(isRect([[0, 0], [5, 0], [5, 2], [0, 2]], 1e-6)).toBe(true);
    expect(isRect([[0, 0], [5, 0], [5, 2], [0, 2], [0, 0]], 1e-6)).toBe(true);
  });
  it('is not fooled by a slanted edge or another count', () => {
    expect(isRect([[0, 0], [5, 0], [4, 2], [0, 2]], 1e-6)).toBe(false);
    expect(isRect([[0, 0], [5, 0], [5, 2]], 1e-6)).toBe(false);
  });
});

describe('colours and gradients', () => {
  it('parses and formats the colours the dress uses', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('#1d2671')).toEqual([29, 38, 113, 1]);
    expect(parseColor('rgba(255,255,255,0.15)')).toEqual([255, 255, 255, 0.15]);
    expect(parseColor('#ffffff80')[3]).toBeCloseTo(0.502, 2);
    expect(formatColor([29, 38, 113, 1])).toBe('#1d2671');
    expect(formatColor([255, 255, 255, 0.15])).toBe('rgba(255,255,255,0.15)');
  });
  it('finds the colour at an offset, holding the ends', () => {
    const stops: [number, string][] = [[0, '#000000'], [1, '#ffffff']];
    expect(colorAt(stops, 0.5)).toBe('#808080');
    expect(colorAt(stops, -3)).toBe('#000000');
    expect(colorAt(stops, 7)).toBe('#ffffff');
  });
  it('re-expresses a gradient for a box inside it', () => {
    // 0–100 black to white; a box over 25–75 sees 25% grey to 75% grey.
    const out = remapStops([[0, '#000000'], [1, '#ffffff']], 0, 100, 25, 75);
    expect(out).toEqual([[0, '#404040'], [1, '#bfbfbf']]);
  });
  it('keeps the stops that fall inside the box, moved, and cuts the rest', () => {
    const out = remapStops([[0, '#ff0000'], [0.5, '#00ff00'], [1, '#0000ff']], 0, 100, 0, 50);
    expect(out[0]).toEqual([0, '#ff0000']);
    expect(out.at(-1)).toEqual([1, '#00ff00']);
    expect(out).toHaveLength(2);
    const wide = remapStops([[0, '#ff0000'], [1, '#0000ff']], 20, 40, 0, 100);
    expect(wide[0]).toEqual([0, '#ff0000']);
    expect(wide.at(-1)).toEqual([1, '#0000ff']);
    expect(wide.some(([t]) => Math.abs(t - 0.2) < 1e-3)).toBe(true);
    expect(wide.some(([t]) => Math.abs(t - 0.4) < 1e-3)).toBe(true);
  });
});
