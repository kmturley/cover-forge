import { describe, expect, it } from 'vitest';
import { initialState, reducer } from './AppContext';
import { restoreSession, serializeSession } from './session';
import type { MediaItem } from '../types/media';

const item: MediaItem = {
  id: 'steam-1',
  type: 'game',
  title: 'Game',
  assets: { cover: 'c', hero: null, logo: null, screenshots: [] },
};

describe('session', () => {
  it('round-trips through JSON', () => {
    let s = reducer(initialState, { type: 'addItem', item });
    s = reducer(s, { type: 'setTemplate', kind: 'bluray' });
    s = reducer(s, { type: 'setRegion', region: 'EU' });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { backgroundColor: '#123456', transform: { scale: 1.2 } } });
    s = reducer(s, { type: 'updateSpine', id: null, patch: { textHeightMm: 5 } });
    s = reducer(s, { type: 'updatePanel', id: 'steam-1', panel: 'spine', patch: { backgroundColor: '#ff0000', image: 'logo', transform: { xMm: 1, opacity: 0.5 } } });
    const back = restoreSession(JSON.parse(JSON.stringify(serializeSession(s))), initialState);
    expect(back).toEqual(s);
  });

  it('round-trips the template kind and variant', () => {
    let s = reducer(initialState, { type: 'setTemplate', kind: 'dvd' });
    s = reducer(s, { type: 'setVariant', id: 'slim-9' });
    const back = restoreSession(JSON.parse(JSON.stringify(serializeSession(s))), initialState);
    expect(back.templateKind).toBe('dvd');
    expect(back.variantId).toBe('slim-9');
    expect(back.template.id).toBe('dvd-slim-9');
  });

  it('repairs an unknown template kind or variant', () => {
    const s = restoreSession({ app: 'coverforge', version: 2, items: [], options: { templateKind: 'laserdisc', variantId: 'x' } }, initialState);
    expect(s.templateKind).toBe('dvd');
    const t = restoreSession({ app: 'coverforge', version: 2, items: [], options: { templateKind: 'vhs', variantId: 'bogus' } }, initialState);
    expect(t.variantId).toBe('std-25');
  });

  it('does not persist guides: they start off every visit', () => {
    const s = reducer(initialState, { type: 'setShowGuides', show: true });
    expect(serializeSession(s).options).not.toHaveProperty('showGuides');
    const saved = { ...serializeSession(s), options: { ...serializeSession(s).options, showGuides: true } }; // older saves
    expect(restoreSession(saved, initialState).showGuides).toBe(false);
    expect(initialState.showGuides).toBe(false);
  });

  it('falls back to defaults for garbage or unknown versions', () => {
    expect(restoreSession(null, initialState)).toBe(initialState);
    expect(restoreSession({ app: 'coverforge', version: 99 }, initialState)).toBe(initialState);
  });

  it('repairs invalid fields individually', () => {
    const doc = {
      app: 'coverforge',
      version: 2,
      items: [item, { nope: true }],
      selectedItemId: 'missing',
      options: { region: 'EU', spineMm: 11, view: 'sideways', showGuides: 'yes' },
      shared: { panels: { front: { image: 'hero' }, bogus: {} }, spine: 'nope' },
    };
    const s = restoreSession(doc, initialState);
    expect(s.items).toHaveLength(1);
    expect(s.selectedItemId).toBe('steam-1');
    expect(s.variantId).toBe('eu-14'); // the legacy 11 mm spine isn't valid for EU
    expect(s.view).toBe(initialState.view);
    expect(s.showGuides).toBe(initialState.showGuides);
    expect(s.shared.panels).toEqual({ front: { image: 'hero' } }); // unknown panel dropped
    expect(s.shared.spine).toEqual(initialState.shared.spine);
  });

  it('migrates a v1 session: keeps font/colour, drops the old text height, keeps item panels as overrides', () => {
    const v1 = {
      app: 'coverforge',
      version: 1,
      items: [{ ...item, panels: { back: { image: 'hero', transform: { scale: 2 } } } }],
      selectedItemId: 'steam-1',
      options: { region: 'US', spineMm: 12.5, backgroundColor: '#222', spine: { fontFamily: 'Georgia, serif', textHeightMm: 6, color: '#ff0' } },
    };
    const s = restoreSession(v1, initialState);
    expect(s.variantId).toBe('us-12.5');
    expect(s.templateKind).toBe('bluray');
    expect(s.shared.spine).toEqual({ fontFamily: 'Georgia, serif', textHeightMm: 4, color: '#ff0' });
    expect(s.items[0].panels?.back?.transform).toEqual({ scale: 2 });
  });
});
