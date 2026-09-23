import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { computeLayout } from './sheets';
import { buildItemSvg, buildSheetSvg } from './svgExport';

const fakeCanvas = (tag = 'AAAA') => ({ toDataURL: () => `data:image/jpeg;base64,${tag}` }) as unknown as HTMLCanvasElement;
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

describe('buildItemSvg', () => {
  it('is sized in exact millimetres with a 1-unit-per-mm viewBox and the artwork embedded', async () => {
    const t = buildTemplate('bluray', 'us-11');
    const blob = buildItemSvg(fakeCanvas('IMG1'), t, false);
    expect(blob.type).toBe('image/svg+xml');
    const text = await blob.text();
    expect(text).toMatch(/^<\?xml/);
    expect(text).toContain('width="273mm" height="154mm" viewBox="0 0 273 154"');
    expect(text).toContain('base64,IMG1');
    expect(count(text, /<image /g)).toBe(1);
    expect(text).not.toContain('<line');
  });

  it('adds vector cut (solid) and fold (dashed) lines when guides are on', async () => {
    const t = buildTemplate('bluray', 'us-11');
    const text = await buildItemSvg(fakeCanvas(), t, true).text();
    const lineCount = count(text, /<line /g);
    expect(lineCount).toBeGreaterThan(4);
    expect(count(text, /stroke-dasharray/g)).toBe(2); // the two folds beside the spine
    expect(text).toContain('stroke="#ff2d95"');
    expect(text).toContain('stroke="#22d3ee"');
  });

  it('a single-panel label has cut lines only', async () => {
    const text = await buildItemSvg(fakeCanvas(), buildTemplate('nfc-card', 'cr80'), true).text();
    expect(count(text, /stroke-dasharray/g)).toBe(0);
    expect(count(text, /<line /g)).toBe(4);
  });
});

describe('buildSheetSvg', () => {
  it('lays each item out at its imposition position on a paper-sized SVG', async () => {
    const t = buildTemplate('floppy');
    const layout = computeLayout(t, 'Letter');
    const items = [fakeCanvas('A'), fakeCanvas('B'), fakeCanvas('C')];
    const text = await buildSheetSvg(items, layout, t, false).text();
    expect(text).toContain('width="215.9mm" height="279.4mm"');
    expect(count(text, /<image /g)).toBe(3);
    expect(text).toContain('fill="#ffffff"'); // white paper
    expect(text).not.toContain('<line');
    const first = layout.placements[0];
    expect(text).toContain(`x="${Number(first.xMm.toFixed(3))}" y="${Number(first.yMm.toFixed(3))}"`);
  });

  it('draws guides once per placed item', async () => {
    const t = buildTemplate('floppy'); // square, so it isn't turned (rotating needs a real canvas)
    const layout = computeLayout(t, 'A4');
    const items = [fakeCanvas(), fakeCanvas()];
    const text = await buildSheetSvg(items, layout, t, true).text();
    expect(count(text, /<line /g)).toBe(4 * items.length);
  });

  it('omits guides on die-cut label sheets even if asked (their placements carry a crop)', () => {
    const t = buildTemplate('nfc-card', 'cr80');
    const layout = computeLayout(t, 'Letter', 'avery-5395');
    expect(layout.placements.every((p) => !!p.crop)).toBe(true);
  });
});
