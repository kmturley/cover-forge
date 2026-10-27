import { BRAND_GROUPS, LOGOS, getMark, type Brand, type Logo } from '../../../brands';

function BrandIcon({ brand }: { brand: Brand }) {
  const [x0, y0, x1, y1] = brand.bbox;
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} aria-hidden="true" fill="currentColor">
      <path d={brand.path} />
    </svg>
  );
}

/** Flat preview of a supplied logo: each layer in its own colour (a gradient shows as its average), the rest in the text colour. */
function LogoIcon({ logo }: { logo: Logo }) {
  const [x0, y0, x1, y1] = logo.bbox;
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} aria-hidden="true" fill="currentColor" fillRule={logo.evenodd ? 'evenodd' : 'nonzero'}>
      {logo.layers.map((l, i) => (
        <path key={i} d={l.d} transform={`translate(${l.offset[0]} ${l.offset[1]})`} fill={l.fill ?? 'currentColor'} {...(l.stroke !== undefined && { stroke: l.stroke ?? 'currentColor', strokeWidth: l.strokeWidth ?? 1 })} />
      ))}
    </svg>
  );
}

/** The built-in marks: store and platform icons, and the supplied multi-colour logos. */
export function BrandPicker({ value, onPick }: { value: string | null; onPick: (id: string) => void }) {
  return (
    <div className="brand-groups">
      {BRAND_GROUPS.map((g) => (
        <div key={g.category}>
          <p className="group-label">{g.label}</p>
          <div className="brands">
            {g.brands.map((b) => (
              <button key={b.id} className={`brand-option ${b.id === value ? 'selected' : ''}`} title={b.label} aria-label={b.label} aria-pressed={b.id === value} onClick={() => onPick(b.id)}>
                <BrandIcon brand={b} />
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <p className="group-label">Template logos</p>
        <div className="brands">
          {LOGOS.map((l) => (
            <button key={l.id} className={`brand-option logo-option ${l.id === value ? 'selected' : ''}`} title={l.label} aria-label={l.label} aria-pressed={l.id === value} onClick={() => onPick(l.id)}>
              <LogoIcon logo={l} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The guidelines link and trademark note that go with the marks. */
export function BrandNotice({ id }: { id: string | null }) {
  const mark = getMark(id);
  return (
    <p className="muted small">
      Brand marks are trademarks of their owners (icons via Simple Icons, CC0). Use them in line with each owner's guidelines
      {mark?.kind === 'brand' && mark.brand.guidelines && (
        <>
          {' '}
          — <a href={mark.brand.guidelines} target="_blank" rel="noreferrer">{mark.brand.label} guidelines</a>
        </>
      )}
      .
    </p>
  );
}
