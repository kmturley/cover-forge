import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../context/AppContext';
import { preloadItem, renderCover } from '../../engine/CanvasRenderer';
import type { SizedEntry } from '../../templates/compare';
import type { MediaItem } from '../../types/media';
import type { TemplateConfig } from '../../types/template';

/** Longest side of a thumbnail in pixels: twice the (at most) 92 px it is shown at, so it stays sharp on high-density screens. */
const THUMB_PX = 184;
/** How many thumbnails are drawn before giving the browser a turn, so opening the picker and scrolling stay smooth. */
const BATCH = 4;

/** The panel a thumbnail shows: the front, or for a one-sided piece (a label, a card) its one panel. */
function frontOf(t: TemplateConfig) {
  const spec = t.preview;
  const id = t.panels.some((p) => p.id === 'front') ? 'front' : spec.kind === 'slab' ? spec.panel : t.panels[0].id;
  return t.panels.find((p) => p.id === id) ?? t.panels[0];
}

/**
 * The item as each template would show it: its design with each template's own branding, so a preview shows what picking
 * that template gives (picking one resets the branding to the template's).
 */
export function withOwnBranding(item: MediaItem | null): MediaItem | null {
  if (!item?.panels?.front?.dress) return item;
  return { ...item, panels: { ...item.panels, front: { ...item.panels.front, dress: undefined } } };
}

/**
 * A small picture of the item's front on every template, keyed by template id. They are drawn after the item's images
 * have loaded, a few at a time between frames, and appear as they are ready; until then the tile keeps its icon.
 */
export function useThumbnails(list: SizedEntry[], item: MediaItem | null): Map<string, HTMLCanvasElement> {
  const { shared, designs, assets } = useAppState();
  const [thumbs, setThumbs] = useState<Map<string, HTMLCanvasElement>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const shown = withOwnBranding(item);
    const sheet = document.createElement('canvas');
    const done = new Map<string, HTMLCanvasElement>();

    const draw = (c: SizedEntry) => {
      const t = c.template;
      const front = frontOf(t);
      const px = THUMB_PX / Math.max(front.widthMm, front.heightMm);
      sheet.width = Math.max(1, Math.round(t.totalWidthMm * px));
      sheet.height = Math.max(1, Math.round(t.totalHeightMm * px));
      // Kept in software (willReadFrequently): reading a GPU-backed canvas back stalls the GPU, and these are tiny anyway.
      const ctx = sheet.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      renderCover(ctx, { template: t, item: shown, shared, designs, assets, showGuides: false }, px);
      // The thumbnail is a canvas of its own that the tile shows as it is: no encoding to an image (which is slow) and back.
      const thumb = document.createElement('canvas');
      thumb.width = Math.max(1, Math.round(front.widthMm * px));
      thumb.height = Math.max(1, Math.round(front.heightMm * px));
      thumb.getContext('2d')?.drawImage(sheet, front.xMm * px, front.yMm * px, thumb.width, thumb.height, 0, 0, thumb.width, thumb.height);
      done.set(c.entry.id, thumb);
    };

    const run = (from: number) => {
      if (cancelled) return;
      list.slice(from, from + BATCH).forEach(draw);
      setThumbs(new Map(done));
      if (from + BATCH < list.length) timer = window.setTimeout(() => run(from + BATCH), 0);
    };

    // Each template can bring its own images (its brand's logos), so all are loaded first; the item's own are cached already.
    void Promise.all(list.map((c) => preloadItem({ template: c.template, item: shown, shared, designs, assets }).catch(() => undefined))).then(() => run(0));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [list, item, shared, designs, assets]);

  return thumbs;
}

/** Shows a thumbnail canvas from useThumbnails in place (a canvas can only be in one place, and each template has one tile). */
export function Thumbnail({ canvas }: { canvas: HTMLCanvasElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.replaceChildren(canvas);
  }, [canvas]);
  return <span ref={ref} className="library-thumb-canvas" aria-hidden="true" />;
}
