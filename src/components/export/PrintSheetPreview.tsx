import { useMemo } from 'react';
import { impose, type PaperSize } from '../../export/imposition';
import type { TemplateConfig } from '../../types/template';

/** Schematic of how many wraps fit on one sheet and how they're oriented. */
export function PrintSheetPreview({ template, paper }: { template: TemplateConfig; paper: PaperSize }) {
  const layout = useMemo(
    () => impose(template.totalWidthMm, template.totalHeightMm, paper),
    [template, paper],
  );
  const { widthMm: pw, heightMm: ph } = layout.paper;
  return (
    <figure className="sheet-preview">
      <svg viewBox={`0 0 ${pw} ${ph}`} role="img" aria-label={`${layout.placements.length} per ${paper} sheet`}>
        <rect width={pw} height={ph} fill="#fff" stroke="#888" strokeWidth={0.5} />
        {layout.placements.map((p, i) => (
          <rect
            key={i}
            x={p.xMm}
            y={p.yMm}
            width={layout.cellWidthMm}
            height={layout.cellHeightMm}
            fill="#0a4da2"
            fillOpacity={0.35}
            stroke="#0a4da2"
            strokeWidth={0.6}
          />
        ))}
      </svg>
      <figcaption>
        {layout.oversize
          ? 'Too large for this paper at 100% — it will be scaled to fit (not to physical size).'
          : `${layout.placements.length} per sheet${layout.placements[0]?.rotated ? ' (rotated)' : ''}`}
      </figcaption>
    </figure>
  );
}
