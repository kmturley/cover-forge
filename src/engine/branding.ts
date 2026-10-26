import type { PanelRect, TemplateConfig } from '../types/template';
import { paintRect } from '../templates/geometry';
import { brandHeight, brandPath2D, brandWidth, getBrand, getLogo, type Brand, type Logo } from '../brands';
import { paintLogoLayers } from './logoLayers';
import { X360_WAVES, X360_WAVES_SIZE } from './x360Waves.generated';
import { brandingFor, type FrontHeader, type FrontMark, type Lockup, type Paint, type Part, type SpanMark, type SpineBranding } from './official';

/**
 * Draws the "Branded" trade dress (the data is in official.ts). The drawing code doesn't touch a canvas itself: it
 * describes what to put where to a `Sink`. One sink paints a canvas, exactly as the dress was always drawn; the other
 * (layers/branded.ts) turns the same description into ordinary, editable layers, which is how the dress becomes layers
 * without anyone re-deriving its geometry.
 */

/** A path in the sink's units: moves, lines, quadratic curves and closing. */
export type PathOp = ['M', number, number] | ['L', number, number] | ['Q', number, number, number, number] | ['Z'];

/** What is painted: a flat colour, a linear gradient between two points, or a radial one round a point. Positions are the sink's units. */
export type Ink = string | { line: [number, number, number, number]; stops: [number, string][] } | { radial: { cx: number; cy: number; r: number }; stops: [number, string][] };

export interface Font {
  weight?: number;
  italic?: boolean;
  /** Letter spacing as a share of the font size. */
  spacing?: number;
}

/** A part of a logo to draw: some of its layers, a share of its artwork, all in one colour. */
export interface LogoPart {
  only?: number[];
  crop?: [number, number, number, number];
  mono?: boolean;
}

export interface Sink {
  /** Starts a named piece of the dress on a panel; what is drawn next belongs to it (a canvas has no use for this). */
  begin(id: string, name: string, panel: PanelRect): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  /** Everything drawn until `restore` is drawn at this opacity. */
  setAlpha(alpha: number): void;
  /** Everything drawn until `restore` is cut to this path. */
  clip(ops: PathOp[]): void;
  fillPath(ops: PathOp[], ink: Ink): void;
  fillRect(x: number, y: number, w: number, h: number, ink: Ink): void;
  fillCircle(cx: number, cy: number, r: number, ink: Ink): void;
  strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth: number): void;
  strokePath(ops: PathOp[], color: string, lineWidth: number): void;
  /** One line of text whose capitals are `capPx` tall, with its top-left at (x, y): its baseline is at y + capPx. */
  text(text: string, x: number, y: number, capPx: number, font: Font, color: string): void;
  measure(text: string, capPx: number, font: Font): number;
  brand(brand: Brand, x: number, y: number, heightPx: number, color: string): void;
  logo(logo: Logo, part: LogoPart, x: number, y: number, heightPx: number, color: string): void;
  /** How many rows a fine, row-by-row effect steps by: 1 on a canvas, more where each row would become a layer. */
  readonly rowStep: number;
}

const FONT = 'Helvetica, Arial, sans-serif';
/** Cap height of the font, as a fraction of its size. */
const CAP = 0.72;

/** A fill from the branding data, as the ink for a rectangle (x, y, w, h). */
function ink(fill: Paint, x: number, y: number, w: number, h: number): Ink {
  if (typeof fill === 'string') return fill;
  return 'x' in fill ? { line: [x, 0, x + w, 0], stops: fill.x } : { line: [0, y, 0, y + h], stops: fill.y };
}

const partH = (p: Part) => ('h' in p && p.h) || 1;

interface Box {
  w: number;
  h: number;
  draw: (x: number, y: number) => void;
}

