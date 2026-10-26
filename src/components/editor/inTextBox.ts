/** True when a key press belongs to a text box, which has editing keys (and an undo) of its own. */
export const inTextBox = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && /^(text|search|number|url|email|tel|password)$/.test((t as HTMLInputElement).type)));
