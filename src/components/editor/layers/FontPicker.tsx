import { useEffect, useMemo, useRef, useState } from 'react';
import { RECOMMENDED, SYSTEM_FONTS } from '../../../fonts/recommended';
import { cssFamily, familyOf, fetchCatalogue, type FontMeta } from '../../../fonts/fontsource';
import { ensureFont, isSystemFont } from '../../../fonts/loader';

const CATEGORIES = [
  ['', 'All kinds'],
  ['sans-serif', 'Sans'],
  ['serif', 'Serif'],
  ['display', 'Display'],
  ['handwriting', 'Handwriting'],
  ['monospace', 'Mono'],
] as const;
const PAGE = 48;

interface Props {
  /** The CSS font-family now in use. */
  value: string;
  onPick: (css: string) => void;
  /** Families already used in this design, shown first. */
  used?: string[];
}

/** One font in the list, shown in its own typeface once it scrolls into view and its Latin file has loaded. */
function Row({ family, css, selected, note, onPick }: { family: string; css: string; selected: boolean; note?: string; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(isSystemFont(css));
  useEffect(() => {
    const el = ref.current;
    if (ready || !el) return;
    let live = true;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      void ensureFont({ family: css, weight: 400, italic: false, text: family }).then((ok) => live && ok && setReady(true));
    });
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [family, css, ready]);
  return (
    <button ref={ref} className={`font-row ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onPick}>
      <span className="font-sample" style={{ fontFamily: ready ? css : undefined }}>{family}</span>
      {note && <small>{note}</small>}
    </button>
  );
}

/**
 * Chooses a font: a short recommended list for cover art before anything is typed, the system fonts, and a search of every
 * Google font (loaded from Fontsource only when searched; nothing is bundled). Fonts download only when used.
 */
export function FontPicker({ value, onPick, used = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [catalogue, setCatalogue] = useState<FontMeta[] | null | undefined>(undefined); // undefined = not asked, null = couldn't be reached
  const [shown, setShown] = useState(PAGE);
  const searching = query.trim() !== '' || category !== '';
  const current = familyOf(value);

  useEffect(() => {
    if (!open || !searching || catalogue !== undefined) return;
    let live = true;
    void fetchCatalogue().then((list) => live && setCatalogue(list));
    return () => {
      live = false;
    };
  }, [open, searching, catalogue]);

  const results = useMemo(() => {
    if (!catalogue) return [];
    const q = query.trim().toLowerCase();
    return catalogue.filter((f) => (!category || f.category === category) && (!q || f.family.toLowerCase().includes(q)));
  }, [catalogue, query, category]);

  const pick = (css: string) => {
    onPick(css);
    setOpen(false);
  };
  const usedFamilies = [...new Set(used.map(familyOf))].filter((f) => f && !isSystemFont(f));

  return (
    <div className="font-picker">
      <button className="font-current" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontFamily: value }}>{current || 'Choose a font'}</span>
        <small>{open ? 'Close' : 'Change…'}</small>
      </button>
      {open && (
        <div className="font-panel">
          <div className="font-search">
            <input type="search" aria-label="Search fonts" placeholder="Search Google Fonts…" value={query} onChange={(e) => (setQuery(e.target.value), setShown(PAGE))} />
            <select aria-label="Kind of font" value={category} onChange={(e) => (setCategory(e.target.value), setShown(PAGE))}>
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="font-list">
            {!searching ? (
              <>
                {usedFamilies.length > 0 && (
                  <>
                    <p className="group-label">In this design</p>
                    {usedFamilies.map((f) => (
                      <Row key={f} family={f} css={`"${f}", sans-serif`} selected={f === current} onPick={() => pick(`"${f}", sans-serif`)} />
                    ))}
                  </>
                )}
                <p className="group-label">System fonts</p>
                {SYSTEM_FONTS.map(([css, label]) => (
                  <Row key={css} family={label} css={css} selected={css === value} onPick={() => pick(css)} />
                ))}
                {RECOMMENDED.map((g) => (
                  <div key={g.label}>
                    <p className="group-label">{g.label}</p>
                    {g.fonts.map(([id, family]) => (
                      <Row key={id} family={family} css={cssFamily(family, g.category)} selected={family === current} onPick={() => pick(cssFamily(family, g.category))} />
                    ))}
                  </div>
                ))}
                <p className="muted small">Type above to search every Google font. Fonts load from Fontsource when used, so an internet connection is needed; without one, text uses a similar system font.</p>
              </>
            ) : catalogue === undefined ? (
              <p className="muted small">Loading the font list…</p>
            ) : catalogue === null ? (
              <p className="warn small">Couldn’t reach the font list (offline?). The recommended fonts and system fonts are still available: clear the search to see them.</p>
            ) : results.length === 0 ? (
              <p className="muted small">No fonts match.</p>
            ) : (
              <>
                {results.slice(0, shown).map((f) => (
                  <Row key={f.id} family={f.family} css={cssFamily(f.family, f.category)} selected={f.family === current} note={/^OFL/.test(f.license) ? undefined : f.license} onPick={() => pick(cssFamily(f.family, f.category))} />
                ))}
                {results.length > shown && (
                  <button className="link" onClick={() => setShown((n) => n + PAGE)}>
                    Show more ({results.length - shown} left)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

