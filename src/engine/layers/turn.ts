import type { MediaItem } from '../../types/media';
import type { Design, SharedSettings } from '../../types/editor';
import type { PanelId, PanelRect, TemplateConfig } from '../../types/template';
import { designOf } from '../designs';

/** A quarter turn, clockwise (90) or anticlockwise (-90). */
export type Turn = 90 | -90;
/** The panels whose artwork is drawn turned. */
export type Turns = Partial<Record<PanelId, Turn>>;

/** The panels that can be turned: the cover and the back. A spine keeps its own direction, and the rest fold away. */
export const TURNABLE: readonly PanelId[] = ['front', 'back'];

/** Landscape: how the front and the back turn, the way a landscape box's art sits on a portrait sheet: the front clockwise, the back anticlockwise. */
export const LANDSCAPE: Readonly<Record<'front' | 'back', Turn>> = { front: 90, back: -90 };

interface TurnSources {
  item: MediaItem | null;
  shared: SharedSettings;
  designs?: readonly Design[];
}

/**
 * The panels drawn turned: each panel's `turn` setting, from the Default design, then the item's design, then the item
 * (the last to say anything wins; 0 turns it back).
 */
export function turnsOf({ item, shared, designs }: TurnSources): Turns {
  const design = designOf(designs, item);
  const out: Turns = {};
  for (const id of TURNABLE) {
    const turn = item?.panels?.[id]?.turn ?? design?.panels[id]?.turn ?? shared.panels[id]?.turn;
    if (turn === 90 || turn === -90) out[id] = turn;
  }
  return out;
}

/** A panel's rectangle with its width and height swapped about its centre: the shape its artwork is laid out on while it is turned. */
export function turnedRect(p: PanelRect): PanelRect {
  const [cx, cy] = [p.xMm + p.widthMm / 2, p.yMm + p.heightMm / 2];
  return { ...p, xMm: cx - p.heightMm / 2, yMm: cy - p.widthMm / 2, widthMm: p.heightMm, heightMm: p.widthMm, turnedFrom: { widthMm: p.widthMm, heightMm: p.heightMm } };
}

/**
 * The template as the turned panels' artwork sees it: those panels with width and height swapped, and everything else
 * as it was. Layers are laid out against this, then drawn turned into the real panels.
 */
export function turnedTemplate(t: TemplateConfig, turns: Turns): TemplateConfig {
  const key = JSON.stringify(turns);
  if (key === '{}') return t;
  // The same object for the same turns, so what is cached by template (the default layers) is found again.
  const seen = memo.get(t) ?? memo.set(t, new Map()).get(t)!;
  let out = seen.get(key);
  if (!out) seen.set(key, (out = { ...t, panels: t.panels.map((p) => (turns[p.id] && !p.follows ? turnedRect(p) : p)) }));
  return out;
}

const memo = new WeakMap<TemplateConfig, Map<string, TemplateConfig>>();
