import type { Fill, Gradient, Stops } from '../../../types/layers';
import { isGradient } from '../../../engine/layers/paint';
import { NumberField } from './NumberField';

interface Props {
  fill: Fill | null;
  onChange: (fill: Fill | null) => void;
}

const FALLBACK = '#808080';

/** The first colour of a fill, for when one kind of fill is swapped for another. */
const firstColor = (f: Fill | null): string => (f === null ? FALLBACK : isGradient(f) ? (f.stops[0]?.[1] ?? FALLBACK) : f);

/** A solid colour, a two-or-more-stop gradient across the shape (left to right or top to bottom), or none. */
export function FillControls({ fill, onChange }: Props) {
  const kind = fill === null ? 'none' : isGradient(fill) ? 'gradient' : 'solid';
  const stops = (g: Gradient, next: Stops) => onChange({ ...g, stops: next.slice().sort((a, b) => a[0] - b[0]) });

  return (
    <>
      <div className="seg" role="group" aria-label="Fill">
        <button className={kind === 'solid' ? 'active' : ''} aria-pressed={kind === 'solid'} onClick={() => onChange(firstColor(fill))}>
          Solid
        </button>
        <button
          className={kind === 'gradient' ? 'active' : ''}
          aria-pressed={kind === 'gradient'}
          onClick={() => kind !== 'gradient' && onChange({ axis: 'x', stops: [[0, firstColor(fill)], [1, '#000000']] })}
        >
          Gradient
        </button>
        <button className={kind === 'none' ? 'active' : ''} aria-pressed={kind === 'none'} onClick={() => onChange(null)}>
          None
        </button>
      </div>
      {typeof fill === 'string' && (
        <div className="field row">
          <input type="color" aria-label="Fill colour" value={/^#[0-9a-f]{6}$/i.test(fill) ? fill : FALLBACK} onChange={(e) => onChange(e.target.value)} />
          <span className="muted">{fill}</span>
        </div>
      )}
      {isGradient(fill) && (
        <div className="gradient-editor">
          <div className="seg" role="group" aria-label="Gradient direction">
            {(
              [
                ['x', 'Left to right'],
                ['y', 'Top to bottom'],
              ] as const
            ).map(([axis, label]) => (
              <button key={axis} className={fill.axis === axis ? 'active' : ''} aria-pressed={fill.axis === axis} onClick={() => onChange({ ...fill, axis })}>
                {label}
              </button>
            ))}
          </div>
          <div className="gradient-bar" style={{ background: `linear-gradient(${fill.axis === 'x' ? 'to right' : 'to bottom'}, ${fill.stops.map(([at, c]) => `${c} ${at * 100}%`).join(', ')})` }} aria-hidden="true" />
          {fill.stops.map(([at, color], i) => (
            <div className="stop-row" key={i}>
              <input type="color" aria-label={`Stop ${i + 1} colour`} value={/^#[0-9a-f]{6}$/i.test(color) ? color : FALLBACK} onChange={(e) => stops(fill, fill.stops.map((s, j) => (j === i ? [s[0], e.target.value] : s)))} />
              <NumberField label={`Stop ${i + 1} position`} unit="%" min={0} max={100} step={1} decimals={0} value={Math.round(at * 100)} onChange={(v) => stops(fill, fill.stops.map((s, j) => (j === i ? [v / 100, s[1]] : s)))} />
              <button className="link" disabled={fill.stops.length <= 2} onClick={() => stops(fill, fill.stops.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button className="link" onClick={() => stops(fill, [...fill.stops, [0.5, firstColor(fill)]])}>
            Add a stop
          </button>
        </div>
      )}
    </>
  );
}
