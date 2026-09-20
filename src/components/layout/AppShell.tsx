import { lazy, Suspense, useState } from 'react';
import { useAppState } from '../../context/AppContext';
import { SearchPanel } from '../search/SearchPanel';
import { CanvasEditor } from '../editor/CanvasEditor';
import { PanelControls } from '../editor/PanelControls';
import { ExportModal } from '../export/ExportModal';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';

// three.js is heavy; only load it when the 3D view is first opened.
const ThreeDPreview = lazy(() => import('../preview/ThreeDPreview').then((m) => ({ default: m.ThreeDPreview })));

export function AppShell() {
  const { view } = useAppState();
  const [exporting, setExporting] = useState(false);

  return (
    <div className="shell">
      <Toolbar onExport={() => setExporting(true)} />
      <SearchPanel />
      <main className="main">
        {view === '2d' ? (
          <CanvasEditor />
        ) : (
          <Suspense fallback={<p className="empty-hint">Loading 3D viewer…</p>}>
            <ThreeDPreview />
          </Suspense>
        )}
      </main>
      <aside className="sidebar right">
        <PanelControls />
      </aside>
      <StatusBar />
      {exporting && <ExportModal onClose={() => setExporting(false)} />}
    </div>
  );
}
