import type { PanelBox } from '../../types/editor';
import { MIN_BOX_PERCENT } from '../../engine/box';
import { NumberSlider } from './NumberSlider';

interface Props {
  /** What is being placed, for the slider labels ("Image", "Logo", "Code"). */
  what: string;
  /** The box as it renders now (an automatic or older mm placement shown as the box it amounts to). */
  box: PanelBox;
  /** How far past the panel's edges a box may go, in percent (e.g. 50: from −50% to 150%). */
  overhang: number;
  onChange: (box: PanelBox) => void;
}

/**
 * The start and end of a box on each axis, in percent of the trimmed panel (0–100; beyond reaches into the bleed).
 * Each edge stays at least MIN_BOX_PERCENT clear of the opposite one, so the box can't collapse or turn inside out.
 */
export function BoxControls({ what, box, overhang, onChange }: Props) {
  const [lo, hi] = [-overhang, 100 + overhang];
  const set = (edge: keyof PanelBox, v: number) => {
    const next = { ...box, [edge]: v };
    if (edge === 'xStart') next.xStart = Math.min(v, box.xEnd - MIN_BOX_PERCENT);
    if (edge === 'xEnd') next.xEnd = Math.max(v, box.xStart + MIN_BOX_PERCENT);
    if (edge === 'yStart') next.yStart = Math.min(v, box.yEnd - MIN_BOX_PERCENT);
    if (edge === 'yEnd') next.yEnd = Math.max(v, box.yStart + MIN_BOX_PERCENT);
    onChange(next);
  };
  const slider = (edge: keyof PanelBox, label: string) => (
    <NumberSlider label={`${what} ${label}`} unit="%" min={lo} max={hi} step={0.1} decimals={1} value={box[edge]} onChange={(v) => set(edge, v)} />
  );
  return (
    <>
      <p className="muted small">The box, in % of the panel from its top-left: 0–100 is the trimmed panel, beyond it the bleed.</p>
      {slider('xStart', 'left (start)')}
      {slider('xEnd', 'right (end)')}
      {slider('yStart', 'top (start)')}
      {slider('yEnd', 'bottom (end)')}
    </>
  );
}
