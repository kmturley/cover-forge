import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState, reducer } from './AppContext';
import { backupBeforeLink, clearBackup, loadBackup, restoreSession, saveSession, serializeSession } from './session';
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
    s = reducer(s, { type: 'setItemTemplate', items: ['steam-1'], template: 'bluray-us-11' });
    s = reducer(s, { type: 'setBanner', banner: false });
    s = reducer(s, { type: 'updatePanel', id: null, panel: 'front', patch: { backgroundColor: '#123456', transform: { scale: 1.2 } } });
    s = reducer(s, { type: 'updateSpine', id: null, patch: { textHeightMm: 5, textTemplate: '{title} ({year})' } });
    s = reducer(s, { type: 'updatePanel', id: 'steam-1', panel: 'spine', patch: { backgroundColor: '#ff0000', image: 'logo', transform: { xMm: 1, opacity: 0.5 } } });
    const back = restoreSession(JSON.parse(JSON.stringify(serializeSession(s))), initialState);
    expect(back).toEqual(s);
  });

  it('round-trips the empty-queue template', () => {
    const s = reducer(initialState, { type: 'setItemTemplate', items: [], template: 'dvd-slim-9' });
    const back = restoreSession(JSON.parse(JSON.stringify(serializeSession(s))), initialState);
    expect(back.templateId).toBe('dvd-slim-9');
    expect(back.template.id).toBe('dvd-slim-9');
    expect(back.lastTemplates).toEqual({});
  });

  it('repairs an unknown template kind or variant', () => {
    const s = restoreSession({ app: 'coverforge', version: 2, items: [], options: { templateKind: 'laserdisc', variantId: 'x' } }, initialState);
    expect(s.templateId).toBe('dvd-std-14');
    const t = restoreSession({ app: 'coverforge', version: 2, items: [], options: { templateKind: 'vhs', variantId: 'bogus' } }, initialState);
    expect(t.templateId).toBe('vhs-std-25');
    const u = restoreSession({ app: 'coverforge', version: 2, items: [{ ...item, templateId: 'nope' }], options: { templateId: 'cd-jewel', lastTemplates: { game: 'x', music: 'cd-jewel', bogus: 'cd-jewel' } } }, initialState);
    expect(u.items[0].templateId).toBe('cd-jewel');
    expect(u.lastTemplates).toEqual({ music: 'cd-jewel' });
  });

  it('moves a save from before per-item templates onto its one template, which new items keep getting', () => {
    const old = { app: 'coverforge', version: 2, items: [item], options: { templateKind: 'game-case', variantId: 'ps4', styleOverlay: 'digital', view: '3d' } };
    const s = restoreSession(old, initialState);
    expect(s.items[0].templateId).toBe('game-case-ps4');
    expect(s.template.id).toBe('game-case-ps4');
    expect(s.lastTemplates).toEqual({ game: 'game-case-ps4' });
    expect(s.banner).toBe(true);
    const retro = restoreSession({ ...old, items: [], options: { ...old.options, styleOverlay: 'retro' } }, initialState);
    expect([retro.banner, retro.lastTemplates]).toEqual([false, {}]);
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
    expect(s.templateId).toBe('bluray-us-11'); // EU cases are no longer offered: the US standard instead
    expect(s.view).toBe(initialState.view);
    expect(s.showGuides).toBe(initialState.showGuides);
    // Unknown panel dropped; the back's barcode is pinned off, as it was when this (pre-template) save was made.
    expect(s.shared.panels).toEqual({ front: { image: 'hero' }, back: { code: { kind: 'none' } } });
    expect(s.shared.spine).toEqual(initialState.shared.spine);
  });

  it('keeps an old save looking as it did: no default barcode, "Subtitle · Title" spines', () => {
    const doc = { app: 'coverforge', version: 2, items: [{ ...item, subtitle: 'Valve' }], selectedItemId: 'steam-1', options: { templateKind: 'dvd', variantId: 'std-14' } };
    const s = restoreSession(doc, initialState);
    expect(s.shared.panels.back?.code).toEqual({ kind: 'none' });
    expect(s.shared.spine.textTemplate).toBe('{subtitle} · {title}');
    // A barcode the save chose itself is kept.
    const chose = restoreSession({ ...doc, shared: { panels: { back: { code: { kind: 'qr' } } }, spine: {} } }, initialState);
    expect(chose.shared.panels.back?.code).toEqual({ kind: 'qr' });
  });

  it('pins nothing for a save made with per-item templates', () => {
    const doc = { app: 'coverforge', version: 2, items: [{ ...item, subtitle: 'Valve', templateId: 'dvd-std-14' }], selectedItemId: 'steam-1', options: { templateId: 'dvd-std-14' } };
    const s = restoreSession(doc, initialState);
    expect(s.shared.panels.back).toBeUndefined();
    expect(s.shared.spine.textTemplate).toBeUndefined();
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
    // Blu-ray Elite (12.5 mm) is no longer offered, but the save keeps printing at the size it was made for.
    expect(s.templateId).toBe('bluray-us-12.5');
    expect(s.items[0].templateId).toBe('bluray-us-12.5');
    expect(s.shared.spine).toEqual({ fontFamily: 'Georgia, serif', color: '#ff0' });
    expect(s.items[0].panels?.back?.transform).toEqual({ scale: 2 });
  });
});

describe('the visitor’s session when a shared link replaces it', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('is set aside before the link’s session is saved over it, and can be restored', () => {
    vi.stubGlobal('localStorage', memory());
    const own = reducer(initialState, { type: 'addItem', item });
    saveSession(own);
    backupBeforeLink();
    saveSession(initialState); // the link's session, autosaved
    expect(loadBackup(initialState)?.items.map((i) => i.id)).toEqual(['steam-1']);
  });

  it('is not overwritten by a second link, whose saved session is the first link’s', () => {
    vi.stubGlobal('localStorage', memory());
    saveSession(reducer(initialState, { type: 'addItem', item }));
    backupBeforeLink();
    saveSession(initialState);
    backupBeforeLink();
    expect(loadBackup(initialState)?.items).toHaveLength(1);
    clearBackup();
    expect(loadBackup(initialState)).toBeNull();
  });
});
