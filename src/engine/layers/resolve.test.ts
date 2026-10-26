import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../types/media';
import type { Design, PanelSettings, SharedSettings } from '../../types/editor';
import type { CodeLayer, ImageLayer, Layer, ShapeLayer } from '../../types/layers';
import { buildTemplateById } from '../../templates';
import { designOf, layeredShared } from '../designs';
import { PANEL_IDS, resolvePanel } from '../resolve';
import { defaultLayers } from './defaults';
import { placementToBox } from './placement';
import { resolveLayers } from './resolve';

const item: MediaItem = { id: 'i', type: 'game', title: 'T', assets: { cover: 'c', hero: 'h', logo: null, screenshots: [] } };
const shared = (panels: SharedSettings['panels'] = {}): SharedSettings => ({ panels, spine: { fontFamily: 'Arial', color: '#fff' } });

const find = <T extends Layer>(ls: Layer[], id: string) => ls.find((l) => l.id === id) as T;

describe('defaultLayers', () => {
  const t = buildTemplateById('game-case-ps4');
  const ls = defaultLayers(t);

  it('has unique ids named by target', () => {
    expect(new Set(ls.map((l) => l.id)).size).toBe(ls.length);
    expect(ls.map((l) => l.id)).toEqual(expect.arrayContaining(['front.fill', 'front.image', 'back.image', 'spine.text', 'front.logo', 'back.code', 'branded.front']));
  });

  it('draws panel by panel (fill, image, border), then logos and codes, the Branded dress, and the spine title on top', () => {
    const order = ls.map((l) => l.id);
    expect(order.indexOf('front.fill')).toBeLessThan(order.indexOf('front.image'));
    expect(order.indexOf('front.image')).toBeLessThan(order.indexOf('front.border'));
    expect(order.indexOf('front.border')).toBeLessThan(order.indexOf('front.logo'));
    expect(order.indexOf('front.logo')).toBeLessThan(order.indexOf('front.code'));
    expect(order.indexOf('front.code')).toBeLessThan(order.indexOf('branded.front'));
    expect(order.indexOf('branded.front')).toBeLessThan(order.indexOf('spine.text'));
  });

  it('puts a barcode on the back of most cases and none on a cassette', () => {
    expect(find<CodeLayer>(ls, 'back.code').params.kind).toBe('ean13');
    expect(find<CodeLayer>(ls, 'front.code').params.kind).toBe('none');
    expect(find<CodeLayer>(defaultLayers(buildTemplateById('cassette-std')), 'back.code').params.kind).toBe('none');
  });

  it('gives a plain dust flap only a fill that mirrors its panel', () => {
    const box = defaultLayers(buildTemplateById('nfc-box-card'));
    expect(box.filter((l) => l.target === 'dustTopLeft').map((l) => l.id)).toEqual(['dustTopLeft.fill']);
    expect(find<ShapeLayer>(box, 'dustTopLeft.fill').follows).toBe('spine.fill');
  });

  it('is the same list for the same template', () => {
    expect(defaultLayers(t)).toBe(ls);
  });
});

