import { describe, expect, it } from 'vitest';
import type { SharedSettings } from '../../types/editor';
import type { MediaItem } from '../../types/media';
import { buildTemplateById } from '../../templates';
import { brandingFor } from '../official';
import { NO_DRESS, dressOf, withDress } from './dress';
import { resolveLayers } from './resolve';

const shared = (panels: SharedSettings['panels'] = {}): SharedSettings => ({ panels, spine: { fontFamily: 'sans-serif', color: '#fff' } });
const item = (panels: MediaItem['panels'], designId?: string): MediaItem => ({ id: 'i', type: 'game', title: 'T', sourceId: '1', assets: { cover: null, hero: null, logo: null, screenshots: [] }, panels, designId }) as MediaItem;

describe('the dress setting', () => {
  it('belongs to the item: unset until a template or case sets it, and a design\'s or the Default design\'s is ignored', () => {
    expect(dressOf(item(undefined))).toBeUndefined();
    expect(dressOf(item({ front: { dress: 'snes' } }))).toBe('snes');
    expect(dressOf(item({ front: { dress: NO_DRESS } }))).toBe(NO_DRESS);
    expect(dressOf(null)).toBeUndefined();
    // A dress an older version left on the Default design or a design does nothing: the item's template says what it is.
    const stale = resolveLayers({ template: buildTemplateById('game-case-pc'), item: item(undefined), shared: shared({ front: { dress: '3ds' } }) }).map((l) => l.id);
    const plain = resolveLayers({ template: buildTemplateById('game-case-pc'), item: item(undefined), shared: shared() }).map((l) => l.id);
    expect(stale).toEqual(plain);
  });

  it('marks the template with the dress, once, and leaves it alone with none', () => {
    const t = buildTemplateById('game-case-pc');
    expect(withDress(t, undefined)).toBe(t);
    expect(withDress(t, 'snes')).toBe(withDress(t, 'snes'));
    expect(withDress(t, 'snes').dress).toBe('snes');
  });

  it('draws that platform\'s branding instead of the case\'s own, or none', () => {
    expect(brandingFor('game-case', 'pc', 'snes')).toBe(brandingFor('game-case', 'snes'));
    expect(brandingFor('game-case', 'pc', 'none').front).toEqual({ shape: 'none', marks: [] });
    expect(brandingFor('game-case', 'pc', 'not-a-platform')).toBe(brandingFor('game-case', 'pc'));
    // A format's, by template: its own variant's where it has one, else the format's.
    expect(brandingFor('game-case', 'pc', 'dvd/slim-7')).toBe(brandingFor('dvd', 'slim-7'));
    expect(brandingFor('game-case', 'pc', 'bluray/slim-7')).toBe(brandingFor('bluray', 'slim-7'));
    expect(brandingFor('game-case', 'pc', 'bluray/slim-7')).not.toBe(brandingFor('bluray', 'us-11'));
  });

  it('puts the SNES dress on a DVD-size case, and takes the dress off', () => {
    const t = buildTemplateById('game-case-pc');
    const ids = (dress?: string) => resolveLayers({ template: t, item: item(dress === undefined ? undefined : { front: { dress } }), shared: shared() }).map((l) => l.id);
    expect(ids('snes')).toContain('branded.front.foot');
    expect(ids()).not.toContain('branded.front.foot');
    expect(ids(NO_DRESS).some((id) => id.startsWith('branded.'))).toBe(false);
  });
});
