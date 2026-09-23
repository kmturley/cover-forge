import { useState } from 'react';

/** Asks for a design name (a new fork or a rename). */
export function NameModal({ title, initial, confirm, onDone, onClose }: { title: string; initial: string; confirm: string; onDone: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;
  const submit = () => ok && (onDone(name.trim()), onClose());
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <form className="modal narrow" onClick={(e) => e.stopPropagation()} onSubmit={(e) => (e.preventDefault(), submit())}>
        <h2>{title}</h2>
        <input type="text" autoFocus value={name} aria-label="Design name" onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!ok}>
            {confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
