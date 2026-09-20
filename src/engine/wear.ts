import type { TemplateConfig } from '../types/template';
import { edgeSegments, paintRect } from '../templates/geometry';
import { seeded } from './random';

/**
 * "Scanned / retro wear": what an old, handled cover looks like. The effect is planned as plain data (all positions
 * in mm) from a seed, then drawn by drawWear(). Planning is pure, so it is deterministic and unit-testable.
 */
export interface WearPlan {
  /** Soft diagonal highlights, like light on plastic wrap. */
  glares: { x: number; y: number; w: number; h: number; angleDeg: number; alpha: number }[];
  /** Fine crinkles: a light stroke with a dark one just beside it. */
  wrinkles: { pts: [number, number][]; alpha: number }[];
  /** Folds broken up into whitened, cracked stretches. */
  creases: { x1: number; y1: number; x2: number; y2: number; gaps: [number, number][] }[];
  /** Scuffed white specks along the cut edges. */
  nicks: { x: number; y: number; r: number; alpha: number }[];
  /** Rounded, whitened corners. */
  corners: { x: number; y: number; r: number; alpha: number }[];
  /** Large, faint smudges from shelf handling. */
  blotches: { x: number; y: number; r: number; dark: boolean; alpha: number }[];
  /** Region each effect is clipped to (the panels' paint areas). */
  areas: { x: number; y: number; w: number; h: number }[];
}

export function planWear(t: TemplateConfig, seed: number): WearPlan {
  const rnd = seeded(seed);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const plan: WearPlan = { glares: [], wrinkles: [], creases: [], nicks: [], corners: [], blotches: [], areas: [] };

  for (const p of t.panels) {
    const a = paintRect(t, p);
    plan.areas.push({ x: a.xMm, y: a.yMm, w: a.widthMm, h: a.heightMm });
    const size = Math.max(a.widthMm, a.heightMm);
    const area = a.widthMm * a.heightMm;

    // One or two broad glare bands, plus a thin sharp streak beside the first.
    const bands = area > 3000 ? 2 : 1;
    for (let i = 0; i < bands; i++) {
      plan.glares.push({ x: between(a.xMm, a.xMm + a.widthMm), y: between(a.yMm, a.yMm + a.heightMm), w: between(0.08, 0.22) * size, h: size * 2, angleDeg: between(-38, -18), alpha: between(0.1, 0.22) });
    }
    plan.glares.push({ x: plan.glares[plan.glares.length - bands].x + between(0.02, 0.05) * size, y: plan.glares[plan.glares.length - bands].y, w: 0.012 * size, h: size * 2, angleDeg: plan.glares[plan.glares.length - bands].angleDeg, alpha: 0.18 });

    // Crinkles scale with the panel's area.
    const wrinkleCount = Math.min(40, Math.max(4, Math.round(area / 350)));
    for (let i = 0; i < wrinkleCount; i++) {
      const x = between(a.xMm, a.xMm + a.widthMm);
      const y = between(a.yMm, a.yMm + a.heightMm);
      const angle = between(0, Math.PI * 2);
      const len = between(0.04, 0.16) * size;
      const pts: [number, number][] = [];
      for (let s = 0; s <= 4; s++) pts.push([x + Math.cos(angle) * len * (s / 4) + between(-0.6, 0.6), y + Math.sin(angle) * len * (s / 4) + between(-0.6, 0.6)]);
      plan.wrinkles.push({ pts, alpha: between(0.06, 0.16) });
    }

    // Smudges.
    const blotchCount = Math.max(2, Math.round(area / 6000));
    for (let i = 0; i < blotchCount; i++) {
      plan.blotches.push({ x: between(a.xMm, a.xMm + a.widthMm), y: between(a.yMm, a.yMm + a.heightMm), r: between(0.08, 0.28) * size, dark: rnd() < 0.55, alpha: between(0.03, 0.08) });
    }
  }

  for (const seg of edgeSegments(t)) {
    const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    if (seg.kind === 'fold') {
      // Cracked stretches: leave a few random gaps in the crease.
      const gaps: [number, number][] = [];
      for (let g = 0; g < Math.ceil(len / 40); g++) {
        const at = between(0.05, 0.9);
        gaps.push([at, Math.min(1, at + between(0.02, 0.09))]);
      }
      plan.creases.push({ x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, gaps });
    } else {
      // Nicks along the cut edge, denser than in the middle of a panel.
      const nx = -(seg.y2 - seg.y1) / len; // inward-ish normal (sign resolved by clamping to the area at draw time)
      const ny = (seg.x2 - seg.x1) / len;
      const count = Math.round(len * 0.9);
      for (let i = 0; i < count; i++) {
        if (rnd() > 0.35) continue;
        const along = rnd();
        const inset = rnd() * rnd() * 1.6; // mostly right at the edge
        plan.nicks.push({ x: seg.x1 + (seg.x2 - seg.x1) * along + nx * inset * (rnd() < 0.5 ? 1 : -1), y: seg.y1 + (seg.y2 - seg.y1) * along + ny * inset * (rnd() < 0.5 ? 1 : -1), r: between(0.12, 0.5), alpha: between(0.25, 0.7) });
      }
    }
  }

  // Worn corners on every panel corner that is a real (cut) corner.
  for (const p of t.panels) {
    for (const [cx, cy] of [[p.xMm, p.yMm], [p.xMm + p.widthMm, p.yMm], [p.xMm, p.yMm + p.heightMm], [p.xMm + p.widthMm, p.yMm + p.heightMm]]) {
      const touchesFold = t.panels.some((q) => q !== p && cx >= q.xMm - 1e-6 && cx <= q.xMm + q.widthMm + 1e-6 && cy >= q.yMm - 1e-6 && cy <= q.yMm + q.heightMm + 1e-6);
      if (!touchesFold) plan.corners.push({ x: cx, y: cy, r: between(2.5, 6), alpha: between(0.25, 0.55) });
    }
  }
  return plan;
}

