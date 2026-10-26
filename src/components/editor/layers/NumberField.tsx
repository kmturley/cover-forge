import { useId, useState } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  disabled?: boolean;
}

/**
 * A typed number with a unit: the exact way to set a value. Enter or leaving the box commits it, the arrow keys step
 * it, and a value outside min and max is brought back inside. (Sliders are good for finding a value, this for setting it.)
 */
export function NumberField({ label, value, onChange, unit = '', step = 1, min = -Infinity, max = Infinity, decimals = 2, disabled }: Props) {
  const id = useId();
  const fmt = (v: number) => String(Number(v.toFixed(decimals)));
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  function commit(text: string | null = draft) {
    setDraft(null);
    if (text === null || text.trim() === '') return;
    const n = Number(text);
    if (!Number.isNaN(n) && clamp(n) !== value) onChange(clamp(n));
  }

  return (
    <div className="num-field">
      <label htmlFor={id}>{label}</label>
      <span className="num-field-box">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={draft ?? fmt(value)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const next = clamp(Number(((Number(draft ?? value) || 0) + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1)).toFixed(decimals)));
              setDraft(null);
              if (next !== value) onChange(next);
            }
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}
