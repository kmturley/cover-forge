import { useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { useEditView } from './useEditView';
import { defaultCapHeightMm, defaultSpineText } from '../../engine/SpineTypography';
import type { SpineSettings } from '../../types/editor';
import { NumberSlider } from './NumberSlider';

export const FONTS = [
  ['Helvetica, Arial, sans-serif', 'Sans'],
  ['Georgia, serif', 'Serif'],
  ['"Courier New", monospace', 'Mono'],
  ['Impact, "Arial Black", sans-serif', 'Impact'],
];

/** Spine text controls. Font, colour and height follow the edit mode; the text itself is always per item. */
export function SpineTextControls({ target }: { target: string | null }) {
  const { editMode, template, selectedPanel } = useAppState();
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const { spine: eff } = useEditView(template.panels.some((p) => p.id === selectedPanel) ? selectedPanel : template.panels[0].id);
  if (!item) return null;
  const spine = template.panels.find((q) => q.text);
  const auto = spine ? defaultCapHeightMm(spine, spine.text) : 4;
  const patch = (p: Partial<SpineSettings>) =>
    dispatch({ type: 'updateSpine', id: target, patch: p });

  return (
    <>
      {editMode === 'override' ? (
        <label className="field">
          <span>Text (this item)</span>
          <input type="text" value={eff.text ?? defaultSpineText(item)} onChange={(e) => patch({ text: e.target.value })} />
        </label>
      ) : (
        <p className="muted">Each spine shows its own title. Switch to “This item” to change one.</p>
      )}
      <NumberSlider
        label="Text height (shrinks to fit)"
        unit="mm"
        min={2}
        max={12}
        step={0.5}
        decimals={1}
        value={eff.textHeightMm ?? auto}
        onChange={(textHeightMm) => patch({ textHeightMm })}
      />
      {eff.textHeightMm !== undefined && (
        <button onClick={() => patch({ textHeightMm: undefined })}>Automatic size ({auto} mm for this template)</button>
      )}
      <NumberSlider
        label="Text rotation"
        unit="°"
        min={-180}
        max={180}
        step={1}
        decimals={0}
        value={eff.rotationDeg ?? 0}
        onChange={(rotationDeg) => patch({ rotationDeg: rotationDeg || undefined })}
      />
      {eff.rotationDeg && (
        <p className="muted small">180° reverses the reading direction (e.g. bottom-to-top on a vertical spine).</p>
      )}
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
