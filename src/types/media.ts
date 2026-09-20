import type { PanelId } from './template';
import type { PanelSettings, SpineSettings } from './editor';

export type MediaType = 'game' | 'movie' | 'music' | 'custom';

export interface AssetSlots {
  cover: string | null;
  hero: string | null;
  logo: string | null;
  screenshots: string[];
}

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  subtitle?: string;
  year?: string;
  /** The id at the source (e.g. the Steam app id), usable in QR patterns as {appId}. */
  sourceId?: string;
  assets: AssetSlots;
  /** Item-level overrides; anything unset inherits the global settings. */
  panels?: Partial<Record<PanelId, PanelSettings>>;
  spineOverride?: Partial<SpineSettings>;
}
