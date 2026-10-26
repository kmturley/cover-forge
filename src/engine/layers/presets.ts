import type { Design } from '../../types/editor';
import type { Layer, LayerDiff } from '../../types/layers';
import { cssFamily } from '../../fonts/fontsource';
import { newImage, newShape, newText } from './factory';

/**
 * The version of the default layers a design is a diff of. The defaults are a public format (layer-system-plan.md §2.6):
 * their ids and look are frozen once released, so a saved design keeps meaning what it meant. A change that must alter
 * one ships under a new version with a migration. A test snapshots the defaults so an accident can't slip through.
 */
export const DEFAULTS_VERSION = 1;

/** A built-in design: read-only, and copied into your own when you use it. Placed by percent, so it fits any case. */
export interface Preset {
  id: string;
  name: string;
  description: string;
  /** What it changes about the default layers. */
  diff: LayerDiff;
}

const BEBAS = cssFamily('Bebas Neue', 'sans-serif');
const PRESS = cssFamily('Press Start 2P', 'display');
const PLAYFAIR = cssFamily('Playfair Display', 'serif');

const added = (...layers: Layer[]): NonNullable<LayerDiff['added']> => layers.map((layer) => ({ layer }));
const box = (x: number, y: number, w: number, h: number) => ({ x: { anchor: 'start' as const, offset: x, size: w }, y: { anchor: 'start' as const, offset: y, size: h } });
const centred = (w: number, y: number) => ({ x: { anchor: 'center' as const, offset: 50, size: w }, y: { anchor: 'start' as const, offset: y, size: 'auto' as const } });

type TextOptions = NonNullable<Parameters<typeof newText>[2]>;
const title = (id: string, target: 'front' | 'back', o: TextOptions = {}) => newText(id, target, { name: 'Title', ...o });

export const PRESETS: Preset[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Plain dark panels with no picture or barcode: a clean start to build up from.',
    diff: { hidden: ['front.image', 'back.image', 'back.code'], patch: { 'front.fill': { fill: '#1b1d22' }, 'back.fill': { fill: '#1b1d22' }, 'spine.fill': { fill: '#1b1d22' } } },
  },
  {
    id: 'poster',
    name: 'Poster',
    description: 'The cover fills the front, fading to black under a big condensed title.',
    diff: {
      added: added(
        newShape('p-poster-fade', 'front', { name: 'Fade', fill: { axis: 'y', stops: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.85)']] }, placement: { x: { anchor: 'stretch', start: -2, end: -2 }, y: { anchor: 'stretch', start: 55, end: -2 } } }),
        title('p-poster-title', 'front', { text: '{title}', fontFamily: BEBAS, color: '#ffffff', weight: 400, letterSpacing: 30, placement: { x: { anchor: 'stretch', start: 8, end: 8 }, y: { anchor: 'end', offset: 7, size: 13 } }, shadow: { color: '#000000', blurMm: 1.2, xMm: 0, yMm: 0.4 } }),
      ),
    },
  },
  {
    id: 'screenshot-grid',
    name: 'Screenshot grid back',
    description: 'Four screenshots in a grid under the title on the back, as on retail game cases.',
    diff: {
      hidden: ['back.image'],
      patch: { 'back.fill': { fill: '#14161a' } },
      added: added(
        title('p-grid-title', 'back', { text: '{title}', fontFamily: BEBAS, color: '#ffffff', weight: 400, align: 'left', placement: box(6, 5, 88, 10) }),
        ...[0, 1, 2, 3].map((n) =>
          newImage(`p-grid-${n + 1}`, 'back', { kind: 'role', ref: `screenshot:${n}` }, { name: `Screenshot ${n + 1}`, fit: 'fill', placement: box(n % 2 ? 52 : 6, n < 2 ? 20 : 50, 42, 27) }),
        ),
      ),
    },
  },
  {
    id: 'retro-arcade',
    name: 'Retro arcade',
    description: 'A deep blue sleeve with a yellow border and a pixel-font title over the cover.',
    diff: {
      patch: {
        'front.fill': { fill: '#0b0c2a' },
        'back.fill': { fill: '#0b0c2a' },
        'spine.fill': { fill: '#0b0c2a' },
        'front.border': { stroke: { color: '#ffd400', widthMm: 1.2, insetMm: 3 } },
        'back.border': { stroke: { color: '#ffd400', widthMm: 1.2, insetMm: 3 } },
        'spine.text': { color: '#ffd400', fontFamily: PRESS },
      },
      added: added(title('p-arcade-title', 'front', { text: '{title}', fontFamily: PRESS, color: '#ff4fa3', weight: 400, placement: box(8, 6, 84, 14), textStroke: { color: '#000000', widthMm: 0.5 } })),
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'A pale sleeve with the cover set small and a serif title beneath it.',
    diff: {
      hidden: ['front.image'],
      patch: { 'front.fill': { fill: '#f4f1ea' }, 'back.fill': { fill: '#f4f1ea' }, 'spine.fill': { fill: '#f4f1ea' }, 'spine.text': { color: '#222222' } },
      added: added(
        newImage('p-minimal-cover', 'front', { kind: 'role', ref: 'cover' }, { name: 'Cover', fit: 'fit', placement: centred(70, 8) }),
        title('p-minimal-title', 'front', { text: '{title}', fontFamily: PLAYFAIR, color: '#222222', weight: 700, placement: { x: { anchor: 'stretch', start: 8, end: 8 }, y: { anchor: 'end', offset: 6, size: 9 } } }),
      ),
    },
  },
  {
    id: 'gradient-sleeve',
    name: 'Gradient sleeve',
    description: 'A purple-to-pink gradient behind a centred cover and a white title.',
    diff: {
      hidden: ['front.image'],
      patch: {
        'front.fill': { fill: { axis: 'y', stops: [[0, '#1d2671'], [1, '#c33764']] } },
        'back.fill': { fill: { axis: 'y', stops: [[0, '#1d2671'], [1, '#c33764']] } },
        'spine.fill': { fill: '#1d2671' },
      },
      added: added(
        newImage('p-gradient-cover', 'front', { kind: 'role', ref: 'cover' }, { name: 'Cover', fit: 'fit', placement: centred(60, 14) }),
        title('p-gradient-title', 'front', { text: '{title}', color: '#ffffff', placement: { x: { anchor: 'stretch', start: 8, end: 8 }, y: { anchor: 'end', offset: 6, size: 8 } } }),
      ),
    },
  },
];

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);

/** A design a preset makes: your own copy, which only stores what the preset changes. */
export function designFromPreset(preset: Preset, id: string, name: string = preset.name): Design {
  return { id, name, panels: {}, spine: {}, diff: structuredClone(preset.diff), base: DEFAULTS_VERSION };
}
