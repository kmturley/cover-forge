import type { MediaItem } from '../../types/media';
import type { TemplateConfig } from '../../types/template';

/** The dress setting that draws no Branded dress at all. */
export const NO_DRESS = 'none';

/**
 * The platform whose Branded dress is drawn on the item's case instead of its own (a brand id, or `none`), or undefined for the
 * case's own. It belongs to the item and follows its template (picking one clears it; changing the case sets it to keep the
 * branding), so a dress left on a design or the Default design by an older version is ignored. '' is an explicit "its own".
 */
export function dressOf(item: Pick<MediaItem, 'panels'> | null): string | undefined {
  return item?.panels?.front?.dress ?? undefined;
}

const memo = new WeakMap<TemplateConfig, Map<string, TemplateConfig>>();

/** The template as the dress will be drawn: marked with the platform to dress it as (the same object each time for the same one). */
export function withDress(t: TemplateConfig, dress: string | undefined): TemplateConfig {
  if (!dress) return t;
  const seen = memo.get(t) ?? memo.set(t, new Map()).get(t)!;
  let out = seen.get(dress);
  if (!out) seen.set(dress, (out = { ...t, dress }));
  return out;
}
