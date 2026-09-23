import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** The read-only description shown until Edit is pressed. */
  summary: ReactNode;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  /** Extra header actions while editing, e.g. the "None" choice. */
  extra?: ReactNode;
  /** The controls, revealed while editing. */
  children: ReactNode;
}

/** One part of a design (background, image, logo…): a summary of its settings, and its controls once Edit is pressed. */
export function Section({ title, summary, editing, onEdit, onDone, extra, children }: Props) {
  return (
    <section className="design-section" aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
        <span className="section-actions">
          {editing && extra}
          <button className="link" onClick={editing ? onDone : onEdit} aria-expanded={editing}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </span>
      </div>
      {editing ? children : <div className="summary">{summary}</div>}
    </section>
  );
}
