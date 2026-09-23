import { useEffect, useRef, useState } from 'react';
import { targetDesignId, useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { DEFAULT_TRANSFORM, MAX_SCALE, MIN_SCALE, type ImageRef, type PanelSettings, type PanelTransform } from '../../types/editor';
import type { PanelId } from '../../types/template';
import { libraryImages, type LibraryImage } from '../../engine/imageLibrary';
import { getCachedImage, loadImage } from '../../engine/imageCache';
import { computePlacement } from '../../engine/placement';
import { BASE_BACKGROUND, panelHasOverride } from '../../engine/resolve';
import { designHasPanel } from '../../engine/designs';
import { DesignBar } from './DesignBar';
import { useEditView } from './useEditView';
import { readImageFile } from '../../api/upload';
import { srcOf } from '../../storage/localImages';
import { NumberSlider } from './NumberSlider';
import { SpineTextControls } from './SpineEditor';
import { NoneLink } from './NoneLink';
import { LogoControls } from './LogoControls';
import { Section } from './Section';
import { BackgroundSummary, BorderSummary, CodeSummary, ImageSummary, LogoSummary, SpineSummary } from './Summaries';
import { getBrand } from '../../brands';
import { defaultCapHeightMm } from '../../engine/SpineTypography';
import { CodeControls } from './CodeControls';

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
      <img src={srcOf(image.url)} alt="" loading="lazy" crossOrigin="anonymous" onError={() => setFailed(true)} />
    </button>
  );
}

