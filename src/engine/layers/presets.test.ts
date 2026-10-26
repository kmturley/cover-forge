import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../types/media';
import { LIBRARY } from '../../templates/library';
import { buildTemplateById } from '../../templates';
import { defaultLayers } from './defaults';
import { applyDiff } from './diff';
import { PRESETS, DEFAULTS_VERSION, designFromPreset, presetById } from './presets';
import { sanitizeDiff } from './sanitize';
import { resolveLayers } from './resolve';

const item: MediaItem = { id: 'i', type: 'game', title: 'T', assets: { cover: 'c', hero: 'h', logo: null, screenshots: ['a', 'b', 'c', 'd'] } };

describe('presets', () => {
  it('have unique ids and names, and say what they are', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(p.description.length, p.id).toBeGreaterThan(20);
  });

  it('survive the checks a saved design goes through unchanged, so a file or link keeps them whole', () => {
    for (const p of PRESETS) expect(sanitizeDiff(JSON.parse(JSON.stringify(p.diff))), p.id).toEqual(p.diff);
  });

  it('only change layers every case has or add their own, with ids no other layer uses', () => {
    for (const e of LIBRARY.filter((l) => l.kind === 'bluray' || l.kind === 'game-case' || l.kind === 'dvd')) {
      const t = buildTemplateById(e.id);
      const base = defaultLayers(t);
      const ids = new Set(base.map((l) => l.id));
      for (const p of PRESETS) {
        const out = applyDiff(base, p.diff);
        expect(new Set(out.map((l) => l.id)).size, `${e.id} ${p.id}`).toBe(out.length);
        for (const a of p.diff.added ?? []) expect(ids.has(a.layer.id), a.layer.id).toBe(false);
      }
    }
  });

  it('resolve on every case without throwing, and leave a layer or two of their own', () => {
    for (const e of LIBRARY) {
      for (const p of PRESETS) {
        const design = designFromPreset(p, 'd1');
        const layers = resolveLayers({ template: buildTemplateById(e.id), item: { ...item, designId: 'd1' }, shared: { panels: {}, spine: { fontFamily: 'Arial', color: '#fff' } }, designs: [design], banner: true });
        expect(layers.length, `${e.id} ${p.id}`).toBeGreaterThan(5);
      }
    }
  });

  it('copy into a design of your own that stores only what the preset changes', () => {
    const p = presetById('poster')!;
    const d = designFromPreset(p, 'mine', 'My poster');
    expect(d).toMatchObject({ id: 'mine', name: 'My poster', panels: {}, spine: {}, base: DEFAULTS_VERSION });
    expect(d.diff).toEqual(p.diff);
    expect(d.diff).not.toBe(p.diff);
    expect(designFromPreset(p, 'x').name).toBe('Poster');
  });
});
