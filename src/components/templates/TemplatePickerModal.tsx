import { useState } from 'react';
import { templateIdOf, useAppDispatch, useAppState } from '../../context/AppContext';
import { LIBRARY_GROUPS, groupFor, originalTemplateFor, searchLibrary, templatesOf } from '../../templates/library';
import { groupEntries, sizedLibrary, sortEntries, type GroupBy, type SortKey } from '../../templates/compare';
import { dressOf } from '../../engine/layers/dress';
import type { MediaType } from '../../types/media';
import { TemplateLibrary } from './TemplateLibrary';
import { TemplateLibrary3D, dims } from './TemplateLibrary3D';
import { useEscapeKey } from '../layout/useEscapeKey';

const PLURAL: Record<MediaType, string> = { game: 'games', movie: 'movies', tv: 'TV shows', music: 'music', custom: 'custom items' };

type Scope = 'item' | 'group' | 'type' | 'all';
type View = '2d' | '3d';

/** How the templates are sorted and grouped, kept separately for each view. */
interface Arrange {
  sort: SortKey;
  groupBy: GroupBy;
}
interface Prefs {
  view: View;
  arrange: Record<View, Arrange>;
}
/** The list reads best by name; in 3D the point is comparing sizes, so it lines the cases up by height. */
const DEFAULT_PREFS: Prefs = { view: '2d', arrange: { '2d': { sort: 'name', groupBy: 'media' }, '3d': { sort: 'height', groupBy: 'media' } } };
const PREFS_KEY = 'coverforge.templatePicker.v2';

/** How the picker was last left (view, and each view's sort and grouping), kept per browser as a convenience; the defaults when unavailable. */
function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    const arrange = (v: View): Arrange => {
      const a = saved.arrange?.[v];
      return {
        sort: SORTS.some((s) => s.id === a?.sort) ? a!.sort : DEFAULT_PREFS.arrange[v].sort,
        groupBy: GROUPS.some((g) => g.id === a?.groupBy) ? a!.groupBy : DEFAULT_PREFS.arrange[v].groupBy,
      };
    };
    return { view: saved.view === '3d' ? '3d' : '2d', arrange: { '2d': arrange('2d'), '3d': arrange('3d') } };
  } catch {
    return DEFAULT_PREFS;
  }
}
function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked (private window, previews): the picker just starts from the defaults next time.
  }
}

/** Names A to Z; sizes smallest first. */
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'height', label: 'Height' },
  { id: 'width', label: 'Width' },
  { id: 'depth', label: 'Depth (spine)' },
];
/** Media is the library's own groups; Format the kind of packaging (keep case, jewel case, box, sleeve, card); Orientation portrait, square or landscape. */
const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'media', label: 'Media' },
  { id: 'format', label: 'Format' },
  { id: 'orientation', label: 'Orientation' },
  { id: 'none', label: 'None' },
];

/**
 * Picks the template (the branding, and the case and Type it starts with) for some items: one (then also offering every item of its type, or the whole queue) or a group of
 * them (a queue group, offering the whole queue too). The templates can be searched, sorted by name or size and grouped, and seen as a
 * list (2D) or side by side at true relative size (3D).
 */
