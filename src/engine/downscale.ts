/** Reusable intermediate canvases, one per halving step, so a repaint does not allocate new backing stores each time. */
const scratch: HTMLCanvasElement[] = [];

function scratchAt(step: number, width: number, height: number): HTMLCanvasElement {
  const c = (scratch[step] ??= document.createElement('canvas'));
  if (c.width !== width || c.height !== height) {
    c.width = width;
    c.height = height;
  }
  return c;
}

/**
 * Draws `src` into `dst` at `dst`'s size. A large reduction is made in halving steps, because one big step from a
 * browser samples too few pixels and leaves jagged, shimmering edges.
 */
export function downscaleInto(src: HTMLCanvasElement, dst: HTMLCanvasElement): void {
  const ctx = dst.getContext('2d');
  if (!ctx || dst.width < 1 || dst.height < 1) return;
  let from: HTMLCanvasElement = src;
  for (let step = 0; from.width / 2 >= dst.width && from.height / 2 >= dst.height; step++) {
    const half = scratchAt(step, Math.floor(from.width / 2), Math.floor(from.height / 2));
    const h = half.getContext('2d');
    if (!h) break;
    h.clearRect(0, 0, half.width, half.height);
    h.imageSmoothingQuality = 'high';
    h.drawImage(from, 0, 0, half.width, half.height);
    from = half;
  }
  ctx.clearRect(0, 0, dst.width, dst.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(from, 0, 0, dst.width, dst.height);
}
