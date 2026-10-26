import { useRef, useState } from 'react';
import { duplicateLayer, freshId, newCode, newImage, newShape, newSvg, newText } from '../../../engine/layers/factory';
import { SVG_PRESETS } from '../../../engine/svgTemplate';
import { isDefaultId, isEmptyLayer, layerDetail, layerName } from '../../../engine/layers/labels';
import { defaultLayers } from '../../../engine/layers/defaults';
import { assetFromFile, assetFromUrl } from '../../../storage/assets';
import type { Layer, TextLayer } from '../../../types/layers';
import { LayerInspector } from './LayerInspector';
import { useLayerEditor, type LayerEditor } from './useLayerEditor';

const GLYPH: Record<Layer['type'], string> = { shape: '▭', image: '▨', text: 'T', generated: '▦', group: '▸' };
const glyphOf = (l: Layer) => (l.type === 'shape' && l.shape === 'ellipse' ? '◯' : l.type === 'image' && l.source?.kind === 'vector' ? '✦' : GLYPH[l.type]);

function Row({ layer, ed, index, count, indent }: { layer: Layer; ed: LayerEditor; index: number; count: number; indent?: boolean }) {
  const own = ed.touched.has(layer.id);
  const empty = isEmptyLayer(layer);
  const selected = ed.selected?.id === layer.id;
  const close = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.closest('details')?.removeAttribute('open');

  const duplicate = () => ed.add(duplicateLayer(layer, ed.layers.map((l) => l.id)), layer.id);

  return (
    <li className={`layer-row ${selected ? 'selected' : ''} ${empty ? 'empty' : ''} ${layer.visible ? '' : 'off'} ${indent ? 'indented' : ''}`}>
      <button className="layer-eye" aria-label={layer.visible ? `Hide ${layerName(layer)}` : `Show ${layerName(layer)}`} aria-pressed={layer.visible} title={layer.visible ? 'Hide' : 'Show'} onClick={() => ed.update(layer.id, { visible: !layer.visible })}>
        {layer.visible ? '●' : '○'}
      </button>
      <button className="layer-main" aria-pressed={selected} onClick={() => ed.select(selected ? null : layer.id)}>
        <span className="layer-glyph" aria-hidden="true">{glyphOf(layer)}</span>
        <span className="layer-text">
          <span className="layer-name">
            {layerName(layer)}
            {own && <span className="dot" title={ed.isOverride ? 'This item changes this layer' : 'This design changes this layer'} />}
          </span>
          <small>{layerDetail(layer, ed.item, ed.assets)}</small>
        </span>
      </button>
      <span className="layer-actions">
        <button aria-label={`Move ${layerName(layer)} up`} title="Move up (in front)" disabled={index === 0} onClick={() => ed.move(layer.id, 1)}>▲</button>
        <button aria-label={`Move ${layerName(layer)} down`} title="Move down (behind)" disabled={index === count - 1} onClick={() => ed.move(layer.id, -1)}>▼</button>
        <details className="menu">
          <summary aria-label={`More for ${layerName(layer)}`}>⋯</summary>
          <div className="menu-list" onClick={close}>
            <button onClick={duplicate}>Duplicate</button>
            {own && isDefaultId(layer.id) && <button onClick={() => ed.reset(layer.id)}>{ed.isOverride ? 'Use the design’s version' : 'Back to the default'}</button>}
            <button onClick={() => ed.remove(layer.id)}>Remove</button>
          </div>
        </details>
      </span>
    </li>
  );
}

/**
 * The folder a group of layers sits in (a side's Branded dress). Its eye shows or hides that side's layers only; the
 * layers inside are ordinary and are changed like any others, and "Put back" forgets every change made to them.
 */
function FolderRow({ folder, inside, ed, open, onToggle }: { folder: Layer; inside: Layer[]; ed: LayerEditor; open: boolean; onToggle: () => void }) {
  const on = folder.visible;
  const edited = [...inside, folder].filter((c) => ed.touched.has(c.id));
  return (
    <li className={`layer-row folder ${on ? '' : 'off'}`}>
      <button className="layer-eye" aria-label={on ? 'Hide Branded on this side' : 'Show Branded on this side'} aria-pressed={on} title="Show the platform or format's trade dress on this side" onClick={() => ed.update(folder.id, { visible: !on })}>
        {on ? '●' : '○'}
      </button>
      <button className="layer-main" aria-expanded={open} onClick={onToggle}>
        <span className="layer-glyph" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="layer-text">
          <span className="layer-name">
            {layerName(folder)}
            {edited.length > 0 && <span className="dot" title={ed.isOverride ? 'This item changes some of these' : 'This design changes some of these'} />}
          </span>
          <small>{inside.length} layer{inside.length === 1 ? '' : 's'} here{on ? '' : ' · off'}</small>
        </span>
      </button>
      <span className="layer-actions">
        {edited.length > 0 && (
          <button title="Forget every change made to these layers" onClick={() => ed.resetMany(edited.map((c) => c.id))}>
            Put back
          </button>
        )}
      </span>
    </li>
  );
}

