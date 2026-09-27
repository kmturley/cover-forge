import { describe, expect, it } from 'vitest';
import { buildTemplateById } from '.';
import { LIBRARY, defaultTemplateFor, getEntry, searchLibrary, upgradeTemplateId } from './library';

describe('template library', () => {
  it('has one entry per template, each building to its own id', () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
    for (const e of LIBRARY) expect(buildTemplateById(e.id).id).toBe(e.id);
  });

  it('never shows a region, and upgrades removed templates in old saves', () => {
    for (const e of LIBRARY) expect(e.name, e.id).not.toMatch(/\b(US|EU|PAL|NTSC)\b/);
    expect(upgradeTemplateId('bluray-eu-14')).toBe('bluray-us-11');
    expect(upgradeTemplateId('game-case-ps1-pal')).toBe('game-case-ps1');
    expect(upgradeTemplateId('laserdisc')).toBeUndefined();
  });

  it('builds the default template for an unknown id', () => {
    expect(buildTemplateById('laserdisc').id).toBe('dvd-std-14');
  });

  it('uses standard names, never measurements, except where the measurement is the name', () => {
    for (const e of LIBRARY) expect(e.name, e.id).not.toMatch(/\d\s*mm|×/);
    expect(['dvd-slim-9', 'nfc-sticker-35', 'vinyl-7inch'].map((id) => getEntry(id)?.name)).toEqual(['DVD Slim', 'NFC Sticker Large', 'Vinyl 7"']);
  });

  it('names game cases by platform and shows sizes', () => {
    expect(getEntry('game-case-ps4')).toMatchObject({ name: 'PS4', short: 'PS4', group: 'Games', size: '129.5 × 161 mm · 14 mm spine' });
    expect(getEntry('bluray-us-11')).toMatchObject({ name: 'Blu-ray', short: 'Blu-ray', size: '128 × 149 mm · 11 mm spine' });
  });

  it('searches every word, by name, maker or group', () => {
    expect(searchLibrary('nintendo').map((e) => e.variantId)).toEqual(['switch', 'switch2', 'wii-u', 'wii', 'gamecube']);
    expect(searchLibrary('blu ray').map((e) => e.id)).toEqual(['bluray-us-11']);
    expect(searchLibrary('')).toHaveLength(LIBRARY.length);
  });

  it('defaults to the last case for the type, then the original, then (custom items) the fallback', () => {
    expect(defaultTemplateFor('game', { game: 'game-case-ps2' }, 'vinyl-12inch')).toBe('game-case-ps2');
    expect(defaultTemplateFor('music', { game: 'game-case-ps2', music: 'nope' }, 'vinyl-12inch')).toBe('cd-jewel');
    expect(defaultTemplateFor('custom', {}, 'vinyl-12inch')).toBe('vinyl-12inch');
  });
});
