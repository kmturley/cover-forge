import { useRef } from 'react';
import { srcOf } from '../../../storage/localImages';
import { NumberField } from './NumberField';

interface Props {
  url: string;
  focus: { x: number; y: number };
  onChange: (f: { x: number; y: number }) => void;
}

/**
 * Picks the part of an image that stays in view when it is cropped to fill a box: click or drag on the picture. Because
 * it is a point in the image, not an offset, the subject stays framed if the case (and so the box) changes later.
 */
export function FocusPad({ url, focus, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    onChange({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) });
  };
  return (
    <div className="focus-pad">
      <div
        ref={ref}
        className="focus-image"
        role="group"
        aria-label="Focus point: click the part of the picture to keep in view"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && pick(e)}
      >
        <img src={srcOf(url)} alt="" crossOrigin="anonymous" draggable={false} />
        <span className="focus-dot" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
      </div>
      <div className="focus-fields">
        <NumberField label="Focus across" unit="%" min={0} max={100} step={1} decimals={1} value={focus.x} onChange={(x) => onChange({ ...focus, x })} />
        <NumberField label="Focus down" unit="%" min={0} max={100} step={1} decimals={1} value={focus.y} onChange={(y) => onChange({ ...focus, y })} />
        <button onClick={() => onChange({ x: 50, y: 50 })} disabled={focus.x === 50 && focus.y === 50}>
          Centre
        </button>
      </div>
    </div>
  );
}
