import { useState } from 'react';
import { templateIdOf, useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { CASES, brandLabel, brandOf, caseOf, getEntry, pieceOf, piecesOf } from '../../templates/library';
import { dressOf } from '../../engine/layers/dress';
import { PIECES, PIECE_NAME } from '../../templates/pieces';
import { TemplateIcon } from './TemplateIcon';
import { TemplatePickerModal } from './TemplatePickerModal';

/**
 * The selected item's template (the branding it starts with), its case and its Type, beside its design: all belong to the item,
 * so they're changed here. A template brings its own case and Type, which can then be changed: SNES, Original, Box becomes
 * SNES, DVD Case, Box (the box that fits round a DVD case) and then SNES, DVD Case, Insert.
 */
export function CaseBar() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const item = useSelectedItem();
  const [picking, setPicking] = useState(false);
  if (!item) return null;
  const templateId = templateIdOf(state, item);
  const entry = getEntry(templateId);
  const pieces = piecesOf(templateId);
  const current = pieceOf(templateId);
  return (
    <>
    <div className="design-row case-row">
      <span>Template</span>
      <button className="case-button" title={`Change the template for “${item.title}”`} onClick={() => setPicking(true)}>
        {entry && <TemplateIcon kind={entry.kind} />}
        <span className="case-text">
          <span>{brandLabel(dressOf(item) || brandOf(templateId))}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {picking && <TemplatePickerModal itemIds={[item.id]} onClose={() => setPicking(false)} />}
    </div>
    <div className="design-row case-row">
      <label htmlFor="case-select">Case</label>
      <select id="case-select" value={caseOf(templateId) ?? ''} onChange={(e) => dispatch({ type: 'setItemCase', items: [item.id], case: e.target.value })}>
        {CASES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
    {entry && <p className="scope-note">{entry.size}</p>}
    <div className="design-row case-row">
      <span>Type</span>
      <div className="seg" role="group" aria-label="Type">
        {PIECES.map((piece) => {
          const target = pieces[piece];
          return (
            <button
              key={piece}
              className={piece === current ? 'active' : ''}
              aria-pressed={piece === current}
              disabled={!target}
              title={target ? `Print the ${PIECE_NAME[piece].toLowerCase()} for “${item.title}”` : `${entry?.name ?? 'This case'} has no ${PIECE_NAME[piece].toLowerCase()}`}
              onClick={() => target && target !== templateId && dispatch({ type: 'setItemType', items: [item.id], template: target })}
            >
              {PIECE_NAME[piece]}
            </button>
          );
        })}
      </div>
    </div>
    </>
  );
}
