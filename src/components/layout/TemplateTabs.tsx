import type { ReactNode } from 'react';
import { useAppDispatch, useAppState } from '../../context/AppContext';
import { TEMPLATE_DEFS } from '../../templates';
import type { TemplateKind } from '../../types/template';

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/** A small line icon per template: the silhouette of the medium. */
const ICONS: Record<TemplateKind, ReactNode> = {
  bluray: svg(
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
      <path d="M8 2.5v19" />
      <circle cx="13.5" cy="12" r="3.2" />
      <circle cx="13.5" cy="12" r="0.6" />
    </>,
  ),
  dvd: svg(
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
      <path d="M8 2.5v19" />
      <path d="M12 9v6l4.5-3z" />
    </>,
  ),
  vhs: svg(
    <>
      <rect x="6" y="2" width="12" height="20" rx="1" />
      <path d="M6 5h12" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="14" cy="10" r="1.6" />
      <path d="M9 16h6" />
    </>,
  ),
  cd: svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.3" />
    </>,
  ),
  cassette: svg(
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <circle cx="8.5" cy="11" r="2" />
      <circle cx="15.5" cy="11" r="2" />
      <path d="M7 18l1.5-3h7l1.5 3" />
    </>,
  ),
  floppy: svg(
    <>
      <path d="M4 3.5h13.5L20 6v14.5H4z" />
      <path d="M8 3.5v5h7v-5" />
      <rect x="7" y="13" width="10" height="7.5" />
    </>,
  ),
  'nfc-card': svg(
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.2 9.5a3 3 0 0 1 0 4M12.6 8a5.2 5.2 0 0 1 0 7" />
    </>,
  ),
  'nfc-sticker': svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9.6a3.4 3.4 0 0 1 0 4.8M12.6 8a5.6 5.6 0 0 1 0 8" />
    </>,
  ),
  'nfc-box': svg(
    <>
      <path d="M12 2.5l8 3.5v11l-8 3.5-8-3.5V6z" />
      <path d="M4 6l8 3.5L20 6M12 9.5v11" />
    </>,
  ),
  vinyl: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </>,
  ),
  'game-case': svg(
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
      <path d="M8 2.5v19" />
      <path d="M11 8.5h5M11 11h5M11 13.5h3" />
    </>,
  ),
};

const GROUPS = ['Cases', 'Boxes', 'Labels & cards', 'Game cases'] as const;

/** One button per template, grouped by type, so switching media is a single click. */
export function TemplateTabs() {
  const { templateKind } = useAppState();
  const dispatch = useAppDispatch();
  return (
    <nav className="template-tabs" role="tablist" aria-label="Template">
      {GROUPS.map((group) => (
        <div className="template-group" key={group} role="presentation">
          <span className="template-group-label">{group}</span>
          <div className="template-group-tabs" role="presentation">
            {TEMPLATE_DEFS.filter((d) => d.group === group).map((d) => (
              <button
                key={d.kind}
                role="tab"
                aria-selected={d.kind === templateKind}
                className={d.kind === templateKind ? 'active' : ''}
                title={d.name}
                onClick={() => dispatch({ type: 'setTemplate', kind: d.kind })}
              >
                {ICONS[d.kind]}
                <span>{d.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