/** Lays out parts at `unit` pixels per relative height unit; returns the size and a function drawing it at a top-left. */
function layout(s: Sink, parts: Part[], color: string, unit: number, gapUnits: number, dir: 'row' | 'stack'): Box {
  const boxes = parts.map((p) => part(s, p, color, unit, gapUnits));
  const gap = gapUnits * unit;
  if (dir === 'row') {
    const w = boxes.reduce((sum, b) => sum + b.w, 0) + gap * (boxes.length - 1);
    const h = Math.max(...boxes.map((b) => b.h));
    return { w, h, draw: (x, y) => boxes.reduce((cx, b) => (b.draw(cx, y + (h - b.h) / 2), cx + b.w + gap), x) };
  }
  const w = Math.max(...boxes.map((b) => b.w));
  const sgap = gap * 0.4;
  const h = boxes.reduce((sum, b) => sum + b.h, 0) + sgap * (boxes.length - 1);
  return { w, h, draw: (x, y) => boxes.reduce((cy, b) => (b.draw(x + (w - b.w) / 2, cy), cy + b.h + sgap), y) };
}

function part(s: Sink, p: Part, color: string, unit: number, gapUnits: number): Box {
  if ('row' in p) return layout(s, p.row, color, unit, gapUnits, 'row');
  if ('stack' in p) return layout(s, p.stack, color, unit, gapUnits, 'stack');
  const h = partH(p) * unit;
  const fill = p.color ?? color;
  if ('text' in p) {
    const font: Font = { weight: p.weight, italic: p.italic, spacing: p.spacing };
    return { w: s.measure(p.text, h, font), h, draw: (x, y) => s.text(p.text, x, y, h, font, fill) };
  }
  if ('brand' in p) {
    const b = getBrand(p.brand);
    if (!b) return { w: 0, h: 0, draw: () => {} };
    return { w: brandWidth(b) * (h / brandHeight(b)), h, draw: (x, y) => s.brand(b, x, y, h, fill) };
  }
  // What is left is a supplied logo.
  const l = getLogo(p.logo);
  if (!l) return { w: 0, h: 0, draw: () => {} };
  const g = logoPartGeometry(l, p);
  return { w: g.bw * (h / g.bh), h, draw: (x, y) => s.logo(l, { only: p.only, crop: p.crop, mono: p.mono }, x, y, h, fill) };
}

/** The artwork a logo part draws, in the logo's own coordinates: its top-left, size and which of its layers. */
export function logoPartGeometry(l: Logo, p: LogoPart): { bx: number; by: number; bw: number; bh: number; used: number[] } {
  const used = l.layers.map((_, i) => i).filter((i) => !p.only || p.only.includes(i));
  const boxes = used.map((i) => l.layers[i].box);
  const [lx0, ly0, lx1, ly1] = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
  // `crop` keeps only a share of the artwork, as fractions of its bounds: [left, top, right, bottom].
  const [c0, c1, c2, c3] = p.crop ?? [0, 0, 1, 1];
  return { bx: lx0 + c0 * (lx1 - lx0), by: ly0 + c1 * (ly1 - ly0), bw: (c2 - c0) * (lx1 - lx0), bh: (c3 - c1) * (ly1 - ly0), used };
}

/** Measures a lockup whose total height is `heightPx`. */
function lockup(s: Sink, m: Lockup, heightPx: number): Box {
  const natural = layout(s, m.parts, m.color, 100, m.gap ?? 0.25, 'row');
  const k = natural.h ? heightPx / natural.h : 1;
  return layout(s, m.parts, m.color, 100 * k, m.gap ?? 0.25, 'row');
}

