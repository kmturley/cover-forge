import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../../templates/library';
import { buildTemplateById } from '../../templates';
import { defaultLayers } from './defaults';

/**
 * The default layers are a public format: every saved design and item is a diff of them, by layer id. This freezes
 * their ids, kinds and targets per case. If it fails, either the change was an accident or it needs a new
 * DEFAULTS_VERSION (and a migration), and then this snapshot is updated on purpose.
 */
describe('the default layers of every case', () => {
  it('are frozen', () => {
    const out: Record<string, string[]> = {};
    for (const e of LIBRARY) {
      out[e.id] = defaultLayers(buildTemplateById(e.id)).map((l) => `${l.id} · ${l.type}${l.type === 'generated' ? `:${l.generator}` : ''} · ${l.target}${l.parent ? ` · in ${l.parent}` : ''}`);
    }
    expect(out).toMatchSnapshot();
  });

  it('have no id used twice', () => {
    for (const e of LIBRARY) {
      const ids = defaultLayers(buildTemplateById(e.id)).map((l) => l.id);
      expect(new Set(ids).size, e.id).toBe(ids.length);
    }
  });
});
