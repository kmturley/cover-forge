import { useState } from 'react';
import { readImageFile } from '../../api/upload';
import { useAppDispatch } from '../../context/AppContext';
import type { MediaItem } from '../../types/media';

/** Manual entry for anything the catalogues don't have: a title plus your own front, back and logo images. */
export function CustomEntry() {
  const dispatch = useAppDispatch();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [year, setYear] = useState('');
  const [files, setFiles] = useState<{ cover?: File; back?: File; logo?: File; extra: File[] }>({ extra: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const [cover, hero, logo, ...extra] = await Promise.all([
        files.cover ? readImageFile(files.cover) : null,
        files.back ? readImageFile(files.back) : null,
        files.logo ? readImageFile(files.logo) : null,
        ...files.extra.map((f) => readImageFile(f)),
      ]);
      const item: MediaItem = {
        id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'custom',
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        year: year.trim() || undefined,
        assets: { cover, hero, logo, screenshots: extra.filter((u): u is string => !!u) },
      };
      dispatch({ type: 'addItem', item });
      setTitle('');
      setSubtitle('');
      setYear('');
      setFiles({ extra: [] });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t read those images');
    } finally {
      setBusy(false);
    }
  }

  const pick = (key: 'cover' | 'back' | 'logo') => (e: React.ChangeEvent<HTMLInputElement>) => setFiles((f) => ({ ...f, [key]: e.target.files?.[0] }));

  return (
    <form className="custom-entry" onSubmit={submit}>
      <label className="field">
        <span>Title</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Homebrew Quest" />
      </label>
      <div className="two-col">
        <label className="field">
          <span>Subtitle (optional)</span>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Year</span>
          <input type="text" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Front cover</span>
        <input type="file" accept="image/*" onChange={pick('cover')} aria-label="Front cover image" />
      </label>
      <label className="field">
        <span>Back cover (used on the Back panel)</span>
        <input type="file" accept="image/*" onChange={pick('back')} aria-label="Back cover image" />
      </label>
      <label className="field">
        <span>Logo (PNG with transparency works best)</span>
        <input type="file" accept="image/*" onChange={pick('logo')} aria-label="Logo image" />
      </label>
      <label className="field">
        <span>Extra images (spine art, screenshots…)</span>
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles((f) => ({ ...f, extra: Array.from(e.target.files ?? []) }))} aria-label="Extra images" />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit" disabled={busy || !title.trim()}>
        {busy ? 'Adding…' : 'Add to queue'}
      </button>
      <p className="muted small">Images are scaled to fit within 1600 px and kept in this browser only.</p>
    </form>
  );
}
