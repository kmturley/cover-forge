import { logoPaths2D, type Logo, type LogoLayer } from "../brands";
import type { MarkEmboss, MarkShadow } from "../types/layers";

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

/** `page` means dx, dy and blur are already device pixels, whichever way the mark is turned. */
type Effect = NonNullable<LogoLayer["effects"]>[number] & { page?: boolean };

/** A canvas shadow for the effect under the current transform (canvas shadows are in device pixels), shifted by (extraX, extraY) device px. */
function setShadow(ctx: CanvasRenderingContext2D, e: Effect, extraX = 0, extraY = 0): void {
  const m = ctx.getTransform();
  const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 2 * e.blur * (e.page ? 1 : scale);
  ctx.shadowOffsetX = (e.page ? e.dx : m.a * e.dx + m.c * e.dy) + extraX;
  ctx.shadowOffsetY = (e.page ? e.dy : m.b * e.dx + m.d * e.dy) + extraY;
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
  // A page effect's sizes are device pixels; the frame round the shape is in the layer's own units.
  const k = e.page ? 1 / Math.sqrt(Math.abs(ctx.getTransform().a * ctx.getTransform().d - ctx.getTransform().b * ctx.getTransform().c)) : 1;
  const pad = (3 * e.blur + Math.abs(e.dx) + Math.abs(e.dy)) * k + 1;
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

/** What a mark adds to a logo's own look: all of it fractions of the mark's height, or factors. */
export interface PaintOptions {
  shadow?: MarkShadow;
  emboss?: MarkEmboss;
  bevel?: MarkShadow[];
}

/** An effect's colour and softness under a mark's emboss: stronger, and tighter or softer. */
function embossed(e: Effect, emboss?: MarkEmboss): Effect {
  if (!emboss) return e;
  return {
    ...e,
    dx: e.dx * emboss.blur,
    dy: e.dy * emboss.blur,
    blur: e.blur * emboss.blur,
    color: e.color.replace(/,([\d.]+)\)$/, (_, a) => `,${Math.min(1, Number(a) * emboss.alpha)})`),
  };
}

/** The mark's height on the canvas: what a mark shadow's or bevel's offset and blur are fractions of. */
function markHeightPx(ctx: CanvasRenderingContext2D, l: Logo, used: number[]): number {
  const m = ctx.getTransform();
  const boxes = used.map((i) => l.layers[i].box);
  return (Math.max(...boxes.map((b) => b[3])) - Math.min(...boxes.map((b) => b[1]))) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
}

/**
 * A mark's soft shadow, with no mark: each layer drawn off the canvas with its shadow brought back into place, so that
 * letters' shadows lie under all of the letters. Its offset is in device pixels, so it stays down and to the right
 * however the mark is turned.
 */
function paintMarkShadow(ctx: CanvasRenderingContext2D, l: Logo, used: number[], dx: number, dy: number, sh: MarkShadow): void {
  const paths = logoPaths2D(l);
  const far = ctx.canvas.width + ctx.canvas.height + 1000;
  const device = markHeightPx(ctx, l, used);
  for (const i of used) {
    const layer = l.layers[i];
    ctx.save();
    ctx.shadowColor = sh.color;
    ctx.shadowBlur = 2 * sh.blur * device;
    ctx.shadowOffsetX = sh.dx * device + far;
    ctx.shadowOffsetY = sh.dy * device;
    ctx.translate(dx + layer.offset[0], dy + layer.offset[1]);
    const t = ctx.getTransform();
    ctx.setTransform(t.a, t.b, t.c, t.d, t.e - far, t.f);
    ctx.fillStyle = "#000";
    ctx.fill(paths[i], l.evenodd ? "evenodd" : "nonzero");
    ctx.restore();
  }
}

function paintLayer(ctx: CanvasRenderingContext2D, l: Logo, layer: LogoLayer, shape: Path2D, dx: number, dy: number, fill: string, mono: boolean, emboss?: MarkEmboss, bevel: Effect[] = []): void {
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
  for (const e of effects) if (e.type === "inner") innerShadow(ctx, shape, rule, layer, embossed(e, emboss));
  for (const e of bevel) innerShadow(ctx, shape, rule, layer, e);
  ctx.restore();
}

function paintAll(ctx: CanvasRenderingContext2D, l: Logo, used: number[], dx: number, dy: number, fill: string, mono: boolean, o: PaintOptions = {}): void {
  const paths = logoPaths2D(l);
  const device = o.bevel?.length ? markHeightPx(ctx, l, used) : 0;
  const bevel: Effect[] = (o.bevel ?? []).map((b) => ({ type: "inner", color: b.color, dx: b.dx * device, dy: b.dy * device, blur: b.blur * device, page: true }));
  for (const i of used) paintLayer(ctx, l, l.layers[i], paths[i], dx, dy, fill, mono, o.emboss, bevel);
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
  o: PaintOptions = {},
): void {
  if (o.shadow) paintMarkShadow(ctx, l, used, dx, dy, o.shadow);
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
      paintAll(sc, l, used, dx, dy, fill, mono, o);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sc.canvas as unknown as CanvasImageSource, x0, y0);
      ctx.restore();
      return;
    }
  }
  paintAll(ctx, l, used, dx, dy, fill, mono, o);
}
