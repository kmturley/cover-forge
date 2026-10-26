import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { preloadItem, renderCover } from '../../engine/CanvasRenderer';
import { PRESETS, designFromPreset, type Preset } from '../../engine/layers/presets';
import { newDesignId } from '../../context/designFile';

const PREVIEW_PX = 220;

/** What a preset would make of the selected item on its case, drawn small. */
function Preview({ preset }: { preset: Preset }) {
  const { template, shared, assets, banner } = useAppState();
  const item = useSelectedItem();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !item) return;
    let live = true;
    const design = designFromPreset(preset, 'preview');
    const scene = { template, item: { ...item, designId: 'preview', panels: undefined, spineOverride: undefined, diff: undefined }, shared, designs: [design], assets, banner, showGuides: false, hideOutsideCut: true };
    const px = PREVIEW_PX / template.totalWidthMm;
    canvas.width = Math.round(template.totalWidthMm * px);
    canvas.height = Math.round(template.totalHeightMm * px);
    void preloadItem(scene).then(() => {
      if (live) renderCover(canvas.getContext('2d')!, scene, px);
    });
    return () => {
      live = false;
    };
  }, [preset, template, item, shared, assets, banner]);
  return <canvas ref={ref} className="preset-preview" aria-hidden="true" />;
}

/** The built-in designs, each shown as it would look on the selected item. Using one makes a design of your own from it. */
export function PresetModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const item = useSelectedItem();
  const { designs } = useAppState();
  const use = (p: Preset) => {
    if (!item) return;
    // A name not already taken, so two uses of one preset can be told apart.
    const taken = new Set(designs.map((d) => d.name));
    let name = p.name;
    for (let n = 2; taken.has(name); n++) name = `${p.name} ${n}`;
    dispatch({ type: 'addDesign', design: designFromPreset(p, newDesignId(), name), items: [item.id] });
    onClose();
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Start from a preset" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Start from a preset</h2>
        <p className="muted small">Each preset makes a design of your own, shown here on “{item?.title}”. Change any of its layers afterwards.</p>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button key={p.id} className="preset-card" onClick={() => use(p)}>
              <Preview preset={p} />
              <span className="preset-name">{p.name}</span>
              <small>{p.description}</small>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
