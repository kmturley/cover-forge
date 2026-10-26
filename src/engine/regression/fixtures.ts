import type { MediaItem } from '../../types/media';
import type { Design, PanelSettings, SharedSettings } from '../../types/editor';
import type { Asset, LayerDiff } from '../../types/layers';
import { newCode, newImage, newShape, newText } from '../layers/factory';
import type { PanelId } from '../../types/template';
import { LOGOS } from '../../brands';
import { LIBRARY } from '../../templates/library';
import { buildTemplateById } from '../../templates';
import type { Scene } from '../CanvasRenderer';

/**
 * The scenes whose rendering is frozen as golden images (see regression.test.ts). They exist to prove that the layer
 * system (layer-system-plan.md) draws exactly what the slot-based editor drew, so they cover every case, the Branded
 * trade dress and each kind of per-panel setting, including the older placement fields saves still carry.
 */
export interface Fixture {
  name: string;
  scene: Scene;
  /** Pixels per mm. Low enough to keep the golden files small, high enough to show a misplaced edge. */
  px: number;
}

export const IMAGES = {
  'test://cover': { width: 600, height: 900, hue: 210 },
  'test://hero': { width: 1200, height: 675, hue: 30 },
  'test://s0': { width: 800, height: 450, hue: 120 },
  'test://s1': { width: 450, height: 800, hue: 300 },
} as const;

export const ITEM: MediaItem = {
  id: 'steam-1',
  type: 'game',
  title: 'Regression Quest',
  subtitle: 'Frozen Edition',
  year: '2026',
  sourceId: '1',
  assets: { cover: 'test://cover', hero: 'test://hero', logo: null, screenshots: ['test://s0', 'test://s1'] },
};

const SPINE_FONT = 'Helvetica, Arial, sans-serif';
const shared = (panels: SharedSettings['panels'] = {}, spine: Partial<SharedSettings['spine']> = {}): SharedSettings => ({
  panels,
  spine: { fontFamily: SPINE_FONT, color: '#ffffff', ...spine },
});

const scene = (templateId: string, o: Partial<Scene> = {}): Scene => ({
  template: buildTemplateById(templateId),
  item: ITEM,
  shared: shared(),
  banner: false,
  showGuides: false,
  ...o,
});

/** Every case in the library, with its Branded trade dress, the default stack and no customisation. */
const everyCase: Fixture[] = LIBRARY.flatMap((e) => [
  { name: `case/${e.id}/branded`, scene: scene(e.id, { banner: true }), px: 1 },
  { name: `case/${e.id}/plain`, scene: scene(e.id), px: 1 },
]);

const item = (panels: Partial<Record<PanelId, PanelSettings>>, rest: Partial<MediaItem> = {}): MediaItem => ({ ...ITEM, panels, ...rest });
const withShared = (templateId: string, panels: SharedSettings['panels'], o: Partial<Scene> = {}, spine?: Partial<SharedSettings['spine']>): Scene =>
  scene(templateId, { shared: shared(panels, spine), ...o });

const BR = 'bluray-us-11';
const withDiff = (templateId: string, diff: LayerDiff, o: Partial<Scene> = {}): Scene => scene(templateId, { shared: { ...shared(), diff }, ...o });
const ASSETS: Record<string, Asset> = { screen: { id: 'screen', name: 'screen.png', source: { kind: 'url', url: 'test://s0' } }, tall: { id: 'tall', name: 'tall.png', source: { kind: 'url', url: 'test://s1' } } };
const PS4 = 'game-case-ps4';
const CD = 'cd-jewel';

const design: Design = {
  id: 'd1',
  name: 'Test design',
  panels: { front: { backgroundColor: '#aa2233', transform: { box: { xStart: 10, xEnd: 90, yStart: 20, yEnd: 80 }, fit: 'fit', rotationDeg: 0, opacity: 1 } }, back: { image: 'screenshot:0' } },
  spine: { color: '#ffee00' },
};