/** Draws a lockup fitted inside `w` × `h` (px, centred on cx, cy), rotated by `rotate` degrees. */
function drawFitted(s: Sink, m: Lockup, cx: number, cy: number, w: number, h: number, rotate: number, px: number) {
  const sideways = rotate !== 0;
  const [bw, bh] = sideways ? [h, w] : [w, h];
  const probe = lockup(s, m, 100);
  if (!probe.w || !probe.h) return;
  // A frame takes a little room round the artwork.
  const pad = m.frame ? Math.min(bw, bh) * 0.08 : 0;
  const heightPx = Math.min(bh - 2 * pad, ((bw - 2 * pad) * probe.h) / probe.w);
  const box = lockup(s, m, heightPx);
  s.save();
  s.translate(cx, cy);
  s.rotate((rotate * Math.PI) / 180);
  if (m.frame) s.strokeRect(-box.w / 2 - pad, -box.h / 2 - pad, box.w + 2 * pad, box.h + 2 * pad, m.frame.color, Math.max(1, (m.frame.mm ?? 0.2) * px));
  box.draw(-box.w / 2, -box.h / 2);
  s.restore();
}

/** What to call a lockup: its first brand or logo's name, else its first text. */
function lockupName(m: Lockup): string {
  const first = (parts: Part[]): string | undefined => {
    for (const p of parts) {
      if ('row' in p) return first(p.row);
      if ('stack' in p) return first(p.stack);
      if ('brand' in p) return getBrand(p.brand)?.label;
      if ('logo' in p) return getLogo(p.logo)?.label;
      if ('text' in p) return p.text;
    }
    return undefined;
  };
  return first(m.parts) ?? 'Mark';
}

/** Draws a front mark with its height, alignment and inset; `depth` gives the header's depth where it lands. */
function drawFrontMark(s: Sink, m: FrontMark, area: { x: number; w: number }, p: PanelRect, px: number, depth: (xMm: number) => number, id: string) {
  s.begin(id, `${lockupName(m)} mark`, p);
  const H = p.heightMm * px;
  let box = lockup(s, m, m.h * H);
  const maxW = area.w * 0.9;
  if (box.w > maxW) box = lockup(s, m, (m.h * H * maxW) / box.w);
  const inset = (m.inset ?? 0.025) * p.widthMm * px;
  const x = (m.align === 'left' ? area.x + inset : m.align === 'right' ? area.x + area.w - inset - box.w : area.x + (area.w - box.w) / 2) + (m.dx ?? 0) * p.widthMm * px;
  const cy = m.cy !== undefined ? p.yMm * px + m.cy * H : p.yMm * px + (depth((x + box.w / 2) / px) * px) / 2;
  const y = cy - box.h / 2;
  if (m.plate) {
    const pad = box.h * 0.35;
    s.fillRect(x - pad, y - pad, box.w + pad * 2, box.h + pad * 2, m.plate);
  }
  box.draw(x, y);
}

/** Draws the header, spine caps and back logos. `px` is pixels per mm. */
export function drawBranding(s: Sink, t: TemplateConfig, px: number): void {
  const b = brandingFor(t.kind, t.variantId);
  s.save();
  const front = t.panels.find((p) => p.id === 'front');
  if (front) drawFront(s, t, front, b.front, px, 'front');
  const back = t.panels.find((p) => p.id === 'back');
  if (back && b.backBand && b.front.shape === 'band') drawFront(s, t, back, { ...b.front, marks: [] }, px, 'back');
  if (back && b.back) b.back.forEach((m, i) => drawFrontMark(s, m, { x: back.xMm * px, w: back.widthMm * px }, back, px, () => 0, `back.mark-${i + 1}`));
  if (b.spine) for (const p of t.panels) if (p.text) drawSpine(s, t, p, b.spine, px);
  s.restore();
}

