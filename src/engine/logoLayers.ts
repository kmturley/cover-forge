import { logoPaths2D, type Logo } from "../brands";

/**
 * Fills the chosen layers of a supplied logo with the origin at its source coordinates shifted by (dx, dy).
 * A layer without its own colour (or any layer when `mono`) takes `fill`.
 */
export function paintLogoLayers(
  ctx: CanvasRenderingContext2D,
  l: Logo,
  used: number[],
  dx: number,
  dy: number,
  fill: string,
  mono: boolean,
): void {
  const paths = logoPaths2D(l);
  used.forEach((i) => {
    const layer = l.layers[i];
    ctx.save();
    ctx.translate(dx + layer.offset[0], dy + layer.offset[1]);
    if (layer.fill !== "none") {
      ctx.fillStyle = mono || !layer.fill ? fill : layer.fill;
      const grad = layer.gradient && !mono ? layer.gradient : undefined;
      let shape = paths[i];
      if (grad) {
        let g: CanvasGradient;
        ctx.save();
        if (grad.radial) {
          // A radial gradient is the unit circle under a matrix, so the layer is drawn through its inverse.
          const [a, b, c, d, e, f] = grad.radial;
          const det = a * d - b * c;
          const inv = {
            a: d / det,
            b: -b / det,
            c: -c / det,
            d: a / det,
            e: (c * f - d * e) / det,
            f: (b * e - a * f) / det,
          };
          ctx.transform(a, b, c, d, e, f);
          g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          shape = new Path2D();
          shape.addPath(paths[i], inv as unknown as DOMMatrix);
        } else {
          const [x1, y1, x2, y2] = grad.line!;
          g = ctx.createLinearGradient(x1, y1, x2, y2);
        }
        for (const [at, color] of grad.stops)
          g.addColorStop(Math.min(1, Math.max(0, at)), color);
        ctx.fillStyle = g;
        ctx.fill(shape, l.evenodd ? "evenodd" : "nonzero");
        ctx.restore();
      } else ctx.fill(shape, l.evenodd ? "evenodd" : "nonzero");
    }
    if (layer.stroke !== undefined) {
      ctx.strokeStyle = mono || !layer.stroke ? fill : layer.stroke;
      ctx.lineWidth = layer.strokeWidth ?? 1;
      ctx.lineCap = layer.strokeCap ?? "butt";
      ctx.stroke(paths[i]);
    }
    ctx.restore();
  });
}
