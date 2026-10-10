import { describe, expect, it } from 'vitest';
import { buildTemplateById } from '.';
import { LIBRARY, LIBRARY_GROUPS, defaultTemplateFor, getEntry, groupFor, originalTemplateFor, searchLibrary, upgradeTemplateId } from './library';

describe('template library', () => {
  it('has one entry per template, each building to its own id', () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
    for (const e of LIBRARY) expect(buildTemplateById(e.id).id).toBe(e.id);
  });

  it('never shows a region, and upgrades removed templates in old saves', () => {
    for (const e of LIBRARY) expect(e.name, e.id).not.toMatch(/\b(US|EU|PAL|NTSC)\b/);
    // Retired templates are hidden from the library but still resolve, so old saves print at their original size.
    expect(LIBRARY.map((e) => e.id)).not.toContain('bluray-eu-14');
    expect(upgradeTemplateId('bluray-eu-14')).toBe('bluray-eu-14');
    expect(upgradeTemplateId('game-case-ps1-pal')).toBe('game-case-ps1');
    expect(upgradeTemplateId('laserdisc')).toBeUndefined();
  });

  it('builds the default template for an unknown id, and its kind\'s first for an unknown variant', () => {
    expect(buildTemplateById('laserdisc').id).toBe('dvd-std-14');
    expect(buildTemplateById('nfc-card-nonsense').id).toBe('nfc-card-cr80-duplex');
    expect(buildTemplateById('game-case-n64').id).toBe('game-case-pc');
  });

  it('shares frozen templates, so no caller can change them for everyone', () => {
    const t = buildTemplateById('dvd-std-14');
    expect(buildTemplateById('dvd-std-14')).toBe(t);
    expect(Object.isFrozen(t.panels[0])).toBe(true);
  });

  it('uses standard names, never measurements, except where the measurement is the name', () => {
    for (const e of LIBRARY) expect(e.name, e.id).not.toMatch(/\d\s*mm|×/);
    expect(['dvd-slim-7', 'nfc-sticker-35', 'vinyl-7inch'].map((id) => getEntry(id)?.name)).toEqual(['DVD Slim', 'NFC Sticker Large', 'Vinyl 7"']);
  });

  it('names game cases by platform and shows sizes', () => {
    expect(getEntry('game-case-ps4')).toMatchObject({ name: 'PS4', short: 'PS4', group: 'Games', size: '129.5 × 161 mm · 14 mm spine' });
    expect(getEntry('bluray-us-11')).toMatchObject({ name: 'Blu-ray', short: 'Blu-ray', size: '128 × 149 mm · 11 mm spine' });
  });

  it('lists each group by name, numbers in order', () => {
    for (const group of LIBRARY_GROUPS) {
      const names = LIBRARY.filter((e) => e.group === group).map((e) => e.name);
      expect(names, group).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })));
    }
    expect(LIBRARY.filter((e) => e.kind === 'vinyl').map((e) => e.name)).toEqual(['Vinyl 7"', 'Vinyl 10"', 'Vinyl 12"']);
  });

  it('names the standard case a print fits (or Custom), with its size', () => {
    const detail = (id: string) => getEntry(id)?.detail;
    expect(detail('cd-jewel')).toBe('CD Jewel Case · 120 × 120 mm · 6.5 mm spine');
    expect(detail('game-case-ps1')).toBe('CD Jewel Case · 120 × 120 mm · 6.5 mm spine');
    expect(detail('dvd-std-14')).toBe('DVD Case · 129.5 × 183 mm · 14 mm spine');
    expect(detail('game-case-ps2')).toBe('DVD Case · 129.5 × 183 mm · 14 mm spine'); // a PS2 insert is a DVD case insert
    expect(detail('dvd-slim-7')).toBe('DVD Slim Case · 129.5 × 183 mm · 7 mm spine');
    expect(detail('game-case-xbox-one')).toBe('Blu-ray Case · 128 × 149 mm · 11 mm spine');
    expect(detail('vhs-std-25')).toBe('VHS Sleeve · 105 × 190 mm · 25 mm spine');
    expect(detail('nfc-card-cr80-duplex')).toBe('CR80 Card · 54 × 85.6 mm');
    expect(detail('vinyl-7inch')).toBe('7" Single Sleeve · 184 × 184 mm · 3 mm spine');
    expect(detail('game-case-ps4')).toBe('Custom · 129.5 × 161 mm · 14 mm spine');
    expect(detail('game-case-switch')).toBe('Custom · 99 × 161 mm · 10 mm spine');
    expect(detail('nfc-sticker-25')).toBe('Custom · 25 × 25 mm');
    expect(searchLibrary('jewel').map((e) => e.id)).toEqual(['game-case-ps1', 'cd-jewel']);
  });

  it('knows each media type’s own group and original case', () => {
    expect([groupFor('game'), groupFor('movie'), groupFor('tv'), groupFor('music'), groupFor('custom')]).toEqual(['Games', 'Movies & TV', 'Movies & TV', 'Music', null]);
    expect([originalTemplateFor('game'), originalTemplateFor('music'), originalTemplateFor('custom')]).toEqual(['game-case-pc', 'cd-jewel', null]);
  });

  it('searches every word, by name, maker or group', () => {
    // By name within a group.
    expect(searchLibrary('nintendo').map((e) => e.name)).toEqual(['GameCube', 'Nintendo Switch', 'Nintendo Switch 2', 'Wii', 'Wii U']);
    // The standard case counts too: Xbox One and Series X|S covers fit a Blu-ray case, as does the Blu-ray 4K UHD one.
    expect(searchLibrary('blu ray').map((e) => e.id)).toEqual(['game-case-xbox-one', 'game-case-xbox-series', 'bluray-us-11', 'uhd-us-11', 'bluray-slim-7']);
    expect(searchLibrary('')).toHaveLength(LIBRARY.length);
  });

  it('defaults to the last case for the type, then the original, then (custom items) the fallback', () => {
    expect(defaultTemplateFor('game', { game: 'game-case-ps2' }, 'vinyl-12inch')).toBe('game-case-ps2');
    expect(defaultTemplateFor('music', { game: 'game-case-ps2', music: 'nope' }, 'vinyl-12inch')).toBe('cd-jewel');
    expect(defaultTemplateFor('custom', {}, 'vinyl-12inch')).toBe('vinyl-12inch');
  });
});
