/** The "None" choice for an image or logo picker: a text link beside the section title. */
export function NoneLink({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <button className={`link ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}>
      None
    </button>
  );
}
