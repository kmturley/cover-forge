import { describe, expect, it } from 'vitest';
import type { Design, SharedSettings } from '../../types/editor';
import type { MediaItem } from '../../types/media';
import { buildTemplateById } from '../../templates';
import { LANDSCAPE, turnedRect, turnedTemplate, turnsOf } from './turn';

const shared = (panels: SharedSettings['panels'] = {}): SharedSettings => ({ panels, spine: { fontFamily: 'sans-serif', color: '#fff' } });
const item = (panels: MediaItem['panels'], designId?: string): MediaItem => ({ id: 'i', type: 'game', title: 'T', sourceId: '1', assets: { cover: null, hero: null, logo: null, screenshots: [] }, panels, designId }) as MediaItem;

describe('turns', () => {
  it('is empty until a panel asks to be turned', () => {
    expect(turnsOf({ item: item(undefined), shared: shared() })).toEqual({});
  });

  it('reads the Default design, then the item\'s design, then the item: the last to say anything wins', () => {
    const design: Design = { id: 'd', name: 'D', panels: { front: { turn: -90 } }, spine: {} };
    const s = shared({ front: { turn: 90 }, back: { turn: -90 } });
    expect(turnsOf({ item: item(undefined), shared: s })).toEqual({ front: 90, back: -90 });
    expect(turnsOf({ item: item(undefined, 'd'), shared: s, designs: [design] })).toEqual({ front: -90, back: -90 });
    expect(turnsOf({ item: item({ front: { turn: 0 } }, 'd'), shared: s, designs: [design] })).toEqual({ back: -90 });
  });

  it('turns only the front and the back', () => {
    expect(turnsOf({ item: item({ spine: { turn: 90 } } as never), shared: shared({ spine: { turn: 90 } } as never) })).toEqual({});
  });

  it('has Landscape turn the front +90 and the back -90', () => {
    expect(LANDSCAPE).toEqual({ front: 90, back: -90 });
  });
});

describe('the turned template', () => {
  const t = buildTemplateById('game-case-nes');
  const front = t.panels.find((p) => p.id === 'front')!;

  it('swaps a turned panel\'s width and height about its centre', () => {
    const r = turnedRect(front);
    expect([r.widthMm, r.heightMm]).toEqual([front.heightMm, front.widthMm]);
    expect(r.xMm + r.widthMm / 2).toBeCloseTo(front.xMm + front.widthMm / 2);
    expect(r.yMm + r.heightMm / 2).toBeCloseTo(front.yMm + front.heightMm / 2);
  });

  it('leaves every other panel, and a template with nothing turned, as it was', () => {
    expect(turnedTemplate(t, {})).toBe(t);
    const v = turnedTemplate(t, { front: 90 });
    expect(v.panels.find((p) => p.id === 'spine')).toBe(t.panels.find((p) => p.id === 'spine'));
    expect(v.panels.find((p) => p.id === 'back')).toBe(t.panels.find((p) => p.id === 'back'));
    expect(v.panels.find((p) => p.id === 'front')!.widthMm).toBe(front.heightMm);
  });
});
