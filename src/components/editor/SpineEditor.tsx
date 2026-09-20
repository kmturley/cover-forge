import { useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { resolveSpine } from '../../engine/resolve';
import type { SpineSettings } from '../../types/editor';
import { NumberSlider } from './NumberSlider';

const FONTS = [
  ['Helvetica, Arial, sans-serif', 'Sans'],
  ['Georgia, serif', 'Serif'],
  ['"Courier New", monospace', 'Mono'],
  ['Impact, "Arial Black", sans-serif', 'Impact'],
];

/** Spine text controls. Font, colour and height follow the edit mode; the text itself is always per item. */
export function SpineTextControls({ target }: { target: string | null }) {
  const { shared, editMode } = useAppState();
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  if (!item) return null;
  const eff = resolveSpine(shared, item);
  const patch = (p: Partial<SpineSettings>) =>
    dispatch({ type: 'updateSpine', id: target, patch: p });

  return (
    <>
      <h2>Spine text</h2>
      {editMode === 'override' ? (
        <label className="field">
          <span>Text (this item)</span>
          <input type="text" value={eff.text ?? item.title} onChange={(e) => patch({ text: e.target.value })} />
        </label>
      ) : (
        <p className="muted">Each spine shows its own title. Switch to Override to change one.</p>
      )}
      <NumberSlider
        label="Text height (shrinks to fit)"
        unit="mm"
        min={2}
        max={12}
        step={0.5}
        decimals={1}
        value={eff.textHeightMm}
        onChange={(textHeightMm) => patch({ textHeightMm })}
      />
      <label className="field">
        <span>Font</span>
        <select value={eff.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })}>
          {FONTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Text colour</span>
        <input type="color" value={eff.color} onChange={(e) => patch({ color: e.target.value })} />
      </label>
    </>
  );
}
