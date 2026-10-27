import { createCanvas } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { LIBRARY } from '../../templates/library';
import { buildTemplateById, canvasSizePx } from '../../templates';
import { diff } from '../regression/render';
import '../regression/render'; // installs Path2D for Node
import { drawOfficial } from '../branding';
import { BASE_BACKGROUND } from '../resolve';
import { brandedFolderId, brandedLayers, setTextMeasurer } from './branded';
import { drawLayers } from './draw';

const PX = 2;

beforeAll(() => {
  const ctx = createCanvas(10, 10).getContext('2d');
  setTextMeasurer((text, font, spacing) => {
    ctx.font = font;
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = spacing;
    return ctx.measureText(text).width;
  });
});

function render(t: ReturnType<typeof buildTemplateById>, how: (ctx: CanvasRenderingContext2D) => void) {
  const { width, height } = canvasSizePx({ ...t, dpiScale: PX });
  const c = createCanvas(Math.round(t.totalWidthMm * PX), Math.round(t.totalHeightMm * PX));
  void width;
  void height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = BASE_BACKGROUND;
  ctx.fillRect(0, 0, c.width, c.height);
  how(ctx as unknown as CanvasRenderingContext2D);
  return { width: c.width, height: c.height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, c.width, c.height).data) };
}

describe('the dress as layers', () => {
  it('has a folder and its layers, all filed in it, on panels the case has', () => {
    for (const e of LIBRARY) {
      const t = buildTemplateById(e.id);
      const { layers } = brandedLayers(t);
      const folders = layers.filter((l) => l.type === 'group');
      expect(folders.length, e.id).toBeGreaterThan(0);
      expect(layers.slice(0, folders.length), e.id).toEqual(folders);
      expect(new Set(layers.map((l) => l.id)).size, e.id).toBe(layers.length);
      for (const l of layers.slice(folders.length)) {
        expect(l.parent, `${e.id} ${l.id}`).toBe(brandedFolderId(l.target));
        expect(t.panels.some((p) => p.id === l.target), `${e.id} ${l.id}`).toBe(true);
      }
    }
  });

  const report: string[] = [];
  it.each(LIBRARY.map((e) => [e.id] as const))('%s draws what the canvas drawing does', (id) => {
    const t = buildTemplateById(id);
    const legacy = render(t, (ctx) => drawOfficial(ctx, t, PX));
    const layers = render(t, (ctx) => drawLayers({ ctx, template: t, item: null, px: PX, getImage: () => null }, brandedLayers(t).layers));
    const d = diff(layers, legacy, 24);
    report.push(`${id.padEnd(26)} ${((100 * d.differing) / d.total).toFixed(3)}%  max ${d.maxDelta}  layers ${brandedLayers(t).layers.length}`);
    expect(d.differing / d.total).toBeLessThan(0.02);
  });

  it('reports', () => {
    console.log(report.join('\n'));
  });
});
