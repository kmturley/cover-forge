import { useAppDispatch, useAppState } from "../../context/AppContext";
import { regionsOf, variantsFor } from "../../templates";
import { TemplateTabs } from "./TemplateTabs";
import type { Region } from "../../types/template";
import type { StyleOverlay } from "../../types/editor";
import { ConfigButtons } from "./ConfigButtons";

export function Toolbar({ onExport }: { onExport: () => void }) {
  const { templateKind, region, variantId, styleOverlay } =
    useAppState();
  const regions = regionsOf(templateKind);
  const variants = variantsFor(templateKind, region);
  const dispatch = useAppDispatch();
  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <strong className="brand">CoverForge</strong>
        <TemplateTabs />
        <div className="toolbar-actions">
          <ConfigButtons />
          <button className="primary" onClick={onExport}>
            Export…
          </button>
        </div>
      </div>
      <div className="toolbar-row">
        {regions.length > 1 && (
          <label>
            Region
            <select
              value={region}
              onChange={(e) =>
                dispatch({
                  type: "setRegion",
                  region: e.target.value as Region,
                })
              }
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}
        {variants.length > 1 && (
          <label>
            {templateKind === 'game-case' ? 'Platform' : 'Size'}
            <select
              value={variantId}
              onChange={(e) =>
                dispatch({ type: "setVariant", id: e.target.value })
              }
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Style
          <select
            value={styleOverlay}
            onChange={(e) =>
              dispatch({
                type: "setStyleOverlay",
                style: e.target.value as StyleOverlay,
              })
            }
          >
            <option value="clean">Clean</option>
            <option value="digital">Digital / Official</option>
            <option value="retro">Scanned / Retro wear</option>
          </select>
        </label>
      </div>
    </header>
  );
}
