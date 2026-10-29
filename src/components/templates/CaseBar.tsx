import { useState } from 'react';
import { templateIdOf, useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { getEntry, pieceOf, piecesOf } from '../../templates/library';
import { PIECES, PIECE_NAME } from '../../templates/pieces';
import { TemplateIcon } from './TemplateIcon';
import { TemplatePickerModal } from './TemplatePickerModal';

/** The selected item's case, beside its design: both belong to the item, so they're changed here. */
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
      <span>Case</span>
      <button className="case-button" title={`Change the case for “${item.title}”`} onClick={() => setPicking(true)}>
        {entry && <TemplateIcon kind={entry.kind} />}
        <span className="case-text">
          <span>{entry?.name}</span>
          <small>{entry?.detail}</small>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {picking && <TemplatePickerModal itemIds={[item.id]} onClose={() => setPicking(false)} />}
    </div>
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
              onClick={() => target && target !== templateId && dispatch({ type: 'setItemTemplate', items: [item.id], template: target })}
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
