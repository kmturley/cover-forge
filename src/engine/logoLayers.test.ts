import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { getLogo, type Logo } from '../brands';
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
