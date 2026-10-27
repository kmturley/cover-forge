import type { MediaItem } from '../../types/media';
import type { Layer } from '../../types/layers';
import { spineText } from '../SpineTypography';
import type { FontRequest } from '../../fonts/loader';

/** The fonts the visible text layers need, with the words they'll draw, so exactly those can be loaded before drawing. */
export function layerFonts(layers: readonly Layer[], item: MediaItem | null): FontRequest[] {
  if (!item) return [];
  const out = new Map<string, FontRequest>();
  for (const l of layers) {
    if (l.type !== 'text' || !l.visible) continue;
    const text = spineText(item, { text: l.text, textTemplate: l.textTemplate });
    // A spine's own title is always drawn in bold roman; text in a box uses the layer's weight and style.
    const boxed = l.placement !== null;
    const req: FontRequest = { family: l.fontFamily, weight: boxed ? l.weight : 700, italic: boxed ? l.italic : false, text };
    const key = `${req.family}|${req.weight}|${req.italic}`;
    const have = out.get(key);
    out.set(key, have ? { ...have, text: have.text + text } : req);
  }
  return [...out.values()];
}
