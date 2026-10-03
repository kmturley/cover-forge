import { ConfigButtons } from "./ConfigButtons";

/** The app bar: file actions and export. Everything about how covers look is in the right sidebar. */
export function Toolbar({ onExport }: { onExport: () => void }) {
  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <strong className="brand">CoverForge</strong>
        <div className="toolbar-actions">
          <ConfigButtons />
          <button className="primary" onClick={onExport}>
            Export…
          </button>
        </div>
      </div>
    </header>
  );
}
