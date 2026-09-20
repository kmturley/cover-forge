import { useState } from 'react';
import { useAppState, useSelectedItem } from '../../context/AppContext';
import type { PaperSize } from '../../export/imposition';
import type { ExportSettings } from '../../export/rasterExport';
import { exportCurrent, exportSheetsPdf, exportZip } from '../../export/zipExport';
import { PrintSheetPreview } from './PrintSheetPreview';
import { getLabelSheet, labelSheetsFor } from '../../export/sheets';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { items, template, shared, styleOverlay } = useAppState();
  const selected = useSelectedItem();
  const [paper, setPaper] = useState<PaperSize>('A4');
  const [chosenSheet, setChosenSheet] = useState<string>('');
  const [format, setFormat] = useState<ExportSettings['format']>('png');
  const [guides, setGuides] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const base = { template, shared, style: styleOverlay };
  // A die-cut sheet only applies to the templates it was made for; otherwise fall back to plain paper.
  const labelSheets = labelSheetsFor(template.kind);
  const labelSheet = getLabelSheet(chosenSheet)?.kinds.includes(template.kind) ? chosenSheet : undefined;
  const chosen = getLabelSheet(labelSheet);
  const settings: ExportSettings = { paper: chosen?.paper ?? paper, labelSheet, format, guides: guides && !chosen, jpegQuality: 0.92 };

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
              <span>Sheet</span>
              <select value={labelSheet ?? paper} onChange={(e) => (e.target.value === 'A3' || e.target.value === 'A4' || e.target.value === 'Letter' ? (setChosenSheet(''), setPaper(e.target.value)) : setChosenSheet(e.target.value))}>
                <optgroup label="Plain paper (auto multi-up)">
                  <option value="A3">A3</option>
                  <option value="A4">A4</option>
                  <option value="Letter">US Letter</option>
                </optgroup>
                {labelSheets.length > 0 && (
                  <optgroup label="Die-cut label sheets">
                    {labelSheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            {chosen?.note && <p className="muted">{chosen.note}</p>}
            <label className="field">
              <span>Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as ExportSettings['format'])}>
                <option value="png">PNG (300 DPI)</option>
                <option value="jpeg">JPEG (300 DPI)</option>
                <option value="pdf">PDF (exact mm, vector guides)</option>
                <option value="svg">SVG (exact mm, vector guides)</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={guides && !chosen} disabled={!!chosen} onChange={(e) => setGuides(e.target.checked)} />
              Cut / fold guides{chosen ? ' (not on die-cut sheets)' : ''}
            </label>
            <p className="muted">
              {format === 'pdf'
                ? 'ZIP: one PDF per game, one PDF of all sheets, and each game’s original images.'
                : format === 'svg'
                  ? 'ZIP: one SVG per game, one SVG per sheet, and each game’s original images.'
                  : 'ZIP: one image per game, the print sheets as images, and each game’s original images.'}
            </p>
          </div>
          <PrintSheetPreview template={template} paper={settings.paper} labelSheet={labelSheet} />
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
