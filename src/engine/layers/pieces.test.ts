import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../types/media';
import type { SharedSettings } from '../../types/editor';
import type { Layer, ShapeLayer, TextLayer } from '../../types/layers';
import { buildTemplateById } from '../../templates';
import { resolveLayers } from './resolve';

const shared = (panels: SharedSettings['panels'] = {}): SharedSettings => ({ panels, spine: { fontFamily: 'Arial', color: '#fff' } });
const find = <T extends Layer>(ls: Layer[], id: string) => ls.find((l) => l.id === id) as T | undefined;

// An item designed on a DVD insert: its front is recoloured, and it has a layer on the front and one on the lid
// (a panel only a box has).
const edited: MediaItem = {
  id: 'i',
  type: 'movie',
  title: 'T',
  assets: { cover: 'c', hero: 'h', logo: null, screenshots: [] },
  diff: {
    patch: { 'front.fill': { fill: '#336699' } },
    added: [
      { layer: { id: 'u.front', type: 'shape', shape: 'rect', target: 'front', visible: true, placement: null, rotationDeg: 0, opacity: 1, fill: '#ff0000', stroke: { color: '#000', widthMm: 0, insetMm: 0 } } },
      { layer: { id: 'u.top', type: 'shape', shape: 'rect', target: 'top', visible: true, placement: null, rotationDeg: 0, opacity: 1, fill: '#00ff00', stroke: { color: '#000', widthMm: 0, insetMm: 0 } } },
    ],
  },
};

const resolve = (id: string, item: MediaItem = edited, s = shared()) => resolveLayers({ template: buildTemplateById(id), item, shared: s });

describe('changing the type of an item', () => {
  it('keeps the design on the panels the new type has', () => {
    for (const id of ['dvd-std-14~slipcover', 'dvd-std-14~box']) {
      expect(find<ShapeLayer>(resolve(id), 'front.fill')?.fill, id).toBe('#336699');
      expect(find(resolve(id), 'u.front'), id).toBeDefined();
    }
  });

  it('keeps layers on panels the new type lacks, but doesn\'t draw them', () => {
    // The layer is in the resolved list on a box, which has a lid; a slipcover has no `top`, so nothing places it.
    expect(find(resolve('dvd-std-14~box'), 'u.top')?.target).toBe('top');
    expect(buildTemplateById('dvd-std-14~slipcover').panels.some((p) => p.id === 'top')).toBe(false);
  });

  it('gives the same layers back when you return to the type you started from', () => {
    const before = resolve('dvd-std-14');
    resolve('dvd-std-14~slipcover');
    resolve('dvd-std-14~box');
    expect(resolve('dvd-std-14')).toEqual(before);
    expect(edited.diff?.added).toHaveLength(2);
  });
});

describe('a second spine', () => {
  const clean: MediaItem = { id: 'i', type: 'movie', title: 'T', assets: { cover: 'c', hero: 'h', logo: null, screenshots: [] } };

  it('copies the first spine\'s colour and title until it is edited', () => {
    const ls = resolve('dvd-std-14~slipcover', clean, shared({ spine: { backgroundColor: '#aa0000' } }));
    expect(find<ShapeLayer>(ls, 'spineRight.fill')?.fill).toBe('#aa0000');
    expect(find<TextLayer>(ls, 'spineRight.text')?.color).toBe(find<TextLayer>(ls, 'spine.text')?.color);
  });

  it('takes its own colour once it has one', () => {
    const ls = resolve('dvd-std-14~slipcover', clean, shared({ spine: { backgroundColor: '#aa0000' }, spineRight: { backgroundColor: '#0000aa' } }));
    expect(find<ShapeLayer>(ls, 'spineRight.fill')?.fill).toBe('#0000aa');
    expect(find<ShapeLayer>(ls, 'spine.fill')?.fill).toBe('#aa0000');
  });
});

describe('a box\'s lid and bottom', () => {
  const clean: MediaItem = { id: 'i', type: 'movie', title: 'T', assets: { cover: 'c', hero: 'h', logo: null, screenshots: [] } };
  const fills = (ls: Layer[]) => Object.fromEntries(['spine', 'top', 'bottom', 'tuck', 'bottomTuck'].map((p) => [p, find<ShapeLayer>(ls, `${p}.fill`)?.fill]));

  it('start in the spine colour, and so do their tuck flaps', () => {
    const ls = resolve('dvd-std-14~box', clean, shared({ spine: { backgroundColor: '#aa0000' } }));
    expect(fills(ls)).toEqual({ spine: '#aa0000', top: '#aa0000', bottom: '#aa0000', tuck: '#aa0000', bottomTuck: '#aa0000' });
  });

  it('take a colour of their own once they have one, and the flap follows it', () => {
    const ls = resolve('dvd-std-14~box', clean, shared({ spine: { backgroundColor: '#aa0000' }, top: { backgroundColor: '#0000aa' } }));
    expect(fills(ls)).toEqual({ spine: '#aa0000', top: '#0000aa', bottom: '#aa0000', tuck: '#0000aa', bottomTuck: '#aa0000' });
  });

  it('are left as they were on the VHS and NFC boxes', () => {
    const ls = resolve('vhs-std-25', clean, shared({ spine: { backgroundColor: '#aa0000' } }));
    expect(fills(ls).top).toBeNull();
  });
});
