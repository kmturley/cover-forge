import { useAppDispatch, useAppState } from '../../context/AppContext';

/** Whether covers carry their template's official banner (the PS4 or Blu-ray header). Applies to every cover. */
export function BrandedToggle() {
  const { banner } = useAppState();
  const dispatch = useAppDispatch();
  return (
    <div className="design-row branded-row" title="The platform or format banner, e.g. the PS4 or Blu-ray header. Applies to every cover.">
      <label htmlFor="branded">Branded</label>
      <input id="branded" type="checkbox" checked={banner} onChange={(e) => dispatch({ type: 'setBanner', banner: e.target.checked })} />
    </div>
  );
}