function drawFront(s: Sink, t: TemplateConfig, p: PanelRect, h: FrontHeader, px: number, key: string) {
  const area = paintRect(t, p);
  // Snapped outwards to whole pixels so the paint meets its neighbour with no hairline of the base colour between them.
  const [ax, ay] = [Math.floor(area.xMm * px), Math.floor(area.yMm * px)];
  const aw = Math.ceil((area.xMm + area.widthMm) * px) - ax;
  const [x0, y0, W, H] = [p.xMm * px, p.yMm * px, p.widthMm * px, p.heightMm * px];
  const panelBox = { x: x0, w: W };

  if (h.shape === 'band') {
    // The lower edge in px at a canvas x, clamped to the trim so the bleed carries the edge's end depth.
    const edge = (x: number) => y0 + h.depth(Math.min(1, Math.max(0, (x - x0) / W))) * H;
    const steps = 480;
    const xs = Array.from({ length: steps + 1 }, (_, i) => ax + (aw * i) / steps);
    const outline = (offset: number) => xs.map((x) => [x, edge(x) + offset] as const);
    const deepest = Math.max(...xs.map(edge));

    const band: PathOp[] = [['M', ax, ay], ['L', ax + aw, ay], ...outline(0).reverse().map(([x, y]) => ['L', x, y] as PathOp), ['Z']];
    s.begin(`${key}.band`, 'Header band', p);
    s.fillPath(band, ink(h.fill, x0, ay, W, deepest - ay));

    if (h.decor) {
      s.save();
      s.clip(band);
      drawDecor(s, h.decor, x0, y0, W, deepest - y0, p, key);
      s.restore();
    }

    if (h.line) {
      // Thickest in the middle and thinner towards both sides when tapered.
      const thick = (x: number) => {
        const u = Math.min(1, Math.max(0, (x - x0) / W));
        const edgeShare = h.line!.taper ?? 1;
        return h.line!.size * H * (edgeShare + (1 - edgeShare) * (1 - (2 * u - 1) ** 2));
      };
      const line: PathOp[] = [...outline(0).map(([x, y], i) => [i ? 'L' : 'M', x, y] as PathOp), ...xs.map((x) => [x, edge(x) + thick(x)] as const).reverse().map(([x, y]) => ['L', x, y] as PathOp), ['Z']];
      s.begin(`${key}.line`, 'Header line', p);
      s.fillPath(line, h.line.color);
      if (h.line.shadow) {
        // A soft edge under the line (GameCube's bevel), drawn translucent.
        const sh = h.line.shadow.size * H;
        const shadow: PathOp[] = [...xs.map((x, i) => [i ? 'L' : 'M', x, edge(x) + thick(x)] as PathOp), ...[...xs].reverse().map((x) => ['L', x, edge(x) + thick(x) + sh] as PathOp), ['Z']];
        s.begin(`${key}.line-shadow`, 'Header line shadow', p);
        s.save();
        s.setAlpha(0.55);
        s.fillPath(shadow, h.line.shadow.color);
        s.restore();
      }
    }
    h.marks.forEach((m, i) => drawFrontMark(s, m, panelBox, p, px, (xMm) => h.depth(Math.min(1, Math.max(0, (xMm - p.xMm) / p.widthMm))) * p.heightMm, `${key}.mark-${i + 1}`));
  } else if (h.shape === 'tab') {
    const tw = h.w * W;
    const bw = (h.wBottom ?? h.w) * W;
    const th = h.h * H;
    // The edges are measured at the trim; the paint runs on up into the bleed along the same slope.
    const lead = (y0 - ay) / th;
    const onward = (top: number, bottom: number) => (top + (top - bottom) * lead) * W;
    if (h.plate) {
      // A pale slanted plate continuing the tab to the right, outlined along its slanted edge and bottom.
      s.begin(`${key}.plate`, 'Plate', p);
      s.fillPath([['M', x0 + tw - 1, ay], ['L', x0 + onward(h.plate.top, h.plate.bottom), ay], ['L', x0 + h.plate.bottom * W, y0 + th], ['L', x0 + bw - 1, y0 + th], ['Z']], h.plate.fill);
      s.begin(`${key}.plate-line`, 'Plate outline', p);
      s.strokePath([['M', x0 + onward(h.plate.top, h.plate.bottom), ay], ['L', x0 + h.plate.bottom * W, y0 + th], ['L', x0 + bw, y0 + th]], h.plate.line, Math.max(1, px * 0.1));
    }
    s.begin(`${key}.tab`, 'Header tab', p);
    s.fillPath([['M', ax, ay], ['L', x0 + onward(h.w, h.wBottom ?? h.w), ay], ['L', x0 + bw, y0 + th], ['L', ax, y0 + th], ['Z']], ink(h.fill, x0, ay, tw, th));
    if (h.lip) {
      s.begin(`${key}.tab-lip`, 'Header tab lip', p);
      s.fillRect(ax, ay, x0 + h.lip * W - ax, y0 - ay + 1, ink(h.fill, x0, ay, tw, th));
    }
    const tabBox = { x: x0, w: bw };
    h.marks.forEach((m, i) => drawFrontMark(s, m, m.onPanel ? panelBox : tabBox, p, px, () => h.h * p.heightMm, `${key}.mark-${i + 1}`));
  } else if (h.shape === 'strip') {
    const sw = h.w * W;
    const [sy, sh] = [area.yMm * px, area.heightMm * px];
    s.begin(`${key}.strip`, 'Side strip', p);
    s.fillRect(ax, sy, x0 + sw - ax, sh, ink(h.fill, ax, sy, x0 + sw - ax, sh));
    h.marks.forEach((m, i) => drawSpan(s, m, { x: x0, y: y0, across: sw, along: H }, 'vertical', px, p, `${key}.mark-${i + 1}`));
  } else {
    h.marks.forEach((m, i) => drawFrontMark(s, m, panelBox, p, px, () => 0, `${key}.mark-${i + 1}`));
  }
}

