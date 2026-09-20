import { useMemo } from 'react';
import type { PaperSize } from '../../export/imposition';
import { computeLayout } from '../../export/sheets';
import type { TemplateConfig } from '../../types/template';

/** Schematic of how the artwork sits on one sheet (and, for die-cut sheets, where the labels are). */
export function PrintSheetPreview({ template, paper, labelSheet }: { template: TemplateConfig; paper: PaperSize; labelSheet?: string }) {
  const layout = useMemo(() => computeLayout(template, paper, labelSheet), [template, paper, labelSheet]);
  const { widthMm: pw, heightMm: ph } = layout.paper;
  return (
    <figure className="sheet-preview">
      <svg viewBox={`0 0 ${pw} ${ph}`} role="img" aria-label={`${layout.placements.length} per sheet`}>
        <rect width={pw} height={ph} fill="#fff" stroke="#888" strokeWidth={0.5} />
        {layout.labelRects?.map((r, i) => (
          <rect key={`l${i}`} x={r.xMm} y={r.yMm} width={r.widthMm} height={r.heightMm} fill="none" stroke="#999" strokeWidth={0.4} strokeDasharray="1.5 1" />
        ))}
        {layout.placements.map((p, i) => (
          <rect
            key={i}
            x={p.xMm}
            y={p.yMm}
            width={p.crop ? p.crop.widthMm : layout.cellWidthMm}
            height={p.crop ? p.crop.heightMm : layout.cellHeightMm}
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
        {layout.warnings?.map((w) => (
          <span key={w} className="warn">
            {w}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
