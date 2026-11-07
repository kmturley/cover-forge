import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { LOGOS, getLogo, type Logo } from '../brands';
import '../engine/regression/render'; // installs Path2D and the scratch canvas for Node
import { paintLogoLayers } from './logoLayers';

function draw(logo: Logo, size = 400) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const k = size / Math.max(logo.bbox[2] - logo.bbox[0], logo.bbox[3] - logo.bbox[1]);
  ctx.scale(k, k);
  paintLogoLayers(ctx, logo, logo.layers.map((_, i) => i), -logo.bbox[0], -logo.bbox[1], '#000', false);
  return new Uint8ClampedArray(c.getContext('2d').getImageData(0, 0, size, size).data);
}

const stripped = (l: Logo): Logo => ({
  ...l,
  layers: l.layers.map((layer) => {
    const rest = { ...layer };
    delete rest.effects;
    delete rest.blend;
    delete rest.opacity;
    return rest;
  }),
});
const differing = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++;
  return n;
};

describe('logo effects from the source SVG', () => {
  it('reads Figma inner shadows, blend modes and fill opacity', () => {
    const color = getLogo('color')!;
    expect(color.layers.every((l) => l.effects?.length === 2 && l.effects.every((e) => e.type === 'inner' && e.blur > 0))).toBe(true);
    const cube = getLogo('gamecube')!;
    expect(cube.layers.filter((l) => l.blend === 'hue').map((l) => l.opacity)).toEqual([0.4, 0.4, 0.4, 0.4]);
  });

  it('draws the inner shadows, so the letters are shaded and not flat', () => {
    const color = getLogo('color')!;
    expect(differing(draw(color), draw(stripped(color)))).toBeGreaterThan(2000);
  });

  it('blends the cube on its own, so its colour changes but the page stays clear', () => {
    const cube = getLogo('gamecube')!;
    const withBlend = draw(cube);
    expect(differing(withBlend, draw(stripped(cube)))).toBeGreaterThan(500);
    expect([withBlend[0], withBlend[1], withBlend[2]]).toEqual([255, 255, 255]);
  });

  it('casts a mark shadow down and right, clear of the artwork, however the mark is turned', () => {
    const gb = getLogo('gb')!;
    const shadow = { color: 'rgba(0,0,0,1)', dx: 0.2, dy: 0.2, blur: 0 };
    const render = (rotate: number) => {
      const c = createCanvas(300, 300);
      const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
      const k = 200 / (gb.bbox[2] - gb.bbox[0]);
      ctx.translate(150, 150);
      ctx.rotate(rotate);
      ctx.scale(k, k);
      ctx.translate(-(gb.bbox[0] + gb.bbox[2]) / 2, -(gb.bbox[1] + gb.bbox[3]) / 2);
      const used = gb.layers.map((_, i) => i);
      paintLogoLayers(ctx, gb, used, 0, 0, '#ff0000', true, { shadow });
      const d = ctx.getImageData(0, 0, 300, 300).data;
      const box = { black: [999, 999, -1, -1], red: [999, 999, -1, -1] };
      for (let y = 0; y < 300; y++) for (let x = 0; x < 300; x++) {
        const i = (x + y * 300) * 4;
        if (d[i + 3] < 200) continue;
        const b = d[i] > 200 ? box.red : d[i] < 50 ? box.black : null;
        if (!b) continue;
        b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
      }
      return box;
    };
    for (const turn of [0, -Math.PI / 2]) {
      const { black, red } = render(turn);
      expect(black[2]).toBeGreaterThan(red[2]);
      expect(black[3]).toBeGreaterThan(red[3]);
    }
    // Nothing is left behind where the shadow's shape was drawn off the canvas.
    const { black, red } = render(0);
    expect(black[0]).toBeGreaterThan(red[0]);
  });

  it('makes a mark\'s inner shadows stronger with emboss, leaving the source data alone', () => {
    const color = getLogo('color')!;
    const before = JSON.stringify(color.layers[0].effects);
    const render = (emboss?: { alpha: number; blur: number }) => {
      const c = createCanvas(400, 200);
      const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
      ctx.scale(0.2, 0.2);
      paintLogoLayers(ctx, color, color.layers.map((_, i) => i), 0, 0, '#000', false, { emboss });
      return new Uint8ClampedArray(ctx.getImageData(0, 0, 400, 200).data);
    };
    expect(differing(render(), render({ alpha: 1.5, blur: 0.7 }))).toBeGreaterThan(200);
    expect(JSON.stringify(color.layers[0].effects)).toBe(before);
  });

  it('draws a bevel inside the mark only, even on a one-colour mark', () => {
    const gb = getLogo('gba')!;
    const used = [0, 1];
    const render = (bevel?: { color: string; dx: number; dy: number; blur: number }[]) => {
      const c = createCanvas(600, 120);
      const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
      ctx.scale(0.38, 0.38);
      paintLogoLayers(ctx, gb, used, 0, 0, '#ffffff', true, { bevel });
      return new Uint8ClampedArray(ctx.getImageData(0, 0, 600, 120).data);
    };
    const [plain, bevelled] = [render(), render([{ color: 'rgba(0,0,0,0.9)', dx: -0.05, dy: -0.05, blur: 0.02 }])];
    let shaded = 0;
    let outside = 0;
    for (let i = 0; i < plain.length; i += 4) {
      if (plain[i + 3] === 0 && bevelled[i + 3] > 8) outside++;
      if (plain[i + 3] === 255 && bevelled[i] < 200) shaded++;
    }
    expect(shaded).toBeGreaterThan(200);
    expect(outside).toBe(0);
  });

  it('keeps shading out of the logo picker', () => {
    expect(LOGOS.filter((l) => l.hidden).map((l) => l.id).sort()).toEqual(['shade-gba-cap', 'shade-gba-strip', 'shade-gbc-cap', 'shade-gbc-strip']);
    // A gradient filling the whole artwork is the point of a shade, not a background to drop.
    expect(getLogo('shade-gbc-strip')!.layers.length).toBeGreaterThan(5);
  });

  it('leaves a flat (mono) logo flat', () => {
    const color = getLogo('color')!;
    const c = createCanvas(200, 200);
    const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    paintLogoLayers(ctx, color, color.layers.map((_, i) => i), 0, 0, '#123456', true);
    const px = ctx.getImageData(0, 0, 200, 200).data;
    const colours = new Set<string>();
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] === 255) colours.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
    expect([...colours]).toEqual(['18,52,86']);
  });
});
