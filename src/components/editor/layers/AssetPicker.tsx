import { useRef, useState } from 'react';
import { useAppDispatch, useAppState } from '../../../context/AppContext';
import { assetFromFile, assetFromUrl, isMissing, matchAsset, relinkAsset } from '../../../storage/assets';
import { srcOf } from '../../../storage/localImages';
import { assetUrl } from '../../../engine/layers/images';
import type { Asset } from '../../../types/layers';

interface Props {
  selectedId: string | null;
  onPick: (asset: Asset) => void;
}

/**
 * The images kept for reuse on every item (a publisher logo, a rating icon). Add one from a file (kept in this browser)
 * or a web address (only the address is kept). An uploaded file that isn't in this browser, because the design came from
 * elsewhere, shows as missing; pick the file again and everything that uses it draws.
 */
export function AssetPicker({ selectedId, onPick }: Props) {
  const { assets } = useAppState();
  const dispatch = useAppDispatch();
  const addInput = useRef<HTMLInputElement>(null);
  const relinkInput = useRef<HTMLInputElement>(null);
  const relinking = useRef<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const list = Object.values(assets);

  const attempt = async (f: () => Promise<void> | void) => {
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    }
  };

  const addFiles = (files: FileList | null) =>
    attempt(async () => {
      for (const file of Array.from(files ?? [])) {
        const asset = await assetFromFile(file);
        dispatch({ type: 'setAsset', asset });
        onPick(asset);
      }
    });

  const addUrl = () =>
    attempt(() => {
      const asset = assetFromUrl(url);
      dispatch({ type: 'setAsset', asset });
      onPick(asset);
      setUrl('');
      setAdding(false);
    });

  const relink = (file: File | undefined) =>
    attempt(async () => {
      const asset = relinking.current;
      relinking.current = null;
      if (!file || !asset) return;
      const match = await matchAsset(asset, file);
      if (match === 'none' && !window.confirm(`“${file.name}” doesn’t look like “${asset.name}” (different name, size and contents). Use it anyway?`)) return;
      dispatch({ type: 'setAsset', asset: await relinkAsset(asset, file) });
    });

  return (
    <div className="asset-picker">
      {list.length === 0 && <p className="muted small">No images yet. Add a publisher logo, a rating icon or a screenshot to use on any item.</p>}
      <div className="assets">
        {list.map((a) => {
          const missing = isMissing(a);
          return (
            <div key={a.id} className={`asset ${a.id === selectedId ? 'selected' : ''} ${missing ? 'missing' : ''}`}>
              <button className="asset-thumb" title={missing ? `${a.name} (missing from this browser)` : a.name} aria-label={a.name} aria-pressed={a.id === selectedId} onClick={() => onPick(a)}>
                {missing ? <span>missing</span> : <img src={srcOf(assetUrl(a) ?? '')} alt="" crossOrigin="anonymous" loading="lazy" />}
              </button>
              <span className="asset-name" title={a.name}>{a.name}</span>
              <span className="asset-actions">
                {missing && (
                  <button
                    className="link"
                    onClick={() => {
                      relinking.current = a;
                      relinkInput.current?.click();
                    }}
                  >
                    Find file…
                  </button>
                )}
                <button className="link" aria-label={`Remove ${a.name} from your images`} onClick={() => window.confirm(`Remove “${a.name}” from your images? Layers that use it will be empty.`) && dispatch({ type: 'removeAsset', id: a.id })}>
                  Remove
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="button-row">
        <button onClick={() => addInput.current?.click()}>Add from file…</button>
        <button onClick={() => setAdding((v) => !v)} aria-expanded={adding}>Add from address…</button>
      </div>
      {adding && (
        <form className="asset-url" onSubmit={(e) => (e.preventDefault(), void addUrl())}>
          <input type="text" autoFocus placeholder="https://example.com/logo.png" aria-label="Image address" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="submit" disabled={!url.trim()}>Add</button>
        </form>
      )}
      {error && <p className="error small">{error}</p>}
      <input ref={addInput} type="file" accept="image/*" multiple hidden aria-label="Upload images" onChange={(e) => (void addFiles(e.target.files), (e.target.value = ''))} />
      <input ref={relinkInput} type="file" accept="image/*" hidden aria-label="Choose the missing file" onChange={(e) => (void relink(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  );
}
