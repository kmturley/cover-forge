import { createCanvas, loadImage, Path2D, type Image } from '@napi-rs/canvas';
import { renderCover, type ImageLookup } from '../CanvasRenderer';
import { layerImageUrls } from '../layers/images';
import { setTextMeasurer } from '../layers/branded';
import { resolveLayers } from '../layers/resolve';
import { IMAGES, type Fixture } from './fixtures';

// Brand logos use Path2D, which Node doesn't have.
(globalThis as { Path2D?: unknown }).Path2D = Path2D;

// The Branded dress is laid out by measuring its text; Node measures on a Skia canvas.
const measuring = createCanvas(10, 10).getContext('2d');
setTextMeasurer((text, font, spacing) => {
  measuring.font = font;
  if ('letterSpacing' in measuring) (measuring as unknown as { letterSpacing: string }).letterSpacing = spacing;
  return measuring.measureText(text).width;
});

/** A plain gradient with a frame and a diagonal, so any shift, crop, rotation or distortion of it shows up. */
function synthetic(width: number, height: number, hue: number): Promise<Image> {
  const c = createCanvas(width, height);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `hsl(${hue} 80% 30%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360} 90% 65%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, width, height);
  g.strokeStyle = '#fff';
  g.lineWidth = Math.max(4, width / 60);
  g.strokeRect(g.lineWidth, g.lineWidth, width - 2 * g.lineWidth, height - 2 * g.lineWidth);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(width, height);
  g.stroke();
  g.fillStyle = '#000';
  g.fillRect(width * 0.1, height * 0.1, width * 0.2, height * 0.12);
  return loadImage(c.toBuffer('image/png'));
}

let images: Promise<Map<string, Image>> | undefined;
const loadImages = () =>
  (images ??= Promise.all(Object.entries(IMAGES).map(async ([url, s]) => [url, await synthetic(s.width, s.height, s.hue)] as const)).then((e) => new Map(e)));

/** A fixture as RGBA pixels, drawn by the app's real `renderCover` on a Skia canvas. */
export async function renderFixture(f: Fixture): Promise<{ width: number; height: number; data: Uint8ClampedArray; png: Buffer }> {
  const base = await loadImages();
  const lookup = new Map(base);
  // Pictures a scene makes for itself (a custom graphic's SVG) are loaded here, as the app does before it draws.
  const { template: tpl, item, shared, designs, assets } = f.scene;
  for (const url of layerImageUrls(resolveLayers({ template: tpl, item, shared, designs }), item, assets)) {
    if (!lookup.has(url) && url.startsWith('data:image/svg+xml')) lookup.set(url, await loadImage(Buffer.from(decodeURIComponent(url.slice(url.indexOf(',') + 1)))));
  }
  const getImage: ImageLookup = (url) => (url ? ((lookup.get(url) as unknown as HTMLImageElement | undefined) ?? null) : null);
  const t = f.scene.template;
  const width = Math.round(t.totalWidthMm * f.px);
  const height = Math.round(t.totalHeightMm * f.px);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  renderCover(ctx as unknown as CanvasRenderingContext2D, f.scene, f.px, getImage);
  return { width, height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data), png: canvas.toBuffer('image/png') };
}

/** Decodes a golden PNG back to RGBA. */
export async function decode(png: Buffer): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const img = await loadImage(png);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, img.width, img.height).data) };
}

export interface Diff {
  /** Pixels where any channel differs by more than `threshold`. */
  differing: number;
  total: number;
  maxDelta: number;
}

export function diff(a: { width: number; height: number; data: Uint8ClampedArray }, b: { width: number; height: number; data: Uint8ClampedArray }, threshold: number): Diff {
  if (a.width !== b.width || a.height !== b.height) return { differing: a.width * a.height, total: a.width * a.height, maxDelta: 255 };
  let differing = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let d = 0;
    for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a.data[i + k] - b.data[i + k]));
    if (d > maxDelta) maxDelta = d;
    if (d > threshold) differing++;
  }
  return { differing, total: a.width * a.height, maxDelta };
}