export function PanelControls() {
  const state = useAppState();
  const { selectedPanel, editMode, template } = state;
  const panel = template.panels.some((p) => p.id === selectedPanel) ? selectedPanel : template.panels[0].id;
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const grouped = editMode === 'shared' || !item;

  return (
    <section className="controls">
      <div className="controls-head">
        <DesignBar panel={panel} />
        <div className="seg wide" role="tablist" aria-label="Panel to edit">
          {template.panels.filter((tab) => !tab.follows).map((tab) => {
            const marked = grouped ? designHasPanel(state.shared, state.designs, targetDesignId(state), tab.id) : panelHasOverride(item, tab.id);
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={tab.id === panel}
                className={tab.id === panel ? 'active' : ''}
                onClick={() => dispatch({ type: 'selectPanel', panel: tab.id })}
              >
                {tab.label}
                {marked && <span className="dot" title={grouped ? 'This design has its own settings here' : 'This item overrides its design here'} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="controls-body">{item ? <PanelBody key={`${item.id}:${panel}`} panel={panel} /> : <p className="muted">Add a game to edit its panels.</p>}</div>
    </section>
  );
}

function PanelBody({ panel }: { panel: PanelId }) {
  const { template } = useAppState();
  const item = useSelectedItem()!;
  const dispatch = useAppDispatch();

  const { isOverride, resolved: r, own, spine } = useEditView(panel);
  // Which part of the design is open for editing; everything else is a read-only summary.
  const [open, setOpen] = useState<'background' | 'border' | 'image' | 'logo' | 'code' | 'spine' | null>(null);
  const target = isOverride ? item.id : null; // null = the group scope
  const t = r.transform;
  const size = useImageSize(r.imageUrl);
  const rect = template.panels.find((p) => p.id === panel)!;
  const pl = size ? computePlacement(template, rect, size.w, size.h, t) : null;
  const area = pl?.area ?? rect;

  const patch = (p: Partial<PanelSettings>) => dispatch({ type: 'updatePanel', id: target, panel, patch: p });
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Adds the picked images to this item's library and shows the first one on the panel.
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    try {
      const urls = await Promise.all(Array.from(files).map((f) => readImageFile(f)));
      const firstIndex = item.assets.screenshots.length;
      urls.forEach((url) => dispatch({ type: 'addAsset', id: item.id, url }));
      patch({ image: `screenshot:${firstIndex}` });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Couldn’t add that image');
    }
  }
  const setTransform = (change: Partial<PanelTransform>) => patch({ transform: change });

  // Where a field currently comes from, so it can be cleared back to the layer below.
  const ownBackground = own?.backgroundColor;

  return (
    <>
      <Section title="Background" summary={<BackgroundSummary r={r} />} editing={open === 'background'} onEdit={() => setOpen('background')} onDone={() => setOpen(null)}>
        <div className="field row">
          <input
            type="color"
            aria-label="Panel background colour"
            value={r.backgroundColor ?? BASE_BACKGROUND}
            onChange={(e) => patch({ backgroundColor: e.target.value })}
          />
          <span className="muted">{r.backgroundColor ?? 'None'}</span>
          {ownBackground && <button onClick={() => patch({ backgroundColor: undefined })}>{isOverride ? 'Use design' : 'Clear'}</button>}
        </div>

      </Section>

      <Section
        title="Border"
        summary={<BorderSummary r={r} />}
        editing={open === 'border'}
        onEdit={() => setOpen('border')}
        onDone={() => setOpen(null)}
        extra={<NoneLink selected={r.border.widthMm <= 0} onClick={() => patch({ border: { widthMm: 0 } })} />}
      >
        <div className="field row">
          <input type="color" aria-label="Border colour" value={r.border.color} onChange={(e) => patch({ border: { color: e.target.value } })} />
          <span className="muted">{r.border.color}</span>
        </div>
        <NumberSlider label="Border width" unit="mm" min={0} max={5} step={0.1} decimals={1} value={r.border.widthMm} onChange={(widthMm) => patch({ border: { widthMm } })} />
        <NumberSlider label="Inset from the edge" unit="mm" min={0} max={15} step={0.5} decimals={1} value={r.border.insetMm} onChange={(insetMm) => patch({ border: { insetMm } })} />
      </Section>

      <Section
        title="Image"
        summary={<ImageSummary r={r} item={item} />}
        editing={open === 'image'}
        onEdit={() => setOpen('image')}
        onDone={() => setOpen(null)}
        extra={<NoneLink selected={r.imageRef === null} onClick={() => patch({ image: null })} />}
      >
        <div className="thumbs">
          {libraryImages(item).map((img) => (
            <Thumb key={img.ref} image={img} selected={img.ref === r.imageRef} onPick={() => patch({ image: img.ref as ImageRef })} />
          ))}
          <button className="thumb none" title="Add your own image to this item" aria-label="Add image" onClick={() => fileInput.current?.click()}>
            + Add
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden aria-label="Upload images" onChange={(e) => (void upload(e.target.files), (e.target.value = ''))} />
        </div>
        {uploadError && <p className="error small">{uploadError}</p>}

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
              // Group: drop the design's placement. Item: pin this item to centred cover-all regardless of its design.
              onClick={() => patch({ transform: isOverride ? DEFAULT_TRANSFORM : undefined })}
            >
              Reset image (centred, cover all)
            </button>
          </>
        ) : (
          <p className="muted">Choose an image above to position it.</p>
        )}

      </Section>

      <Section
        title="Brand logo"
        summary={<LogoSummary r={r} template={template} rect={rect} />}
        editing={open === 'logo'}
        onEdit={() => setOpen('logo')}
        onDone={() => setOpen(null)}
        extra={<NoneLink selected={!getBrand(r.logo.brand)} onClick={() => patch({ logo: { brand: null } })} />}
      >
        <LogoControls panel={panel} target={target} logo={r.logo} />
      </Section>

      <Section title="QR code & barcode" summary={<CodeSummary r={r} template={template} rect={rect} />} editing={open === 'code'} onEdit={() => setOpen('code')} onDone={() => setOpen(null)}>
        <CodeControls panel={panel} target={target} code={r.code} />
      </Section>

      {rect.text && (
        <Section title="Spine text" summary={<SpineSummary spine={spine} autoMm={defaultCapHeightMm(rect, rect.text)} />} editing={open === 'spine'} onEdit={() => setOpen('spine')} onDone={() => setOpen(null)}>
          <SpineTextControls target={target} />
        </Section>
      )}

      {isOverride && (
        <div className="override-actions">
          <button disabled={!panelHasOverride(item, panel)} onClick={() => dispatch({ type: 'clearOverrides', id: item.id, panel })}>
            Remove overrides — use design
          </button>
        </div>
      )}
    </>
  );
}