const features: Fixture[] = [
  // Images: fill, fit, boxed, rotated, translucent, none, another library image.
  { name: 'image/fill-default', scene: scene(BR), px: 2 },
  { name: 'image/fit-box-rotated', scene: withShared(BR, { front: { transform: { box: { xStart: 5, xEnd: 70, yStart: 10, yEnd: 60 }, fit: 'fit', rotationDeg: 12, opacity: 0.8 } } }), px: 2 },
  { name: 'image/fill-box-crop', scene: withShared(BR, { front: { transform: { box: { xStart: 20, xEnd: 100, yStart: -5, yEnd: 55 }, fit: 'fill', rotationDeg: 0, opacity: 1 } } }), px: 2 },
  { name: 'image/legacy-mm', scene: withShared(BR, { front: { transform: { xMm: 10, yMm: 5, scale: 1.4 } as never } }), px: 2 },
  { name: 'image/none', scene: withShared(BR, { front: { image: null }, back: { image: null } }), px: 2 },
  { name: 'image/other-library-images', scene: withShared(BR, { front: { image: 'screenshot:1' }, back: { image: 'cover' } }), px: 2 },
  { name: 'image/missing-ref-falls-back', scene: withShared(BR, { front: { image: 'screenshot:9' } }), px: 2 },

  // Backgrounds and borders.
  { name: 'background/colours', scene: withShared(BR, { front: { backgroundColor: '#224488', image: null }, spine: { backgroundColor: '#ffcc00' }, back: { backgroundColor: '#118844', image: null } }), px: 2 },
  { name: 'border/front', scene: withShared(BR, { front: { border: { color: '#ffd700', widthMm: 1.5, insetMm: 4 } } }), px: 2 },
  { name: 'border/all-panels', scene: withShared(PS4, { front: { border: { color: '#ffffff', widthMm: 0.8, insetMm: 2 } }, back: { border: { color: '#ff0066', widthMm: 1, insetMm: 3 } }, spine: { border: { color: '#00ccff', widthMm: 0.5, insetMm: 1 } } }), px: 2 },

  // Logos: automatic, boxed and rotated, legacy mm, on each kind of panel.
  { name: 'logo/auto-front', scene: withShared(BR, { front: { logo: { brand: 'steam' } } }), px: 2 },
  { name: 'logo/boxed-rotated', scene: withShared(BR, { front: { logo: { brand: 'steam', color: '#ffcc00', box: { xStart: 60, xEnd: 95, yStart: 70, yEnd: 95 }, rotationDeg: -15, opacity: 0.7 } } }), px: 2 },
  { name: 'logo/legacy-mm', scene: withShared(BR, { front: { logo: { brand: 'steam', widthMm: 30, xMm: 12, yMm: 20, box: undefined } as never } }), px: 2 },
  { name: 'logo/spine-and-back', scene: withShared(PS4, { spine: { logo: { brand: 'steam' } }, back: { logo: { brand: 'steam', color: '#000000' } } }), px: 2 },
  { name: 'logo/supplied-multicolour', scene: withShared(BR, { front: { logo: { brand: LOGOS[0].id, box: { xStart: 15, xEnd: 85, yStart: 60, yEnd: 90 } } } }), px: 2 },
  { name: 'logo/with-branded', scene: withShared(PS4, { front: { logo: { brand: 'steam' } } }, { banner: true }), px: 2 },

  // Codes: each kind, boxed, rotated, default on the back, none.
  { name: 'code/default-back', scene: scene(BR), px: 3 },
  { name: 'code/qr-front-boxed', scene: withShared(BR, { front: { code: { kind: 'qr', box: { xStart: 60, xEnd: 95, yStart: 55, yEnd: 95 } } } }), px: 3 },
  { name: 'code/upca-back', scene: withShared(BR, { back: { code: { kind: 'upca', pattern: '012345678905' } } }), px: 3 },
  { name: 'code/code128-rotated', scene: withShared(BR, { back: { code: { kind: 'code128', pattern: '{title}', rotationDeg: 90 } } }), px: 3 },
  { name: 'code/none-back', scene: withShared(BR, { back: { code: { kind: 'none' } } }), px: 2 },
  { name: 'code/cassette-has-none', scene: scene('cassette-std'), px: 2 },

  // Spine text.
  { name: 'spine/default', scene: scene(BR), px: 3 },
  { name: 'spine/custom-size-colour-rotated', scene: withShared(BR, {}, {}, { color: '#ffdd33', textHeightMm: 3, rotationDeg: 180 }), px: 3 },
  { name: 'spine/template-text', scene: withShared(CD, {}, {}, { textTemplate: '{creator} · {title} ({year})' }), px: 3 },
  { name: 'spine/item-text', scene: scene(PS4, { item: { ...ITEM, spineOverride: { text: 'Custom spine words', color: '#33ffcc' } } }), px: 3 },
  { name: 'spine/branded-title', scene: scene(PS4, { banner: true }), px: 3 },

  // Layering: designs and per-item overrides on top of the shared settings.
  { name: 'layering/design', scene: scene(BR, { designs: [design], item: { ...ITEM, designId: 'd1' } }), px: 2 },
  { name: 'layering/design-then-item', scene: scene(BR, { designs: [design], item: item({ front: { backgroundColor: '#0044aa', transform: { opacity: 0.5 } }, spine: { logo: { brand: 'steam' } } }, { designId: 'd1' }) }), px: 2 },
  { name: 'layering/item-over-shared', scene: withShared(BR, { front: { backgroundColor: '#442266' } }, { item: item({ front: { backgroundColor: '#226644' }, back: { image: 'screenshot:1' } }) }), px: 2 },
  { name: 'layering/unknown-design-is-default', scene: scene(BR, { item: { ...ITEM, designId: 'gone' } }), px: 2 },

  // Boxes with flaps, a wrap with a flap panel, and the no-item case.
  // Flaps and tabs follow their panel's colour: settings put on them (older saves allowed it) are ignored.
  { name: 'flaps/nfc-box-styled', scene: withShared('nfc-box-card', { front: { backgroundColor: '#336699' }, spine: { backgroundColor: '#993366' }, spineRight: { backgroundColor: '#cc6600' }, top: { backgroundColor: '#669933' }, bottom: { backgroundColor: '#339999' }, tuck: { backgroundColor: '#ff00ff' }, glue: { backgroundColor: '#ffff00' } }), px: 2 },
  { name: 'flaps/cassette-flap', scene: withShared('cassette-std', { flap: { backgroundColor: '#aa5500' } }), px: 2 },
  { name: 'no-item/branded', scene: scene(PS4, { item: null, banner: true }), px: 2 },
  { name: 'no-item/plain', scene: scene(BR, { item: null }), px: 2 },

  // Layers beyond the defaults: placed shapes, text boxes, extra images, focus, layers across panels, order and removal.
  { name: 'layers/shapes-placed', scene: withDiff(BR, { added: [
    { layer: newShape('s1', 'front', { fill: '#ffcc00', placement: { x: { anchor: 'start', offset: 0, size: 80 }, y: { anchor: 'start', offset: 70, size: 12 } } }) },
    { layer: newShape('s2', 'front', { shape: 'ellipse', fill: '#cc0033', stroke: { color: '#ffffff', widthMm: 1, insetMm: 0 }, placement: { x: { anchor: 'end', offset: 6, size: 30 }, y: { anchor: 'start', offset: 8, size: 20 } }, rotationDeg: 15, opacity: 0.85 }) },
    { layer: newShape('s3', 'back', { fill: null, stroke: { color: '#00ffcc', widthMm: 0.8, insetMm: 2 }, placement: { x: { anchor: 'center', offset: 50, size: 60 }, y: { anchor: 'center', offset: 40, size: 30 } } }) },
  ] }), px: 2 },
  { name: 'layers/text-boxes', scene: withDiff(BR, { added: [
    { layer: newText('t1', 'front', { text: '{title}', color: '#ffffff' }) },
    { layer: newText('t2', 'front', { text: 'Left aligned words that have to wrap onto several lines in their box', align: 'left', textHeightMm: 3.5, weight: 400, italic: true, color: '#ffee88', placement: { x: { anchor: 'start', offset: 8, size: 55 }, y: { anchor: 'start', offset: 40, size: 30 } } }) },
    { layer: newText('t3', 'back', { text: '{title} · {year}', align: 'right', color: '#222222', placement: { x: { anchor: 'end', offset: 5, size: 60 }, y: { anchor: 'start', offset: 5, size: 8 } }, rotationDeg: -4 }) },
    { layer: newText('t4', 'spine', { text: 'Placed', color: '#ffff00', placement: { x: { anchor: 'center', offset: 50, size: 100 }, y: { anchor: 'start', offset: 4, size: 10 } } }) },
  ] }), px: 2 },
  { name: 'layers/extra-images', scene: withDiff(BR, { added: [
    { layer: newImage('i1', 'back', { kind: 'asset', id: 'screen' }, { placement: { x: { anchor: 'start', offset: 6, size: 40 }, y: { anchor: 'start', offset: 10, size: 'auto' } } }) },
    { layer: newImage('i2', 'back', { kind: 'asset', id: 'tall' }, { placement: { x: { anchor: 'end', offset: 6, size: 25 }, y: { anchor: 'start', offset: 10, size: 'auto' } }, rotationDeg: 6 }) },
    { layer: newImage('i3', 'front', { kind: 'role', ref: 'screenshot:1' }, { placement: { x: { anchor: 'center', offset: 50, size: 30 }, y: { anchor: 'end', offset: 6, size: 'auto' } }, opacity: 0.9 }) },
    { layer: newImage('i4', 'back', { kind: 'asset', id: 'missing' }, {}) },
  ] }, { assets: ASSETS }), px: 2 },
  { name: 'layers/focus-crop', scene: withDiff(BR, { patch: { 'front.image': { placement: { x: { anchor: 'stretch', start: 15, end: 15 }, y: { anchor: 'stretch', start: 20, end: 20 } }, focus: { x: 0, y: 0 } }, 'back.image': { placement: { x: { anchor: 'stretch', start: 15, end: 15 }, y: { anchor: 'stretch', start: 20, end: 20 } }, focus: { x: 100, y: 100 } } } }), px: 2 },
  { name: 'layers/across-panels', scene: withDiff(BR, { added: [
    { layer: newShape('c1', 'canvas', { fill: '#33333388', placement: { x: { anchor: 'stretch', start: 20, end: 20 }, y: { anchor: 'start', offset: 40, size: 20 } } }) },
    { layer: newShape('c2', 'canvas', { shape: 'ellipse', fill: '#ff8800', placement: { x: { anchor: 'center', offset: 50, size: 30 }, y: { anchor: 'center', offset: 50, size: 60 } }, opacity: 0.8 }) },
    { layer: newText('c3', 'canvas', { text: '{title}', color: '#ffffff', placement: { x: { anchor: 'stretch', start: 10, end: 10 }, y: { anchor: 'start', offset: 5, size: 10 } } }) },
  ] }), px: 2 },
  { name: 'layers/across-box-skips-flaps', scene: withDiff('nfc-box-card', { added: [{ layer: newShape('c1', 'canvas', { fill: '#00aa88' }) }] }), px: 2 },
  { name: 'layers/hidden-and-reordered', scene: withDiff(BR, { hidden: ['front.image'], added: [{ layer: newShape('s1', 'front', { fill: '#2244aa' }), after: 'front.fill' }, { layer: newShape('s2', 'front', { fill: '#aa2244', placement: { x: { anchor: 'start', offset: 40, size: 40 }, y: { anchor: 'start', offset: 40, size: 40 } } }) }, { layer: newShape('s3', 'front', { fill: '#44aa22', placement: { x: { anchor: 'start', offset: 20, size: 40 }, y: { anchor: 'start', offset: 20, size: 40 } } }) }], order: ['s3', 's2'] }), px: 2 },
  { name: 'layers/anchored-logo', scene: withDiff(BR, { patch: { 'front.logo': { source: { kind: 'vector', id: 'steam' }, placement: { x: { anchor: 'center', offset: 50, size: 12 }, y: { anchor: 'start', offset: 6, size: 'auto' } } } } }), px: 2 },
  { name: 'layers/extra-code', scene: withDiff(BR, { added: [{ layer: newCode('q1', 'front', { kind: 'qr' }, { placement: { x: { anchor: 'end', offset: 5, size: 25 }, y: { anchor: 'end', offset: 5, size: 'auto' } } }) }] }), px: 3 },
  { name: 'layers/per-item-and-design', scene: scene(BR, { designs: [{ ...design, diff: { added: [{ layer: newShape('d-shape', 'front', { fill: '#00ccaa', placement: { x: { anchor: 'start', offset: 0, size: 50 }, y: { anchor: 'start', offset: 0, size: 20 } } }) }] } }], item: { ...ITEM, designId: 'd1', diff: { patch: { 'd-shape': { fill: '#ff3366' } }, added: [{ layer: newShape('i-shape', 'back', { fill: '#3366ff' }) }] } } }), px: 2 },

  // Guides and the cut-out view.
  { name: 'view/guides', scene: scene(BR, { showGuides: true }), px: 2 },
  { name: 'view/assembly-hatch', scene: scene('nfc-box-card', { hideOutsideCut: true, markAssembly: true }), px: 2 },
  { name: 'view/hide-outside-cut', scene: scene(PS4, { hideOutsideCut: true, banner: true }), px: 2 },
];

export const FIXTURES: Fixture[] = [...features, ...everyCase];
