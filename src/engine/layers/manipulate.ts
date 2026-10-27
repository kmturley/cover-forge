import type { PanelRect } from '../../types/template';
import type { Layer, LayerPlacement, Placement } from '../../types/layers';
import { rectToBox, type RectMm } from '../box';
import { axisFromRange, boxRange, placementOfBox } from './placement';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** The smallest a layer can be dragged to, in mm. */
export const MIN_SIZE_MM = 1;

/**
 * A rectangle dragged by one of its handles by (dx, dy) mm. With `aspect` (width / height) a corner keeps the shape and
 * is dragged by whichever of the two moved further; an edge handle always moves just that edge. The opposite
 * corner or edge stays put, and a box is never smaller than MIN_SIZE_MM or turned inside out.
 */
export function resizeRect(start: RectMm, handle: Handle, dx: number, dy: number, aspect?: number): RectMm {
  let [x0, y0, x1, y1] = [start.xMm, start.yMm, start.xMm + start.widthMm, start.yMm + start.heightMm];
  if (handle.includes('w')) x0 += dx;
  if (handle.includes('e')) x1 += dx;
  if (handle.includes('n')) y0 += dy;
  if (handle.includes('s')) y1 += dy;
  const corner = handle.length === 2;
  if (corner && aspect) {
    const w = Math.max(MIN_SIZE_MM, x1 - x0);
    const h = Math.max(MIN_SIZE_MM, y1 - y0);
    // The corner follows the larger change, so the box grows or shrinks smoothly under the pointer.
    const scale = Math.max(w / start.widthMm, h / start.heightMm);
    const nw = Math.max(MIN_SIZE_MM, start.widthMm * scale);
    const nh = nw / aspect;
    if (handle.includes('w')) x0 = x1 - nw;
    else x1 = x0 + nw;
    if (handle.includes('n')) y0 = y1 - nh;
    else y1 = y0 + nh;
  }
  if (x1 - x0 < MIN_SIZE_MM) {
    if (handle.includes('w')) x0 = x1 - MIN_SIZE_MM;
    else x1 = x0 + MIN_SIZE_MM;
  }
  if (y1 - y0 < MIN_SIZE_MM) {
    if (handle.includes('n')) y0 = y1 - MIN_SIZE_MM;
    else y1 = y0 + MIN_SIZE_MM;
  }
  return { xMm: x0, yMm: y0, widthMm: x1 - x0, heightMm: y1 - y0 };
}

export const moveRect = (r: RectMm, dx: number, dy: number): RectMm => ({ ...r, xMm: r.xMm + dx, yMm: r.yMm + dy });

/** A line a dragged box snapped to, in canvas mm. */
export interface Guide {
  axis: 'x' | 'y';
  at: number;
}

export interface SnapTargets {
  xs: number[];
  ys: number[];
}

/** Which of a box's lines may snap: everything while moving, only the edges being dragged while resizing. */
export interface SnapSides {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  /** The centre lines (only when the whole box moves). */
  centre: boolean;
}

export const MOVING: SnapSides = { left: true, right: true, top: true, bottom: true, centre: true };

export const sidesOf = (h: Handle): SnapSides => ({ left: h.includes('w'), right: h.includes('e'), top: h.includes('n'), bottom: h.includes('s'), centre: false });

/** The lines worth snapping to on a panel: its edges and middle, a safe margin in from the edges, and other layers' edges and middles. */
export function snapTargets(panel: PanelRect, others: readonly RectMm[], safeMm: number): SnapTargets {
  const xs = [panel.xMm, panel.xMm + panel.widthMm / 2, panel.xMm + panel.widthMm, panel.xMm + safeMm, panel.xMm + panel.widthMm - safeMm];
  const ys = [panel.yMm, panel.yMm + panel.heightMm / 2, panel.yMm + panel.heightMm, panel.yMm + safeMm, panel.yMm + panel.heightMm - safeMm];
  for (const r of others) {
    xs.push(r.xMm, r.xMm + r.widthMm / 2, r.xMm + r.widthMm);
    ys.push(r.yMm, r.yMm + r.heightMm / 2, r.yMm + r.heightMm);
  }
  return { xs, ys };
}

function nearest(values: number[], targets: number[], within: number): { shift: number; at: number } | null {
  let best: { shift: number; at: number } | null = null;
  for (const v of values) {
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= within && (!best || Math.abs(d) < Math.abs(best.shift))) best = { shift: d, at: t };
    }
  }
  return best;
}

/**
 * Pulls a box onto the nearest target line within `within` mm. A move shifts the whole box; a resize shifts only the
 * edge being dragged (with `keep` aspect a corner can't be pulled, so it isn't). Returns the guides it snapped to.
 */
export function snapRect(r: RectMm, sides: SnapSides, t: SnapTargets, within: number, move: boolean): { rect: RectMm; guides: Guide[] } {
  const [l, c, rt] = [r.xMm, r.xMm + r.widthMm / 2, r.xMm + r.widthMm];
  const [tp, m, b] = [r.yMm, r.yMm + r.heightMm / 2, r.yMm + r.heightMm];
  const xs = [...(sides.left ? [l] : []), ...(sides.centre ? [c] : []), ...(sides.right ? [rt] : [])];
  const ys = [...(sides.top ? [tp] : []), ...(sides.centre ? [m] : []), ...(sides.bottom ? [b] : [])];
  const sx = nearest(xs, t.xs, within);
  const sy = nearest(ys, t.ys, within);
  const guides: Guide[] = [];
  let [x0, y0, x1, y1] = [l, tp, rt, b];
  if (sx) {
    guides.push({ axis: 'x', at: sx.at });
    if (move) [x0, x1] = [x0 + sx.shift, x1 + sx.shift];
    else if (sides.left) x0 += sx.shift;
    else x1 += sx.shift;
  }
  if (sy) {
    guides.push({ axis: 'y', at: sy.at });
    if (move) [y0, y1] = [y0 + sy.shift, y1 + sy.shift];
    else if (sides.top) y0 += sy.shift;
    else y1 += sy.shift;
  }
  return { rect: { xMm: x0, yMm: y0, widthMm: x1 - x0, heightMm: y1 - y0 }, guides };
}

/**
 * The placement that puts a layer at `rect`, keeping how it was anchored: a centred layer stays centred-anchored, a
 * right-anchored one stays right-anchored, and a length that follows the picture's shape stays that way unless that very
 * axis was resized. An automatic placement becomes one stretched between edges, which holds the box exactly.
 */
export function placementFromRect(panel: PanelRect, old: LayerPlacement, rect: RectMm, resized: { x: boolean; y: boolean }): Placement {
  const box = rectToBox(panel, rect);
  if (!old || !('x' in old)) return placementOfBox(box);
  const axis = (w: 'x' | 'y') => {
    const was = old[w];
    const auto = was.anchor !== 'stretch' && was.size === 'auto' && !resized[w];
    return axisFromRange(boxRange(box, w), was.anchor, auto ? 'auto' : undefined);
  };
  return { x: axis('x'), y: axis('y') };
}

/** Where a layer can be nudged to or dragged: only layers placed in a box, and only unrotated ones can be resized. */
export const canResize = (l: Layer): boolean => l.rotationDeg === 0 && (l.type !== 'text' || !l.textRotationDeg);