function drawDecor(s: Sink, decor: 'xbox-orb' | 'x360-swoosh', x0: number, y0: number, W: number, depth: number, p: PanelRect, key: string) {
  if (decor === 'xbox-orb') {
    // Fine horizontal ridges fading in towards the orb, a dark ring, then the glossy green-to-yellow orb with its X,
    // cropped by the band's bottom and right trims.
    const [r, cx, cy] = [W * 0.125, x0 + W * 0.9, y0 + depth * 0.47];
    const ridge: Ink = { line: [x0 + W * 0.2, 0, x0 + W * 0.77, 0], stops: [[0, 'rgba(255,255,255,0)'], [0.35, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0.15)']] };
    const pitch = depth * 0.052;
    s.begin(`${key}.ridges`, 'Ridges', p);
    for (let y = y0; y < y0 + depth; y += pitch) s.fillRect(x0 + W * 0.2, y, W * 0.57, pitch * 0.55, ridge);

    s.begin(`${key}.orb-ring`, 'Orb ring', p);
    s.fillCircle(cx, cy, r * 1.17, { line: [cx - r * 1.2, 0, cx - r * 0.8, 0], stops: [[0, '#1c1c1c'], [1, '#030303']] });

    s.begin(`${key}.orb`, 'Orb', p);
    s.fillCircle(cx, cy, r, { radial: { cx: cx + r * 0.2, cy: cy + r * 0.35, r: r * 1.7 }, stops: [[0, '#f8f4a8'], [0.2, '#e6e75c'], [0.38, '#cdd514'], [0.58, '#96c008'], [0.76, '#4f9c06'], [1, '#1f5f05']] });

    s.begin(`${key}.orb-x`, 'Orb X', p);
    const x = part(s, { logo: 'xbox', crop: [0, 0, 0.339, 1] }, '#ffffff', W * 0.119, 0);
    s.save();
    s.setAlpha(0.6);
    x.draw(cx - x.w / 2, cy - x.h / 2);
    s.restore();
    return;
  }
  // The Xbox 360 swooshes, traced from the artwork: a fade from white, then bands painted left to right. The artwork is
  // as tall as the band and flush with the right trim, with its last colours carried on into the bleed.
  const k = depth / (X360_WAVES_SIZE.h - 1);
  const right = x0 + W;
  const sx = (x: number) => right - (X360_WAVES_SIZE.w - x) * k;
  const sy = (y: number) => y0 + y * k;
  const edgeAt = (pts: [number, number][], y: number) => {
    // Past the last point, keep to the last segment rather than wrapping round to the first.
    const j = pts.findIndex((q) => q[1] >= y);
    const i = j === -1 ? pts.length - 1 : Math.max(1, j);
    const [a, b] = [pts[i - 1], pts[i]];
    return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1);
  };
  const first = X360_WAVES[0];
  const [fr, fg, fb] = (first.stops[1][1].match(/[0-9a-f]{2}/g) ?? []).map((hex) => parseInt(hex, 16));
  const fade = W * 0.075;
  s.begin(`${key}.swoosh-fade`, 'Swoosh glow', p);
  for (let y = 0; y < X360_WAVES_SIZE.h; y += s.rowStep) {
    const e = sx(edgeAt(first.left, y));
    s.fillRect(e - fade, sy(y), fade + 1, k * s.rowStep + 0.6, { line: [e - fade, 0, e, 0], stops: [[0, `rgba(${fr},${fg},${fb},0)`], [0.65, `rgba(${fr},${fg},${fb},0.12)`], [1, `rgba(${fr},${fg},${fb},0.8)`]] });
  }
  // A green underlay, so the hairline between two neighbouring shapes shows green rather than the page.
  s.begin(`${key}.swoosh-underlay`, 'Swoosh underlay', p);
  s.fillPath([...first.left.map(([x, y], i) => [i ? 'L' : 'M', sx(x), sy(y)] as PathOp), ['L', right + W * 0.1, sy(X360_WAVES_SIZE.h - 1)], ['L', right + W * 0.1, sy(0)], ['Z']], '#2f9b00');
  const bleed = (x: number) => (x > X360_WAVES_SIZE.w ? right + W * 0.1 : sx(x));
  X360_WAVES.forEach((band, n) => {
    const [top, bottom] = [sy(band.left[0][1]), sy(band.left.at(-1)![1])];
    s.begin(`${key}.swoosh-${n + 1}`, `Swoosh ${n + 1}`, p);
    s.fillPath([...band.left.map(([x, y], i) => [i ? 'L' : 'M', sx(x), sy(y)] as PathOp), ...[...band.right].reverse().map(([x, y]) => ['L', bleed(x), sy(y)] as PathOp), ['Z']], { line: [0, top, 0, bottom], stops: band.stops });
  });
}

/** A span mark along a spine-like strip; `frame` is in px, `across` the strip's width and `along` its length. */
function drawSpan(s: Sink, m: SpanMark, frame: { x: number; y: number; across: number; along: number }, orientation: 'vertical' | 'horizontal', px: number, p: PanelRect, id: string) {
  s.begin(id, `${lockupName(m)} mark`, p);
  const vertical = orientation === 'vertical';
  const start = m.from * frame.along;
  const len = (m.to - m.from) * frame.along;
  const shift = (m.dx ?? 0) * frame.across;
  const [cx, cy] = vertical ? [frame.x + frame.across / 2 + shift, frame.y + start + len / 2] : [frame.x + start + len / 2, frame.y + frame.across / 2 + shift];
  if (m.plate) {
    const pw = frame.across * (m.plateAcross ?? 1);
    const off = (frame.across - pw) / 2;
    if (vertical) s.fillRect(frame.x + off, frame.y + start, pw, len, m.plate);
    else s.fillRect(frame.x + start, frame.y + off, len, pw, m.plate);
  }
  const room = frame.across * (m.across ?? 0.6);
  // On a horizontal spine the text already runs along it, so nothing turns.
  const rotate = vertical ? m.rotate : 0;
  const [w, h] = vertical ? [room, len] : [len, room];
  drawFitted(s, m, cx, cy, w, h, rotate, px);
}

function drawSpine(s: Sink, t: TemplateConfig, p: PanelRect, sp: SpineBranding, px: number) {
  const area = paintRect(t, p);
  const vertical = p.text === 'vertical';
  const [ax, ay] = [Math.floor(area.xMm * px), Math.floor(area.yMm * px)];
  const [aw, ah] = [Math.ceil((area.xMm + area.widthMm) * px) - ax, Math.ceil((area.yMm + area.heightMm) * px) - ay];
  const along = (vertical ? p.heightMm : p.widthMm) * px;
  const across = (vertical ? p.widthMm : p.heightMm) * px;
  const [x0, y0] = [p.xMm * px, p.yMm * px];
  const key = p.id;

  if (sp.fill) {
    s.begin(`${key}.fill`, 'Colour', p);
    s.fillRect(ax, ay, aw, ah, ink(sp.fill, ax, ay, aw, ah));
  }
  if (sp.cap) {
    const len = sp.cap.length * along;
    const rect = vertical ? [ax, ay, aw, y0 + len - ay] : [ax, ay, x0 + len - ax, ah];
    const capInk = ink(sp.cap.fill, rect[0], rect[1], rect[2], rect[3]);
    s.begin(`${key}.cap`, 'Cap', p);
    if (sp.cap.dome && vertical) {
      // The lower edge rises in the middle: a curve between the two ends of the edge.
      const rise = sp.cap.dome * along;
      const [cx0, cy0, cw, ch] = rect;
      s.fillPath([['M', cx0, cy0], ['L', cx0 + cw, cy0], ['L', cx0 + cw, cy0 + ch], ['Q', cx0 + cw / 2, cy0 + ch - 2 * rise, cx0, cy0 + ch], ['Z']], capInk);
    } else s.fillRect(rect[0], rect[1], rect[2], rect[3], capInk);
    if (sp.cap.line) {
      const t2 = sp.cap.line.size * along;
      const gap = (sp.cap.line.gap ?? 0) * along;
      s.begin(`${key}.cap-line`, 'Cap line', p);
      if (vertical) s.fillRect(ax, y0 + len + gap, aw, t2, sp.cap.line.color);
      else s.fillRect(x0 + len + gap, ay, t2, ah, sp.cap.line.color);
    }
  }
  if (sp.outline) {
    // Round the cap when there is one, otherwise round the whole spine.
    const lw = Math.max(1, sp.outline.mm * px);
    const [ow, oh] = [p.widthMm * px, sp.cap && vertical ? sp.cap.length * along : p.heightMm * px];
    const rightFrom = (sp.outline.rightFrom ?? 0) * along;
    // Each side is snapped outwards to whole pixels, so it meets a line drawn by the neighbouring panel with no gap.
    const edge = (name: string, x: number, y: number, w: number, h: number) => {
      const [fx, fy] = [Math.floor(x), Math.floor(y)];
      s.begin(`${key}.outline-${name}`, `Outline ${name}`, p);
      s.fillRect(fx, fy, Math.ceil(x + w) - fx, Math.ceil(y + h) - fy, sp.outline!.color);
    };
    if (sp.outline.top !== false) edge('top', x0, y0, ow, lw);
    edge('left', x0, y0, lw, oh);
    edge('bottom', x0, y0 + oh - lw, ow, lw);
    if (sp.outline.right !== false) edge('right', x0 + ow - lw, y0 + rightFrom, lw, oh - rightFrom);
  }
  sp.marks.forEach((m, i) => drawSpan(s, m, { x: x0, y: y0, across, along }, vertical ? 'vertical' : 'horizontal', px, p, `${key}.mark-${i + 1}`));
}

// ——— Painting on a canvas ———

type Ctx = CanvasRenderingContext2D;

const fontString = (f: Font, capPx: number) => `${f.italic ? 'italic ' : ''}${f.weight ?? 700} ${capPx / CAP}px ${FONT}`;

function setSpacing(ctx: Ctx, f: Font, capPx: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${(f.spacing ?? 0) * (capPx / CAP)}px`;
}

function style(ctx: Ctx, i: Ink): string | CanvasGradient {
  if (typeof i === 'string') return i;
  let g: CanvasGradient;
  if ('line' in i) g = ctx.createLinearGradient(...i.line);
  else g = ctx.createRadialGradient(i.radial.cx, i.radial.cy, 0, i.radial.cx, i.radial.cy, i.radial.r);
  for (const [o, c] of i.stops) g.addColorStop(o, c);
  return g;
}

function trace(ctx: Ctx, ops: PathOp[]) {
  ctx.beginPath();
  for (const op of ops) {
    if (op[0] === 'M') ctx.moveTo(op[1], op[2]);
    else if (op[0] === 'L') ctx.lineTo(op[1], op[2]);
    else if (op[0] === 'Q') ctx.quadraticCurveTo(op[1], op[2], op[3], op[4]);
    else ctx.closePath();
  }
}

/** Paints the dress on a canvas. */
export class CanvasSink implements Sink {
  readonly rowStep = 1;
  constructor(private readonly ctx: Ctx) {}
  begin(): void {}
  save() {
    this.ctx.save();
  }
  restore() {
    this.ctx.restore();
  }
  translate(x: number, y: number) {
    this.ctx.translate(x, y);
  }
  rotate(radians: number) {
    this.ctx.rotate(radians);
  }
  setAlpha(alpha: number) {
    this.ctx.globalAlpha = alpha;
  }
  clip(ops: PathOp[]) {
    trace(this.ctx, ops);
    this.ctx.clip();
  }
  fillPath(ops: PathOp[], i: Ink) {
    trace(this.ctx, ops);
    this.ctx.fillStyle = style(this.ctx, i);
    this.ctx.fill();
  }
  fillRect(x: number, y: number, w: number, h: number, i: Ink) {
    this.ctx.fillStyle = style(this.ctx, i);
    this.ctx.fillRect(x, y, w, h);
  }
  fillCircle(cx: number, cy: number, r: number, i: Ink) {
    this.ctx.fillStyle = style(this.ctx, i);
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();
  }
  strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth: number) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, w, h);
  }
  strokePath(ops: PathOp[], color: string, lineWidth: number) {
    trace(this.ctx, ops);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();
  }
  text(text: string, x: number, y: number, capPx: number, font: Font, color: string) {
    const { ctx } = this;
    ctx.save();
    ctx.font = fontString(font, capPx);
    setSpacing(ctx, font, capPx);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y + capPx);
    ctx.restore();
  }
  measure(text: string, capPx: number, font: Font) {
    const { ctx } = this;
    ctx.save();
    ctx.font = fontString(font, capPx);
    setSpacing(ctx, font, capPx);
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  }
  brand(b: Brand, x: number, y: number, heightPx: number, color: string) {
    const { ctx } = this;
    const k = heightPx / brandHeight(b);
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.translate(-b.bbox[0], -b.bbox[1]);
    ctx.fill(brandPath2D(b));
    ctx.restore();
  }
  logo(l: Logo, p: LogoPart, x: number, y: number, heightPx: number, color: string) {
    const { ctx } = this;
    const { bx, by, bw, bh, used } = logoPartGeometry(l, p);
    const k = heightPx / bh;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    if (p.crop) {
      ctx.beginPath();
      ctx.rect(0, 0, bw, bh);
      ctx.clip();
    }
    paintLogoLayers(ctx, l, used, -bx, -by, color, !!p.mono);
    ctx.restore();
  }
}

/** Draws the header, spine caps and back logos on a canvas. `px` is pixels per mm. */
export function drawOfficial(ctx: Ctx, t: TemplateConfig, px: number): void {
  drawBranding(new CanvasSink(ctx), t, px);
}
