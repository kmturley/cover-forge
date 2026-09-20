import { useState } from 'react';
import { useAppState, useSelectedItem } from '../../context/AppContext';
import type { PaperSize } from '../../export/imposition';
import type { ExportSettings } from '../../export/rasterExport';
import { exportCurrent, exportSheetsPdf, exportZip } from '../../export/zipExport';
import { PrintSheetPreview } from './PrintSheetPreview';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { items, template, shared } = useAppState();
  const selected = useSelectedItem();
  const [paper, setPaper] = useState<PaperSize>('A4');
  const [format, setFormat] = useState<ExportSettings['format']>('png');
  const [guides, setGuides] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const base = { template, shared };
  const settings: ExportSettings = { paper, format, guides, jpegQuality: 0.92 };

  async function run(task: () => Promise<void>) {
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Export" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>
        <div className="modal-body">
          <div>
            <label className="field">
              <span>Paper</span>
              <select value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)}>
                <option value="A4">A4</option>
                <option value="Letter">US Letter</option>
              </select>
            </label>
            <label className="field">
              <span>Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as ExportSettings['format'])}>
                <option value="png">PNG (300 DPI)</option>
                <option value="jpeg">JPEG (300 DPI)</option>
                <option value="pdf">PDF (exact mm, vector guides)</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
              Cut / fold guides
            </label>
            <p className="muted">
              {format === 'pdf'
                ? 'ZIP: one PDF per game, one PDF of all sheets, and each game’s original images.'
                : 'ZIP: one image per game, the print sheets as images, and each game’s original images.'}
            </p>
          </div>
          <PrintSheetPreview template={template} paper={paper} />
        </div>

        {progress && (
          <div className="progress">
            <progress value={progress.done} max={progress.total} />
            <span>{progress.label}</span>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {notice && <p className="muted">{notice}</p>}

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button disabled={busy || !selected} onClick={() => selected && run(() => exportCurrent(base, selected, settings))}>
            Download current
          </button>
          {format === 'pdf' && (
            <button disabled={busy || !items.length} onClick={() => run(() => exportSheetsPdf(base, items, settings))}>
              Download sheets (PDF)
            </button>
          )}
          <button
            className="primary"
            disabled={busy || !items.length}
            onClick={() =>
              run(async () => {
                const { missingAssets } = await exportZip(base, items, settings, (done, total, label) => setProgress({ done, total, label }));
                if (missingAssets.length) setNotice(`Done. Not available (skipped): ${missingAssets.join(', ')}.`);
              })
            }
          >
            Download all (ZIP)
          </button>
        </div>
      </div>
    </div>
  );
}