describe('resolveLayers matches the slot resolver', () => {
  const t = buildTemplateById('bluray-us-11');
  const design: Design = { id: 'd', name: 'd', panels: { front: { backgroundColor: '#d00', transform: { box: { xStart: 10, xEnd: 90, yStart: 5, yEnd: 95 } } } }, spine: {} };
  const cases: [string, SharedSettings, Design | undefined, Partial<Record<string, PanelSettings>> | undefined][] = [
    ['nothing set', shared(), undefined, undefined],
    ['shared only', shared({ front: { backgroundColor: '#123', image: 'hero', transform: { box: { xStart: 0, xEnd: 50, yStart: 0, yEnd: 50 }, fit: 'fit', rotationDeg: 5, opacity: 0.5 } }, back: { code: { kind: 'qr', color: '#0a0' }, border: { widthMm: 1 } } }), undefined, undefined],
    ['design over shared', shared({ front: { backgroundColor: '#123', transform: { box: null } } }), design, undefined],
    ['item over design', shared({ front: { logo: { brand: 'steam', color: '#f00' } } }), design, { front: { logo: { color: '#00f' }, transform: { opacity: 0.3 } }, back: { image: null } }],
    ['mm placement under a box', shared({ front: { transform: { xMm: 4, yMm: 6, scale: 1.2 } as never } }), undefined, { front: { transform: { box: { xStart: 1, xEnd: 99, yStart: 1, yEnd: 99 } } } }],
    ['box under mm placement', shared({ front: { logo: { brand: 'steam', box: { xStart: 1, xEnd: 40, yStart: 1, yEnd: 40 } } } }), undefined, { front: { logo: { widthMm: 20, xMm: 3 } as never } }],
    ['mm merged across levels', shared({ front: { transform: { xMm: 4, yMm: 6 } as never } }), undefined, { front: { transform: { scale: 2 } as never } }],
    ['invalid box is automatic', shared({ front: { transform: { box: { xStart: 50, xEnd: 10, yStart: 0, yEnd: 10 } } } }), undefined, undefined],
  ];

  for (const [name, sh, d, ov] of cases) {
    it(name, () => {
      const it_: MediaItem = { ...item, ...(d && { designId: d.id }), ...(ov && { panels: ov as never }) };
      const layers = resolveLayers({ template: t, item: it_, shared: sh, designs: d ? [d] : [] });
      const merged = layeredShared(sh, designOf(d ? [d] : [], it_));
      for (const id of PANEL_IDS) {
        if (!t.panels.some((p) => p.id === id)) continue;
        const r = resolvePanel(merged, it_, id, t.kind);
        const rect = t.panels.find((p) => p.id === id)!;
        expect(find<ShapeLayer>(layers, `${id}.fill`).fill, `${id} fill`).toBe(r.backgroundColor);
        expect(find<ShapeLayer>(layers, `${id}.border`).stroke, `${id} border`).toEqual(r.border);

        const image = find<ImageLayer>(layers, `${id}.image`);
        expect(image.fit).toBe(r.transform.fit);
        expect(image.opacity).toBe(r.transform.opacity);
        expect(image.rotationDeg).toBe(r.transform.rotationDeg);
        expectPlacement(image, r.transform, rect);

        const logo = find<ImageLayer>(layers, `${id}.logo`);
        expect(logo.source?.kind === 'vector' ? logo.source.id : null, `${id} brand`).toBe(r.logo.brand);
        expect(logo.tint).toBe(r.logo.color);
        expectPlacement(logo, r.logo, rect);

        const code = find<CodeLayer>(layers, `${id}.code`);
        expect(code.params).toEqual({ kind: r.code.kind, pattern: r.code.pattern, color: r.code.color, background: r.code.background });
        expectPlacement(code, r.code, rect);
      }
    });
  }
});

/** The layer's placement says what the slot resolver's box and mm fields say. */
function expectPlacement(l: Layer, r: { box?: { xStart: number; xEnd: number; yStart: number; yEnd: number } | null; xMm?: number | null; yMm?: number | null; scale?: number; widthMm?: number | null }, rect: { widthMm: number; heightMm: number }) {
  const p = l.placement;
  if (r.box === undefined) {
    expect(p && 'kind' in p ? { xMm: p.xMm, yMm: p.yMm, scale: p.scale, widthMm: p.widthMm } : p).toEqual({ xMm: r.xMm, yMm: r.yMm, scale: r.scale, widthMm: r.widthMm });
  } else if (r.box === null) {
    expect(p).toBeNull();
  } else {
    expect(p && 'x' in p).toBe(true);
    const b = placementToBox(rect, p as never);
    for (const k of ['xStart', 'xEnd', 'yStart', 'yEnd'] as const) expect(b[k]).toBeCloseTo(r.box[k], 9);
  }
}

