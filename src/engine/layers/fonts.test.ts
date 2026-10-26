import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../types/media';
import { newText } from './factory';
import { layerFonts } from './fonts';

const item: MediaItem = { id: 'i', type: 'game', title: 'Żółw', year: '2026', assets: { cover: null, hero: null, logo: null, screenshots: [] } };

describe('layerFonts', () => {
  it('asks for each font once, with the words it will draw', () => {
    const out = layerFonts([newText('a', 'front', { fontFamily: '"Lora", serif', text: '{title}' }), newText('b', 'back', { fontFamily: '"Lora", serif', text: '{year}' }), newText('c', 'front', { fontFamily: '"Cinzel", serif', weight: 400, italic: true, text: 'x' })], item);
    expect(out).toEqual([
      { family: '"Lora", serif', weight: 700, italic: false, text: 'Żółw2026' },
      { family: '"Cinzel", serif', weight: 400, italic: true, text: 'x' },
    ]);
  });
  it('leaves out hidden text, and everything when there is no item', () => {
    expect(layerFonts([newText('a', 'front', { visible: false })], item)).toEqual([]);
    expect(layerFonts([newText('a', 'front')], null)).toEqual([]);
  });
  it('asks for bold roman for a spine title, whatever the layer says', () => {
    const title = newText('s', 'spine', { placement: null, weight: 400, italic: true });
    expect(layerFonts([title], item)[0]).toMatchObject({ weight: 700, italic: false });
  });
});
