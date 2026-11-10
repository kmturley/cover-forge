import { describe, expect, it } from 'vitest';
import { initialState, reducer, templateIdOf } from './AppContext';
import type { MediaItem } from '../types/media';
import { dressOf } from '../engine/layers/dress';
import { resolveLayers } from '../engine/layers/resolve';
import { buildTemplateById } from '../templates';
import { CASES, brandLabel, brandOf, caseOf, changeCase, piecesOf, pieceOf, templatesOf } from '../templates/library';

const game: MediaItem = { id: 'a', type: 'game', title: 'A', assets: { cover: null, hero: null, logo: null, screenshots: [] } };
const start = () => reducer(initialState, { type: 'addItem', item: game });
const itemOf = (s: ReturnType<typeof start>) => s.items[0];

describe('a template, its case and its Type', () => {
  it('has the original SNES and NES cases print as a box, with no insert or slipcover', () => {
    for (const id of ['game-case-snes', 'game-case-nes']) {
      expect(piecesOf(id)).toEqual({ insert: null, slipcover: null, box: id });
      expect(pieceOf(id)).toBe('box');
    }
    expect(piecesOf('game-case-pc').insert).toBe('game-case-pc');
    expect(piecesOf('game-case-pc').box).toBe('game-case-pc~box');
  });

  it('names a template\'s brand, and a case for each format once', () => {
    expect(brandOf('game-case-snes')).toBe('snes');
    expect(brandOf('dvd-std-14')).toBe('dvd/std-14');
    expect(brandOf('dvd-slim-7')).toBe('dvd/slim-7');
    expect(brandOf('bluray-slim-7')).toBe('bluray/slim-7');
    expect(brandLabel('snes')).toBe('SNES');
    expect(brandLabel('dvd/std-14')).toBe('DVD');
    expect(brandLabel('dvd/slim-7')).toBe('DVD Slim');
    expect(brandLabel('vinyl/12inch')).toBe('Vinyl 12"');
    expect(brandLabel('uhd/multi4-15')).toBe('Blu-ray 4K UHD (4-disc)');
    expect(CASES.filter((c) => c.label === 'DVD Case')).toHaveLength(1);
    expect(caseOf('game-case-ps2')).toBe('DVD Case');
    expect(caseOf('dvd-std-14')).toBe('DVD Case');
    expect(CASES.map((c) => c.label)).toContain('SNES case');
    // The Game Boy family shares the DS-size case with the DS, and the Switch 2 the Switch's: one entry each.
    for (const label of ['DS case', 'Switch case']) expect(CASES.filter((c) => c.label === label)).toHaveLength(1);
    expect(['game-case-ds', 'game-case-gb', 'game-case-gbc', 'game-case-gba'].map(caseOf)).toEqual(Array(4).fill('DS case'));
    // An NFC card and its box are one case: the box is the card's Box type, so the picker lists the card.
    expect(caseOf('nfc-box-card')).toBe('CR80 Card');
    expect(CASES.map((c) => c.label)).not.toContain('NFC Card Box');
  });

  it('picks the platform a shared case was made for, and a card rather than its box', () => {
    expect(changeCase('game-case-pc', undefined, 'DS case')?.template).toBe('game-case-ds');
    expect(changeCase('game-case-pc', undefined, 'Switch case')?.template).toBe('game-case-switch');
    expect(changeCase('game-case-pc', undefined, 'CR80 Card')?.template).toBe('nfc-card-cr80-duplex');
    // The box is reached by the Type row.
    expect(piecesOf('nfc-card-cr80-duplex').box).toBe('nfc-box-card');
  });

  it('changes the case keeping the branding, and gives the case its own default Type', () => {
    // SNES (a box) on a DVD case: the DVD case's own Type, the insert; its box is one click on the Type row.
    expect(changeCase('game-case-snes', undefined, 'DVD Case')).toEqual({ template: 'game-case-pc', dress: 'snes' });
    expect(changeCase('game-case-pc~box', 'snes', 'DVD Case')).toEqual({ template: 'game-case-pc', dress: 'snes' });
    // Back to the SNES's own case: its brand is native again, so no dress is needed, and it is a box.
    expect(changeCase('game-case-pc', 'snes', 'SNES case')).toEqual({ template: 'game-case-snes', dress: '' });
    expect(changeCase('game-case-ps2', undefined, 'SNES case')).toEqual({ template: 'game-case-snes', dress: 'ps2' });
    expect(changeCase('game-case-ps2', undefined, 'VHS Sleeve')).toEqual({ template: 'vhs-std-25', dress: 'ps2' });
    expect(changeCase('game-case-ps2', undefined, 'no such case')).toBeNull();
  });
});

describe('which template an item is on', () => {
  it('is its brand\'s, whatever case it is on', () => {
    expect(templatesOf('game-case-pc~box', 'snes')).toEqual(['game-case-snes']);
    expect(templatesOf('game-case-pc~box', undefined)).toEqual(['game-case-pc']);
    expect(templatesOf('game-case-snes', undefined)).toEqual(['game-case-snes']);
    expect(templatesOf('bluray-us-11', 'dvd/slim-7')).toEqual(['dvd-slim-7']);
  });
});

describe('choosing a template and a case for an item', () => {
  it('keeps the item\'s branding when its case changes, and drops it when a template is picked', () => {
    let s = reducer(start(), { type: 'setItemTemplate', items: ['a'], template: 'game-case-snes' });
    s = reducer(s, { type: 'setItemCase', items: ['a'], case: 'DVD Case' });
    expect(templateIdOf(s, itemOf(s))).toBe('game-case-pc');
    expect(dressOf(itemOf(s))).toBe('snes');
    s = reducer(s, { type: 'setItemType', items: ['a'], template: 'game-case-pc~box' });
    // The SNES dress is on the DVD-size box.
    const layers = resolveLayers({ template: buildTemplateById('game-case-pc~box'), item: itemOf(s), shared: s.shared, designs: s.designs });
    expect(layers.some((l) => l.id.startsWith('branded.'))).toBe(true);
    s = reducer(s, { type: 'setItemTemplate', items: ['a'], template: 'game-case-ps2' });
    expect(dressOf(itemOf(s))).toBeUndefined();
    expect(templateIdOf(s, itemOf(s))).toBe('game-case-ps2');
  });

  it('keeps the branding when only the Type changes', () => {
    let s = reducer(start(), { type: 'setItemTemplate', items: ['a'], template: 'game-case-snes' });
    s = reducer(s, { type: 'setItemCase', items: ['a'], case: 'DVD Case' });
    for (const template of ['game-case-pc', 'game-case-pc~slipcover', 'game-case-pc~box']) {
      s = reducer(s, { type: 'setItemType', items: ['a'], template });
      expect(templateIdOf(s, itemOf(s))).toBe(template);
      expect(dressOf(itemOf(s))).toBe('snes');
    }
  });

  it('puts the item back on its own case without leaving a dress behind', () => {
    let s = reducer(start(), { type: 'setItemTemplate', items: ['a'], template: 'game-case-snes' });
    s = reducer(s, { type: 'setItemCase', items: ['a'], case: 'DVD Case' });
    s = reducer(s, { type: 'setItemCase', items: ['a'], case: 'SNES case' });
    expect(templateIdOf(s, itemOf(s))).toBe('game-case-snes');
    expect(dressOf(itemOf(s))).toBeUndefined();
  });
});