/** Adds layers to the current tab: text, a picture, a logo, a shape or a code. */
function AddMenu({ ed }: { ed: LayerEditor }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = ed.layers.map((l) => l.id);
  const target = ed.tab;
  const close = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.closest('details')?.removeAttribute('open');

  const fromFiles = async (files: FileList | null) => {
    setError(null);
    try {
      for (const file of Array.from(files ?? [])) {
        const asset = await assetFromFile(file);
        ed.add(newImage(freshId('image', ids), target, { kind: 'asset', id: asset.id }, { name: asset.name }), undefined, asset);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that image');
    }
  };
  const fromUrl = () => {
    const raw = window.prompt('Address of the image (https://…)');
    if (!raw) return;
    setError(null);
    try {
      const asset = assetFromUrl(raw);
      ed.add(newImage(freshId('image', ids), target, { kind: 'asset', id: asset.id }, { name: asset.name }), undefined, asset);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that image');
    }
  };

  const CHOICES = ['Text', 'Picture from this item', 'Picture from a file…', 'Picture from an address…', 'Logo', 'Rectangle', 'Ellipse', 'QR code or barcode', 'Custom graphic (SVG)'] as const;
  const choose = (choice: (typeof CHOICES)[number]) => {
    switch (choice) {
      case 'Text':
        return ed.add(newText(freshId('text', ids), target, { name: 'Text' } as Partial<TextLayer>));
      case 'Picture from this item':
        return ed.add(newImage(freshId('image', ids), target, { kind: 'role', ref: 'cover' }));
      case 'Picture from a file…':
        return fileInput.current?.click();
      case 'Picture from an address…':
        return fromUrl();
      case 'Logo':
        return ed.add(newImage(freshId('image', ids), target, null, { name: 'Logo', placement: null, fit: 'fit' }));
      case 'Rectangle':
        return ed.add(newShape(freshId('shape', ids), target));
      case 'Ellipse':
        return ed.add(newShape(freshId('shape', ids), target, { shape: 'ellipse', name: 'Ellipse' }));
      case 'QR code or barcode':
        return ed.add(newCode(freshId('code', ids), target));
      case 'Custom graphic (SVG)':
        return ed.add(newSvg(freshId('graphic', ids), target, SVG_PRESETS[0].svg));
    }
  };

  return (
    <>
      <details className="menu add-menu">
        <summary>+ Add layer</summary>
        <div className="menu-list" onClick={close}>
          {CHOICES.map((label) => (
            <button key={label} onClick={() => choose(label)}>
              {label}
            </button>
          ))}
        </div>
      </details>
      {error && <p className="error small">{error}</p>}
      <input ref={fileInput} type="file" accept="image/*" multiple hidden aria-label="Upload pictures" onChange={(e) => (void fromFiles(e.target.files), (e.target.value = ''))} />
    </>
  );
}

/** The layers on the selected tab, topmost first, with the controls of the one selected. */
export function LayerPanel() {
  const ed = useLayerEditor();
  const { tabLayers, selected, hidden, tab, template } = ed;
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  // Layers the case supplies that this level has taken away, to put back.
  const removed = defaultLayers(template).filter((l) => l.type !== 'group' && hidden.includes(l.id) && l.target === tab);

  // The list as shown: a folder's layers sit under one row for it (closed until opened), in the order they are drawn.
  const folders = new Map(ed.layers.filter((l) => l.type === 'group').map((l) => [l.id, l]));
  const rows: React.ReactNode[] = [];
  const seen = new Set<string>();
  tabLayers.forEach((l, i) => {
    const folder = l.parent ? folders.get(l.parent) : undefined;
    if (folder && !seen.has(folder.id)) {
      seen.add(folder.id);
      const inside = tabLayers.filter((c) => c.parent === folder.id);
      const open = openFolders.has(folder.id);
      rows.push(<FolderRow key={folder.id} folder={folder} ed={ed} open={open} inside={inside} onToggle={() => setOpenFolders((o) => (o.has(folder.id) ? new Set([...o].filter((x) => x !== folder.id)) : new Set(o).add(folder.id)))} />);
    }
    if (folder && !openFolders.has(folder.id)) return;
    rows.push(<Row key={l.id} layer={l} ed={ed} index={i} count={tabLayers.length} indent={!!folder} />);
  });

  return (
    <div className="layer-panel">
      <div className="layer-head">
        <h2>{tab === 'canvas' ? 'Across all panels' : 'Layers'}</h2>
        <AddMenu ed={ed} />
      </div>
      {tab === 'canvas' && <p className="muted small">These sit on the printed panels together, so one layer can cross the spine. Flaps that fold away are left out.</p>}
      {tabLayers.length === 0 ? (
        <p className="muted small">No layers here yet. Use Add layer.</p>
      ) : (
        <ul className="layers" aria-label="Layers, topmost first">
          {rows}
        </ul>
      )}
      {removed.length > 0 && (
        <details className="removed">
          <summary>Removed ({removed.length})</summary>
          <ul>
            {removed.map((l) => (
              <li key={l.id}>
                <span>{layerName(l)}</span>
                <button className="link" onClick={() => ed.reset(l.id)}>
                  Put back
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {selected ? <LayerInspector key={selected.id} layer={selected} ed={ed} /> : tabLayers.length > 0 && <p className="muted small">Select a layer to change it.</p>}
    </div>
  );
}