export function TemplatePickerModal({ itemIds, onClose }: { itemIds: string[]; onClose: () => void }) {
  useEscapeKey(onClose);
  const state = useAppState();
  const { items } = state;
  const chosen = items.filter((i) => itemIds.includes(i.id));
  const item = chosen[0];
  const dispatch = useAppDispatch();
  const [scope, setScope] = useState<Scope>(chosen.length > 1 ? 'group' : 'item');
  const [query, setQuery] = useState('');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [focused, setFocused] = useState<string | null>(null);
  const update = (next: (p: Prefs) => Prefs) =>
    setPrefs((p) => {
      const n = next(p);
      savePrefs(n);
      return n;
    });
  const setView = (view: View) => update((p) => ({ ...p, view }));
  const setArrange = (patch: Partial<Arrange>) => update((p) => ({ ...p, arrange: { ...p.arrange, [p.view]: { ...p.arrange[p.view], ...patch } } }));
  const { sort, groupBy } = prefs.arrange[prefs.view];

  // When every item is the same kind of media: its group comes first, marked recommended, with its original case marked.
  const type = item && chosen.every((i) => i.type === item.type) ? item.type : null;
  const recommended = type ? groupFor(type) : null;
  const original = type ? originalTemplateFor(type) : null;

  const all = sizedLibrary();
  const found = new Set(searchLibrary(query).map((e) => e.id));
  const mediaOrder = recommended ? [recommended, ...LIBRARY_GROUPS.filter((g) => g !== recommended)] : LIBRARY_GROUPS;
  const groups = groupEntries(sortEntries(all.filter((c) => found.has(c.entry.id)), sort), groupBy, mediaOrder);

  if (!item) return null;

  const single = chosen.length === 1;
  const sameType = items.filter((i) => i.type === item.type);
  const scopes: { id: Scope; label: string; ids: string[] }[] = [
    single ? { id: 'item', label: 'This item', ids: [item.id] } : { id: 'group', label: `These ${chosen.length} items`, ids: chosen.map((i) => i.id) },
    ...(single && sameType.length > 1 && sameType.length < items.length ? [{ id: 'type' as const, label: `All ${PLURAL[item.type]} (${sameType.length})`, ids: sameType.map((i) => i.id) }] : []),
    ...(items.length > chosen.length ? [{ id: 'all' as const, label: `Whole queue (${items.length})`, ids: items.map((i) => i.id) }] : []),
  ];
  // What is marked is the template (the brand), not the case it is on now: changing the case never moves it.
  const current = [...new Set(chosen.flatMap((i) => templatesOf(templateIdOf(state, i), dressOf(i))))];
  // The scope was picked from an earlier render's options; if the items changed since, fall back to the first.
  const targets = (scopes.find((s) => s.id === scope) ?? scopes[0]).ids;
  const empty = `No templates match “${query}”.`;
  const inFocus = prefs.view === '3d' ? all.find((c) => c.entry.id === focused) : undefined;

  function pick(id: string) {
    dispatch({ type: 'setItemTemplate', items: targets, template: id });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={onClose}>
      <div className={`modal wide ${prefs.view === '3d' ? 'comparing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <h2 id="picker-title" className="modal-title">{single ? `Template for “${item.title}”` : `Template for ${chosen.length} items`}</h2>
          <div className="seg" role="group" aria-label="View">
            {(['2d', '3d'] as const).map((v) => (
              <button key={v} className={prefs.view === v ? 'active' : ''} aria-pressed={prefs.view === v} title={v === '3d' ? 'See the cases side by side at their real size' : 'A list of templates'} onClick={() => setView(v)}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {scopes.length > 1 && (
          <div className="seg picker-scope" role="group" aria-label="Apply to">
            {scopes.map((s) => (
              <button key={s.id} className={s.id === scope ? 'active' : ''} aria-pressed={s.id === scope} onClick={() => setScope(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="library-search picker-tools">
          <input type="search" autoFocus placeholder="Search templates: PS4, Blu-ray, vinyl, Nintendo…" aria-label="Search templates" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="picker-tool">
            Sort by
            <select value={sort} onChange={(e) => setArrange({ sort: e.target.value as SortKey })}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="picker-tool">
            Group by
            <select value={groupBy} onChange={(e) => setArrange({ groupBy: e.target.value as GroupBy })}>
              {GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {prefs.view === '3d' ? (
          <TemplateLibrary3D
            groups={groups}
            all={all}
            item={item}
            current={current}
            focused={focused}
            onFocus={setFocused}
            onPick={pick}
            empty={empty}
          />
        ) : (
          <TemplateLibrary
            groups={groups}
            all={all}
            item={item}
            selected={current}
            onPick={pick}
            recommended={groupBy === 'media' ? recommended : null}
            original={original}
            empty={empty}
          />
        )}
        <div className="modal-actions picker-actions">
          {prefs.view === '3d' && (
            <p className="muted compare-hint">
              {inFocus ? (
                <>
                  <strong className="compare-pick">{inFocus.entry.name}</strong> · {inFocus.entry.caseLabel} · {dims(inFocus)}
                </>
              ) : (
                'True relative size. Click a case to see it, double-click to pick it; drag to turn, scroll to zoom, right-drag to pan.'
              )}
            </p>
          )}
          <button onClick={onClose}>Cancel</button>
          {prefs.view === '3d' && (
            <button className="primary" disabled={!inFocus} onClick={() => inFocus && pick(inFocus.entry.id)}>
              Use this template
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
