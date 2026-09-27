import type { MediaItem } from '../types/media';
import type { TemplateConfig } from '../types/template';
import { buildTemplateById } from '../templates';
import { isTemplateId } from '../templates/library';
import type { AppState } from './AppContext';

/** The template id an item is printed with: its own, or the fallback when it has none (or an unknown one). */
export function templateIdOf(state: Pick<AppState, 'templateId'>, item: MediaItem | null | undefined): string {
  return item && isTemplateId(item.templateId) ? item.templateId : state.templateId;
}

export const templateOf = (state: Pick<AppState, 'templateId'>, item: MediaItem | null | undefined): TemplateConfig => buildTemplateById(templateIdOf(state, item));

/** Keeps `template` on the selected item's template, and the selected panel on one that template has. */
export function syncTemplate(state: AppState): AppState {
  const item = state.items.find((i) => i.id === state.selectedItemId);
  const id = templateIdOf(state, item);
  if (state.template.id === id) return state;
  const template = buildTemplateById(id);
  const selectedPanel = template.panels.some((p) => p.id === state.selectedPanel) ? state.selectedPanel : template.panels[0].id;
  return { ...state, template, selectedPanel };
}
