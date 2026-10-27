import { useState } from 'react';
import { getMark } from '../../../brands';
import { libraryImages, type LibraryImage } from '../../../engine/imageLibrary';
import { rectToBox } from '../../../engine/box';
import { computePlacement } from '../../../engine/placement';
import { computeLogoPlacement } from '../../../engine/logo';
import { canvasPanel, logoSettingsOf, transformOf } from '../../../engine/layers/draw';
import { layerImageUrl } from '../../../engine/layers/images';
import { srcOf } from '../../../storage/localImages';
import type { ImageLayer, ImageSource } from '../../../types/layers';
import { AssetPicker } from './AssetPicker';
import { BrandNotice, BrandPicker } from './BrandPicker';
import { RotationOpacity } from './CommonFields';
import { FocusPad } from './FocusPad';
import { PlacementControls } from './PlacementControls';
import { useImageSize } from './useImageSize';
import type { LayerEditor } from './useLayerEditor';

const SWATCHES = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
];

function Thumb({ image, selected, onPick }: { image: LibraryImage; selected: boolean; onPick: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null; // e.g. games without a hero or logo asset
  return (
    <button className={`thumb ${selected ? 'selected' : ''}`} title={image.label} aria-label={image.label} aria-pressed={selected} onClick={onPick}>
      <img src={srcOf(image.url)} alt="" loading="lazy" crossOrigin="anonymous" onError={() => setFailed(true)} />
    </button>
  );
}

type Source = 'item' | 'asset' | 'mark';
const sourceOf = (l: ImageLayer): Source => (l.source?.kind === 'asset' ? 'asset' : l.source?.kind === 'vector' || (!l.source && l.id.endsWith('.logo')) ? 'mark' : 'item');

/** An image or mark: from the item's own pictures, from the images kept for every item, or a built-in logo. */
export function ImageInspector({ layer, ed }: { layer: ImageLayer; ed: LayerEditor }) {
  const { item, template, assets } = ed;
  const panel = ed.panelRect ?? canvasPanel(template);
  const [tab, setTab] = useState<Source>(sourceOf(layer));
  const set = (source: ImageSource | null) => ed.update(layer.id, { source });

  const mark = layer.source?.kind === 'vector' ? getMark(layer.source.id) : undefined;
  const url = layerImageUrl(layer, item, assets);
  const size = useImageSize(mark ? null : url);
  const aspect = mark ? mark.aspect : size ? size.w / size.h : undefined;

  let autoBox;
  if (mark) autoBox = rectToBox(panel, computeLogoPlacement(template, panel, mark.aspect, logoSettingsOf(layer, panel, mark)).box);
  else if (size) autoBox = rectToBox(panel, computePlacement(template, panel, size.w, size.h, transformOf(layer, panel, size.w / size.h)).box);

  const raster = !mark && !!url;
  return (
    <>
      <div className="seg" role="group" aria-label="Where the image comes from">
        {(
          [
            ['item', 'This item'],
            ['asset', 'Your images'],
            ['mark', 'Logo'],
          ] as [Source, string][]
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'item' && (
        <>
          {item ? (
            <div className="thumbs">
              <button className={`thumb none ${layer.source?.kind === 'role' && layer.source.ref === 'auto' ? 'selected' : ''}`} title="The picture that suits this panel (cover on the front, hero on the back)" onClick={() => set({ kind: 'role', ref: 'auto' })}>
                Auto
              </button>
              {libraryImages(item).map((img) => (
                <Thumb key={img.ref} image={img} selected={layer.source?.kind === 'role' && layer.source.ref === img.ref} onPick={() => set({ kind: 'role', ref: img.ref })} />
              ))}
              <button className="thumb none" onClick={() => set(null)} aria-pressed={!layer.source}>None</button>
            </div>
          ) : (
            <p className="muted">Add a game to choose from its pictures.</p>
          )}
        </>
      )}

      {tab === 'asset' && <AssetPicker selectedId={layer.source?.kind === 'asset' ? layer.source.id : null} onPick={(a) => set({ kind: 'asset', id: a.id })} />}

      {tab === 'mark' && (
        <>
          <BrandPicker value={layer.source?.kind === 'vector' ? layer.source.id : null} onPick={(id) => set({ kind: 'vector', id })} />
          {layer.source?.kind === 'vector' && (
            <>
              <div className="field row">
                <input type="color" aria-label="Logo colour" value={layer.tint} onChange={(e) => ed.update(layer.id, { tint: e.target.value }, 'tint')} />
                {[...SWATCHES, ...(mark?.kind === 'brand' ? [{ label: 'Brand', value: `#${mark.brand.hex}` }] : [])].map((s) => (
                  <button key={s.label} onClick={() => ed.update(layer.id, { tint: s.value })} title={s.value}>
                    {s.label}
                  </button>
                ))}
                <button className="link" onClick={() => set(null)}>No logo</button>
              </div>
              <BrandNotice id={layer.source.id} />
            </>
          )}
        </>
      )}

      {layer.source && (mark || url) && (
        <>
          {raster && (
            <div className="seg" role="group" aria-label="Image fit">
              {(
                [
                  ['fill', 'Fill', 'Covers the whole box, cropping what overflows'],
                  ['fit', 'Fit', 'Shows the whole image inside the box'],
                ] as const
              ).map(([fit, label, title]) => (
                <button key={fit} className={layer.fit === fit ? 'active' : ''} aria-pressed={layer.fit === fit} title={title} onClick={() => ed.update(layer.id, { fit })}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {raster && layer.fit === 'fill' && url && <FocusPad url={url} focus={layer.focus} onChange={(focus) => ed.update(layer.id, { focus }, 'focus')} />}
          <h3>Position and size</h3>
          <PlacementControls
            placement={layer.placement}
            panel={panel}
            aspect={aspect}
            autoBox={autoBox}
            autoLabel={mark ? 'A size and spot that suit the panel' : 'The whole panel, with its bleed'}
            onChange={(placement) => ed.update(layer.id, { placement })}
          />
          <RotationOpacity layer={layer} ed={ed} />
        </>
      )}
      {layer.source && !mark && !url && layer.source.kind !== 'role' && <p className="warn small">This image can’t be found in this browser. Use Find file… in Your images.</p>}
    </>
  );
}
