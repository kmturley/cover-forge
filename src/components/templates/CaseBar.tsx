import { useState } from 'react';
import { templateIdOf, useAppState, useSelectedItem } from '../../context/AppContext';
import { getEntry } from '../../templates/library';
import { TemplateIcon } from './TemplateIcon';
import { TemplatePickerModal } from './TemplatePickerModal';

/** The selected item's case, beside its design: both belong to the item, so they're changed here. */
export function CaseBar() {
  const state = useAppState();
  const item = useSelectedItem();
  const [picking, setPicking] = useState(false);
  if (!item) return null;
  const entry = getEntry(templateIdOf(state, item));
  return (
    <div className="design-row case-row">
      <span>Case</span>
      <button className="case-button" title={`Change the case for “${item.title}”`} onClick={() => setPicking(true)}>
        {entry && <TemplateIcon kind={entry.kind} />}
        <span className="case-text">
          <span>{entry?.name}</span>
          <small>{entry?.size}</small>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {picking && <TemplatePickerModal itemIds={[item.id]} onClose={() => setPicking(false)} />}
    </div>
  );
}
