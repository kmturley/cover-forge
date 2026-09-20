import { useEffect, useState } from 'react';
import { useAppDispatch, useAppState, useSelectedItem, type EditMode } from '../../context/AppContext';
import { DEFAULT_TRANSFORM, MAX_SCALE, MIN_SCALE, type ImageRef, type PanelSettings, type PanelTransform } from '../../types/editor';
import type { PanelId } from '../../types/template';
import { libraryImages, type LibraryImage } from '../../engine/imageLibrary';
import { getCachedImage, loadImage } from '../../engine/imageCache';
import { computePlacement } from '../../engine/placement';
import { BASE_BACKGROUND, panelHasOverride, resolvePanel } from '../../engine/resolve';
import { NumberSlider } from './NumberSlider';
import { SpineTextControls } from './SpineEditor';
import { LogoControls } from './LogoControls';

const TABS: { id: PanelId; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'spine', label: 'Spine' },
  { id: 'back', label: 'Back' },
];

/** Natural pixel size of an image once loaded (needed to show its centred position in mm). */
function useImageSize(url: string | null) {
  const [size, setSize] = useState<{ url: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    void loadImage(url).then((img) => live && img && setSize({ url, w: img.naturalWidth, h: img.naturalHeight }));
    return () => {
      live = false;
    };
  }, [url]);
  const cached = getCachedImage(url);
  if (size && size.url === url) return size;
  return cached ? { url: url!, w: cached.naturalWidth, h: cached.naturalHeight } : null;
}

function Thumb({ image, selected, onPick }: { image: LibraryImage; selected: boolean; onPick: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null; // e.g. games without a hero or logo asset
  return (
    <button className={`thumb ${selected ? 'selected' : ''}`} title={image.label} aria-label={image.label} aria-pressed={selected} onClick={onPick}>
      <img src={image.url} alt="" loading="lazy" crossOrigin="anonymous" onError={() => setFailed(true)} />
    </button>
  );
}

export function PanelControls() {
  const { selectedPanel: panel, editMode, items } = useAppState();
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const modes: { id: EditMode; label: string }[] = [
    { id: 'shared', label: 'Shared' },
    { id: 'override', label: 'Override' },
  ];

  return (
    <section>
      <div className="seg wide" role="group" aria-label="Edit scope">
        {modes.map((m) => (
          <button
            key={m.id}
            className={m.id === editMode ? 'active' : ''}
            aria-pressed={m.id === editMode}
            disabled={m.id === 'override' && !item}
            onClick={() => dispatch({ type: 'setEditMode', mode: m.id })}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="scope-note">
        {editMode === 'shared'
          ? `Changes apply to all ${items.length} item${items.length === 1 ? '' : 's'}.`
          : item
            ? `Changes apply to “${item.title}” only.`
            : 'Select an item to override.'}
      </p>

      <div className="seg wide" role="tablist" aria-label="Panel to edit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === panel}
            className={tab.id === panel ? 'active' : ''}
            onClick={() => dispatch({ type: 'selectPanel', panel: tab.id })}
          >
            {tab.label}
            {panelHasOverride(item, tab.id) && <span className="dot" title="This item overrides the shared settings here" />}
          </button>
        ))}
      </div>

      {item ? <PanelBody panel={panel} /> : <p className="muted">Add a game to edit its panels.</p>}
    </section>
  );
}

function PanelBody({ panel }: { panel: PanelId }) {
  const { shared, editMode, template } = useAppState();
  const item = useSelectedItem()!;
  const dispatch = useAppDispatch();

  const isOverride = editMode === 'override';
  const target = isOverride ? item.id : null; // null = shared layer
  const r = resolvePanel(shared, item, panel);
  const t = r.transform;
  const size = useImageSize(r.imageUrl);
  const rect = template.panels.find((p) => p.id === panel)!;
  const pl = size ? computePlacement(template, rect, size.w, size.h, t) : null;
  const area = pl?.area ?? rect;

  const patch = (p: Partial<PanelSettings>) => dispatch({ type: 'updatePanel', id: target, panel, patch: p });
  const setTransform = (change: Partial<PanelTransform>) => patch({ transform: change });

  // Where a field currently comes from, so it can be cleared back to the layer below.
  const ownBackground = (isOverride ? item.panels?.[panel] : shared.panels[panel])?.backgroundColor;

  return (
    <>
      <h2>Background</h2>
      <div className="field row">
        <input
          type="color"
          aria-label="Panel background colour"
          value={r.backgroundColor ?? BASE_BACKGROUND}
          onChange={(e) => patch({ backgroundColor: e.target.value })}
        />
        <span className="muted">{r.backgroundColor ?? 'None'}</span>
        {ownBackground && <button onClick={() => patch({ backgroundColor: undefined })}>{isOverride ? 'Use shared' : 'Clear'}</button>}
      </div>

      <h2>Image</h2>
      <div className="thumbs">
        <button className={`thumb none ${r.imageRef === null ? 'selected' : ''}`} aria-pressed={r.imageRef === null} onClick={() => patch({ image: null })}>
          None
        </button>
        {libraryImages(item).map((img) => (
          <Thumb key={img.ref} image={img} selected={img.ref === r.imageRef} onPick={() => patch({ image: img.ref as ImageRef })} />
        ))}
      </div>

      {r.imageRef !== null && !pl ? (
        <p className="muted">Loading image…</p>
      ) : r.imageRef !== null && pl ? (
        <>
          <p className="muted">Position is the image's top-left corner from the panel's top-left (bleed included). 0, 0 aligns to the corner. Default: centred.</p>
          <NumberSlider label="Position X" unit="mm" min={Math.floor(-pl.widthMm)} max={Math.ceil(area.widthMm)} step={0.1} decimals={1} value={pl.xMm} onChange={(xMm) => setTransform({ xMm })} />
          <NumberSlider label="Position Y" unit="mm" min={Math.floor(-pl.heightMm)} max={Math.ceil(area.heightMm)} step={0.1} decimals={1} value={pl.yMm} onChange={(yMm) => setTransform({ yMm })} />
          <NumberSlider label="Size (zoom)" unit="×" min={MIN_SCALE} max={MAX_SCALE} step={0.01} value={t.scale} onChange={(scale) => setTransform({ scale })} />
          <NumberSlider label="Rotation" unit="°" min={-180} max={180} step={0.1} decimals={1} value={t.rotationDeg} onChange={(rotationDeg) => setTransform({ rotationDeg })} />
          <NumberSlider label="Opacity" unit="%" min={0} max={100} step={1} decimals={0} value={Math.round(t.opacity * 100)} onChange={(v) => setTransform({ opacity: v / 100 })} />
          <button
            // Shared: drop the shared placement. Override: pin this item to centred cover-all regardless of shared.
            onClick={() => patch({ transform: isOverride ? DEFAULT_TRANSFORM : undefined })}
          >
            Reset image (centred, cover all)
          </button>
        </>
      ) : (
        <p className="muted">Choose an image above to position it.</p>
      )}

      <LogoControls panel={panel} target={target} logo={r.logo} />

      {panel === 'spine' && <SpineTextControls target={target} />}

      {isOverride && (
        <div className="override-actions">
          <button disabled={!panelHasOverride(item, panel)} onClick={() => dispatch({ type: 'clearOverrides', id: item.id, panel })}>
            Remove overrides — use shared
          </button>
        </div>
      )}
    </>
  );
}
