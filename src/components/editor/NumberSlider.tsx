import { useState } from 'react';

interface Props {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Digits kept in the number box (the slider snaps to `step`). */
  decimals?: number;
  onChange: (v: number) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Range slider paired with a typeable number box. Typed values are clamped to [min, max] on commit. */
export function NumberSlider({ label, unit = '', value, min, max, step = 1, decimals = 2, onChange }: Props) {
  const fmt = (v: number) => String(Number(v.toFixed(decimals)));
  // `draft` holds what the user is typing; null means show the live value (so the slider stays in sync).
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || Number.isNaN(n)) return;
    const v = clamp(n, min, max);
    if (v !== value) onChange(v);
  }

  return (
    <div className="field number-slider">
      <span>{label}</span>
      <div className="number-slider-row">
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${label} value`}
          value={draft ?? fmt(value)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}
