import type { PanelBox } from '../../types/editor';
import type { Axis, Placement, Size } from '../../types/layers';

/** A panel's size in mm; the percent axes are measured against it. */
export interface PanelSize {
  widthMm: number;
  heightMm: number;
}

const lengthOf = (a: Axis, whole: number): Size | undefined => (a.anchor === 'stretch' ? whole - a.start - a.end : a.size);

/** The range an axis covers, in percent from the start edge. `size` is the resolved length (never 'auto'). */
function range(a: Axis, size: number): [number, number] {
  switch (a.anchor) {
    case 'start':
      return [a.offset, a.offset + size];
    case 'center':
      return [a.offset - size / 2, a.offset + size / 2];
    case 'end':
      return [100 - a.offset - size, 100 - a.offset];
    case 'stretch':
      return [a.start, 100 - a.end];
  }
}

/**
 * The percent box an anchored placement covers on a panel: what the drawing code takes. `aspect` (width / height) is
 * the content's, used when a size is 'auto'. An auto size takes its length from the other axis through the panel's real
 * size, because a percent of the width and a percent of the height are different lengths in mm. Both axes auto, or no
 * aspect given, count as the whole panel along the auto axis.
 */
export function placementToBox(panel: PanelSize, p: Placement, aspect?: number): PanelBox {
  const xSize = lengthOf(p.x, 100);
  const ySize = lengthOf(p.y, 100);
  const ok = aspect !== undefined && Number.isFinite(aspect) && aspect > 0;
  let xLen = xSize === 'auto' ? undefined : xSize;
  let yLen = ySize === 'auto' ? undefined : ySize;
  if (xLen === undefined && yLen === undefined) {
    xLen = 100;
    yLen = 100;
  } else if (xLen === undefined) {
    xLen = ok ? (((yLen as number) / 100) * panel.heightMm * (aspect as number) * 100) / panel.widthMm : 100;
  } else if (yLen === undefined) {
    yLen = ok ? (((xLen as number) / 100) * panel.widthMm * 100) / ((aspect as number) * panel.heightMm) : 100;
  }
  const [xStart, xEnd] = range(p.x, xLen);
  const [yStart, yEnd] = range(p.y, yLen as number);
  return { xStart, xEnd, yStart, yEnd };
}

/** The placement of a PanelBox: stretched between its edges on both axes (every older box migrates to this). */
export function boxToPlacement(b: PanelBox): Placement {
  return { x: { anchor: 'stretch', start: b.xStart, end: 100 - b.xEnd }, y: { anchor: 'stretch', start: b.yStart, end: 100 - b.yEnd } };
}