let noiseTile: HTMLCanvasElement | null = null;

/** A tileable film-grain texture, generated once. */
function grain(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(256, 256);
  const rnd = seeded(0x51ed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (noiseTile = c);
}

/** Draws a planned wear effect over the finished artwork. `px` is pixels per mm. */
export function drawWear(ctx: CanvasRenderingContext2D, plan: WearPlan, px: number): void {
  ctx.save();

  // Everything is clipped to the panels' paint areas.
  ctx.beginPath();
  for (const a of plan.areas) ctx.rect(a.x * px, a.y * px, a.w * px, a.h * px);
  ctx.clip();

  // Paper ageing: a warm, slightly faded tint, then grain.
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(214, 178, 110, 0.16)';
  for (const a of plan.areas) ctx.fillRect(a.x * px, a.y * px, a.w * px, a.h * px);
  const pattern = ctx.createPattern(grain(), 'repeat');
  if (pattern) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = pattern;
    for (const a of plan.areas) ctx.fillRect(a.x * px, a.y * px, a.w * px, a.h * px);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  for (const b of plan.blotches) {
    const g = ctx.createRadialGradient(b.x * px, b.y * px, 0, b.x * px, b.y * px, b.r * px);
    const c = b.dark ? '0,0,0' : '255,255,255';
    g.addColorStop(0, `rgba(${c},${b.alpha})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect((b.x - b.r) * px, (b.y - b.r) * px, b.r * 2 * px, b.r * 2 * px);
  }

  for (const w of plan.wrinkles) {
    for (const [dx, dy, colour] of [[0, 0, `rgba(255,255,255,${w.alpha})`], [0.35, 0.35, `rgba(0,0,0,${w.alpha * 0.8})`]] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 0.22 * px;
      ctx.beginPath();
      w.pts.forEach(([x, y], i) => (i ? ctx.lineTo((x + dx) * px, (y + dy) * px) : ctx.moveTo((x + dx) * px, (y + dy) * px)));
      ctx.stroke();
    }
  }

  // Plastic-wrap glare: soft-edged diagonal bands.
  for (const g of plan.glares) {
    ctx.save();
    ctx.translate(g.x * px, g.y * px);
    ctx.rotate((g.angleDeg * Math.PI) / 180);
    const grad = ctx.createLinearGradient((-g.w / 2) * px, 0, (g.w / 2) * px, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${g.alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect((-g.w / 2) * px, (-g.h / 2) * px, g.w * px, g.h * px);
    ctx.restore();
  }

  // Creases: a dark shadow line, a bright whitened line, both broken by gaps.
  for (const c of plan.creases) {
    const at = (u: number) => [c.x1 + (c.x2 - c.x1) * u, c.y1 + (c.y2 - c.y1) * u] as const;
    const stops = [0, ...c.gaps.flatMap(([a, b]) => [a, b]).sort((p, q) => p - q), 1];
    const horizontal = Math.abs(c.y2 - c.y1) < Math.abs(c.x2 - c.x1);
    for (const [offset, colour, width] of [[0.45, 'rgba(0,0,0,0.28)', 0.5], [0, 'rgba(255,255,255,0.4)', 0.35], [-0.4, 'rgba(255,255,255,0.14)', 0.7]] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width * px;
      ctx.beginPath();
      for (let i = 0; i < stops.length; i += 2) {
        const [ax, ay] = at(stops[i]);
        const [bx, by] = at(stops[i + 1] ?? 1);
        const ox = horizontal ? 0 : offset;
        const oy = horizontal ? offset : 0;
        ctx.moveTo((ax + ox) * px, (ay + oy) * px);
        ctx.lineTo((bx + ox) * px, (by + oy) * px);
      }
      ctx.stroke();
    }
  }

  for (const n of plan.nicks) {
    ctx.fillStyle = `rgba(245,240,230,${n.alpha})`;
    ctx.beginPath();
    ctx.arc(n.x * px, n.y * px, n.r * px, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const c of plan.corners) {
    const g = ctx.createRadialGradient(c.x * px, c.y * px, 0, c.x * px, c.y * px, c.r * px);
    g.addColorStop(0, `rgba(245,240,230,${c.alpha})`);
    g.addColorStop(1, 'rgba(245,240,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect((c.x - c.r) * px, (c.y - c.r) * px, c.r * 2 * px, c.r * 2 * px);
  }

  ctx.restore();
}