describe('assembly panels', () => {
  const t = buildTemplateById('nfc-box-card');

  it('are the flaps and tabs that fold away: they follow a panel and cannot be designed', () => {
    const own = (id: string) => t.panels.find((p) => p.id === id)!;
    for (const id of ['glue', 'tuck', 'bottomTuck', 'dustTopLeft', 'dustTopRight', 'dustBottomLeft', 'dustBottomRight']) expect(own(id).follows, id).toBeDefined();
    for (const id of ['front', 'back', 'spine', 'spineRight', 'top', 'bottom']) expect(own(id).follows, id).toBeUndefined();
    expect([own('glue').follows, own('tuck').follows, own('bottomTuck').follows]).toEqual(['spineRight', 'top', 'bottom']);
  });

  it('take their panel colour, and have no image, border, logo or code layer', () => {
    const layers = resolveLayers({ template: t, item, shared: shared({ top: { backgroundColor: '#123456' }, tuck: { backgroundColor: '#ff0000' } }) });
    expect(find<ShapeLayer>(layers, 'tuck.fill').fill).toBe('#123456');
    expect(layers.filter((l) => l.target === 'tuck').map((l) => l.id)).toEqual(['tuck.fill']);
  });
});

describe('followers', () => {
  it('takes the colour of the panel it follows, as the slot renderer did', () => {
    const t = buildTemplateById('nfc-box-card');
    const layers = resolveLayers({ template: t, item, shared: shared({ spine: { backgroundColor: '#abcdef' } }) });
    expect(find<ShapeLayer>(layers, 'dustTopLeft.fill').fill).toBe('#abcdef');
    expect(find<ShapeLayer>(layers, 'dustBottomRight.fill').fill).toBeNull();
  });
});

describe('the Branded dress', () => {
  const ps1 = buildTemplateById('game-case-ps1');
  const off = (...panels: string[]) => ({ ...shared(), diff: { patch: Object.fromEntries(panels.map((p) => [`branded.${p}`, { visible: false }])) } });
  const resolve = (sh = shared()) => resolveLayers({ template: ps1, item, shared: sh });
  const folder = (ls: Layer[], panel: string) => ls.find((l) => l.id === `branded.${panel}`)!;
  const title = (ls: Layer[]) => ls.find((l) => l.id === 'spine.text') as Extract<Layer, { type: 'text' }>;

  it('has a folder on each side that has some of it, shown unless a design or item hides it', () => {
    expect(folder(resolve(), 'front').visible).toBe(true);
    expect(folder(resolve(), 'spine').visible).toBe(true);
    const ls = resolve(off('spine'));
    expect(folder(ls, 'spine').visible).toBe(false);
    expect(folder(ls, 'front').visible).toBe(true);
  });

  it('files each side’s layers in that side’s folder, whether or not it is shown', () => {
    for (const sh of [shared(), off('front', 'spine')]) {
      const ls = resolve(sh);
      const inside = ls.filter((l) => l.parent === 'branded.front');
      expect(inside.length).toBeGreaterThan(1);
      expect(inside.every((l) => l.target === 'front')).toBe(true);
      expect(ls.indexOf(folder(ls, 'front'))).toBeLessThan(ls.indexOf(inside[0]));
    }
  });

  it('fits the spine title round the dress only while the spine’s folder is shown (PS1 prints it in capitals)', () => {
    expect(title(resolve(off('spine'))).textCase).toBeUndefined();
    expect(title(resolve(off('spine'))).spineFit).toBeUndefined();
    expect(title(resolve()).textCase).toBe('upper');
    expect(title(resolve()).spineFit?.startMm).toBeGreaterThan(5);
    // Hiding the front's dress leaves the spine's title alone.
    expect(title(resolve(off('front'))).textCase).toBe('upper');
  });

  it('can be edited like any layer: a patch on a layer of the dress changes it, and survives hiding and showing the folder', () => {
    for (const hide of [false, true]) {
      const edited = { ...shared(), diff: { patch: { 'branded.front.strip': { fill: '#ff0000' }, ...(hide && { 'branded.front': { visible: false } }) } } };
      const l = resolve(edited).find((x) => x.id === 'branded.front.strip') as ShapeLayer;
      expect(l.fill).toBe('#ff0000');
    }
  });

  it('is the dress of the case it is on', () => {
    const wii = resolveLayers({ template: buildTemplateById('game-case-wii'), item, shared: shared() });
    expect(wii.some((l) => l.id === 'branded.front.strip')).toBe(false);
    expect(wii.some((l) => l.id === 'branded.front.band')).toBe(true);
  });
});
