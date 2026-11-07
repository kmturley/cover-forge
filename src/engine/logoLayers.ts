import { logoPaths2D, type Logo, type LogoLayer } from "../brands";

type Scratch = (w: number, h: number) => CanvasRenderingContext2D | null;
let makeScratch: Scratch | null = null;

/** Where a blended logo is drawn on its own first (Node has no canvas of its own; a browser needs nothing). */
export function setScratchCanvas(f: Scratch | null): void {
  makeScratch = f;
}

function scratch(w: number, h: number): CanvasRenderingContext2D | null {
  if (makeScratch) return makeScratch(w, h);
  if (typeof OffscreenCanvas !== "undefined")
    return new OffscreenCanvas(w, h).getContext("2d") as unknown as CanvasRenderingContext2D | null;
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c.getContext("2d");
  }
  return null;
}

/** The largest scratch canvas a blended logo gets; a bigger one is drawn without blending. */
const MAX_SCRATCH = 8192;

type Effect = NonNullable<LogoLayer["effects"]>[number];

/** A canvas shadow for the effect under the current transform (canvas shadows are in device pixels), shifted by (extraX, extraY) device px. */
function setShadow(ctx: CanvasRenderingContext2D, e: Effect, extraX = 0, extraY = 0): void {
  const m = ctx.getTransform();
  const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 2 * e.blur * scale;
  ctx.shadowOffsetX = m.a * e.dx + m.c * e.dy + extraX;
  ctx.shadowOffsetY = m.b * e.dx + m.d * e.dy + extraY;
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * An inner shadow: the shape's surroundings, offset and blurred, seen only inside the shape. The surroundings are a big
 * frame round it, drawn out of sight with their shadow shifted back into place, so that only the shadow is clipped in.
 */
function innerShadow(ctx: CanvasRenderingContext2D, shape: Path2D, rule: CanvasFillRule, layer: LogoLayer, e: Effect): void {
  const [x0, y0, x1, y1] = [layer.box[0] - layer.offset[0], layer.box[1] - layer.offset[1], layer.box[2] - layer.offset[0], layer.box[3] - layer.offset[1]];
  const pad = 3 * e.blur + Math.abs(e.dx) + Math.abs(e.dy) + 1;
  const [w, h] = [x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
  const away = 2 * w;
  const frame = new Path2D();
  frame.rect(x0 - pad, y0 - pad, w, h);
  frame.addPath(shape);
  const m = ctx.getTransform();
  ctx.save();
  ctx.clip(shape, rule);
  setShadow(ctx, e, m.a * away, m.b * away);
  ctx.translate(-away, 0);
  ctx.fillStyle = "#000";
  ctx.fill(frame, "evenodd");
  ctx.restore();
}

function paintLayer(ctx: CanvasRenderingContext2D, l: Logo, layer: LogoLayer, shape: Path2D, dx: number, dy: number, fill: string, mono: boolean): void {
  const rule: CanvasFillRule = l.evenodd ? "evenodd" : "nonzero";
  ctx.save();
  ctx.translate(dx + layer.offset[0], dy + layer.offset[1]);
  if (layer.opacity !== undefined && layer.opacity < 1) ctx.globalAlpha *= layer.opacity;
  if (layer.blend && !mono) ctx.globalCompositeOperation = layer.blend as GlobalCompositeOperation;
  const effects = mono ? [] : (layer.effects ?? []);
  if (layer.fill !== "none") {
    ctx.fillStyle = mono || !layer.fill ? fill : layer.fill;
    const grad = layer.gradient && !mono ? layer.gradient : undefined;
    const drop = effects.find((e) => e.type === "drop");
    if (drop) setShadow(ctx, drop);
    if (grad) {
      let g: CanvasGradient;
      let path = shape;
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
        // The shadow is set under the layer's own transform, so it is worked out before the gradient's.
        ctx.transform(a, b, c, d, e, f);
        g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        path = new Path2D();
        path.addPath(shape, inv as unknown as DOMMatrix);
      } else {
        const [x1, y1, x2, y2] = grad.line!;
        g = ctx.createLinearGradient(x1, y1, x2, y2);
      }
      for (const [at, color] of grad.stops)
        g.addColorStop(Math.min(1, Math.max(0, at)), color);
      ctx.fillStyle = g;
      ctx.fill(path, rule);
      ctx.restore();
    } else ctx.fill(shape, rule);
    if (drop) clearShadow(ctx);
  }
  if (layer.stroke !== undefined) {
    ctx.strokeStyle = mono || !layer.stroke ? fill : layer.stroke;
    ctx.lineWidth = layer.strokeWidth ?? 1;
    ctx.lineCap = layer.strokeCap ?? "butt";
    ctx.stroke(shape);
  }
  for (const e of effects) if (e.type === "inner") innerShadow(ctx, shape, rule, layer, e);
  ctx.restore();
}

function paintAll(ctx: CanvasRenderingContext2D, l: Logo, used: number[], dx: number, dy: number, fill: string, mono: boolean): void {
  const paths = logoPaths2D(l);
  for (const i of used) paintLayer(ctx, l, l.layers[i], paths[i], dx, dy, fill, mono);
}

/**
 * Fills the chosen layers of a supplied logo with the origin at its source coordinates shifted by (dx, dy).
 * A layer without its own colour (or any layer when `mono`) takes `fill`. A layer's shadows, blend mode and opacity
 * carry over from the source file; a flat (`mono`) logo has none. Blend modes act only on the logo's own layers, so a
 * logo with one is drawn on a scratch canvas first and that is placed on the page.
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
  if (!mono && used.some((i) => l.layers[i].blend)) {
    const m = ctx.getTransform();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const i of used) {
      const [bx0, by0, bx1, by1] = l.layers[i].box;
      for (const [x, y] of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) {
        xs.push(m.a * (x + dx) + m.c * (y + dy) + m.e);
        ys.push(m.b * (x + dx) + m.d * (y + dy) + m.f);
      }
    }
    const [x0, y0] = [Math.floor(Math.min(...xs)) - 2, Math.floor(Math.min(...ys)) - 2];
    const [w, h] = [Math.ceil(Math.max(...xs)) + 2 - x0, Math.ceil(Math.max(...ys)) + 2 - y0];
    const sc = w > 0 && h > 0 && w <= MAX_SCRATCH && h <= MAX_SCRATCH ? scratch(w, h) : null;
    if (sc) {
      sc.setTransform(1, 0, 0, 1, -x0, -y0);
      sc.transform(m.a, m.b, m.c, m.d, m.e, m.f);
      paintAll(sc, l, used, dx, dy, fill, mono);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sc.canvas as unknown as CanvasImageSource, x0, y0);
      ctx.restore();
      return;
    }
  }
  paintAll(ctx, l, used, dx, dy, fill, mono);
}
