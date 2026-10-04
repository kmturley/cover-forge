import { useEffect, useMemo } from 'react';
import { Line } from '@react-three/drei';
import { CanvasTexture, DoubleSide, LinearFilter, Matrix4, Quaternion, Vector3 } from 'three';
import type { PanelId, PreviewSpec, TemplateConfig } from '../types/template';
import { MEASURE_COLOR, formatMm } from '../engine/MeasurementOverlay';
import { insetFaces, labelWrap, previewScale } from './PreviewGeometry';

const COLOR = MEASURE_COLOR;
/** How far (mm) dimension lines sit clear of the model. */
const OFFSET_MM = 10;

type V3 = [number, number, number];

interface Dim {
  a: Vector3;
  b: Vector3;
  /** From the measured edge out to the dimension line. */
  off: Vector3;
  /** The side of the label's plane that faces the viewer, so the text isn't mirrored. */
  facing: Vector3;
  /** The printed size to show (mm), when the artwork's real size differs from the span it is drawn across. Defaults to the span. */
  mm?: number;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** A flat label texture, drawn once per value. */
function labelTexture(text: string): { texture: CanvasTexture; aspect: number } {
  const c = document.createElement('canvas');
  const size = 96;
  const ctx = c.getContext('2d')!;
  ctx.font = `700 ${size * 0.62}px Helvetica, Arial, sans-serif`;
  c.width = Math.ceil(ctx.measureText(text).width + size * 0.6);
  c.height = size;
  ctx.font = `700 ${size * 0.62}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, size / 2 + 2);
  const texture = new CanvasTexture(c);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, aspect: c.width / c.height };
}

/** One dimension drawn flat in the plane spanned by its measured direction and its offset: extension lines, dimension line, arrowheads, value. */
function Dimension({ a, b, off, facing, mm }: Dim) {
  const len = a.distanceTo(b);
  const u = b.clone().sub(a).normalize();
  const n = off.clone().normalize();
  const da = a.clone().add(off);
  const db = b.clone().add(off);
  const gap = n.clone().multiplyScalar(1);
  const over = n.clone().multiplyScalar(2);
  const head = Math.min(3, len / 4);
  const wing = n.clone().multiplyScalar(head * 0.4);
  const arrow = (p: Vector3, d: number): V3[] => {
    const base = p.clone().addScaledVector(u, d * head);
    return [base.clone().add(wing).toArray(), p.toArray(), base.clone().sub(wing).toArray()] as V3[];
  };

  const text = formatMm(mm ?? len);
  const { texture, aspect } = useMemo(() => labelTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  const quaternion = (() => {
    // Of the four ways to lay the text along the line, keep those facing `facing`, preferring upright, left-to-right.
    let best: { u: Vector3; up: Vector3; w: Vector3 } | null = null;
    let bestScore = -Infinity;
    for (const su of [1, -1]) {
      for (const sp of [1, -1]) {
        const lu = u.clone().multiplyScalar(su);
        const up = n.clone().multiplyScalar(sp);
        const w = lu.clone().cross(up);
        if (w.dot(facing) <= 0) continue;
        const score = up.y + 0.3 * lu.y + 0.1 * lu.x;
        if (score > bestScore) {
          bestScore = score;
          best = { u: lu, up, w };
        }
      }
    }
    const { u: lu, up, w } = best!;
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(lu, up, w));
  })();
  const labelH = 5;
  const mid = da.clone().add(db).multiplyScalar(0.5);

  const line = (pts: V3[], key: string) => <Line key={key} points={pts} color={COLOR} lineWidth={1.5} depthTest={false} renderOrder={10} />;
  return (
    <group>
      {line([a.clone().add(gap).toArray() as V3, a.clone().add(off).add(over).toArray() as V3], 'ea')}
      {line([b.clone().add(gap).toArray() as V3, b.clone().add(off).add(over).toArray() as V3], 'eb')}
      {line([da.toArray() as V3, db.toArray() as V3], 'dim')}
      {line(arrow(da, 1), 'aa')}
      {line(arrow(db, -1), 'ab')}
      <mesh position={mid} quaternion={quaternion} renderOrder={11}>
        <planeGeometry args={[labelH * aspect, labelH]} />
        <meshBasicMaterial map={texture} transparent side={DoubleSide} depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * The front artwork as it sits on the model: centre (x, y), size, and the z of its edges. On a rounded case the artwork
 * runs round the corners, so its trim edge is where the curve ends, `radiusMm` behind the front plane: drawing the lines
 * on the plane instead would look shifted against the cut lines whenever the camera isn't square-on.
 */
interface Art {
  cx: number;
  cy: number;
  w: number;
  h: number;
  z: number;
  /** The printed panel's real size, shown as the value. */
  mmW: number;
  mmH: number;
}

const panelOf = (t: TemplateConfig, id: PanelId | undefined) => t.panels.find((p) => p.id === id);

/** Where the front cover's artwork actually is: the whole face on a case or card, but only the label on a disk or diskette. */
function frontArt(t: TemplateConfig, spec: PreviewSpec): Art | null {
  if (spec.kind === 'box') {
    const p = panelOf(t, spec.faces['+z']);
    return p ? { cx: 0, cy: 0, w: spec.widthMm, h: spec.heightMm, z: spec.depthMm / 2 - spec.radiusMm, mmW: p.widthMm, mmH: p.heightMm } : null;
  }
  const p = panelOf(t, spec.panel);
  if (!p) return null;
  if (spec.fullFace) return { cx: 0, cy: 0, w: spec.bodyWidthMm, h: spec.bodyHeightMm, z: spec.bodyDepthMm / 2, mmW: p.widthMm, mmH: p.heightMm };
  // A label: its width, and the part of its height that sits on the front (the rest wraps round the bottom edge).
  const top = spec.labelTopMm === undefined ? p.heightMm / 2 : spec.bodyHeightMm / 2 - spec.labelTopMm;
  const front = spec.labelTopMm === undefined ? p.heightMm : labelWrap(spec.bodyHeightMm, spec.bodyDepthMm, p.heightMm, spec.labelTopMm).frontMm;
  const cy = spec.labelTopMm === undefined ? 0 : top - front / 2;
  return { cx: 0, cy, w: p.widthMm, h: front, z: spec.bodyDepthMm / 2, mmW: p.widthMm, mmH: front };
}

/**
 * The cover's width and height, and (on cases) the spine's width, in mm, each flat in its own plane (front face, and the
 * spine's bottom edge) so it doesn't turn to face the camera as the model is orbited. They span the printed artwork,
 * not the case around it: a card inset in the case, or a label on a disk, is measured at its own edges.
 */
export function Measurements3D({ spec, template }: { spec: PreviewSpec; template: TemplateConfig }) {
  const art = frontArt(template, spec);
  if (!art) return null;
  const { cx, cy, w, h, z } = art;
  const dims: Dim[] = [
    // Width, under the front artwork.
    { a: v(cx - w / 2, cy - h / 2, z), b: v(cx + w / 2, cy - h / 2, z), off: v(0, -OFFSET_MM, 0), facing: v(0, 0, 1), mm: art.mmW },
    // Height, right of it.
    { a: v(cx + w / 2, cy - h / 2, z), b: v(cx + w / 2, cy + h / 2, z), off: v(OFFSET_MM, 0, 0), facing: v(0, 0, 1), mm: art.mmH },
  ];
  if (spec.kind === 'box') {
    // The spine's width, hanging below its bottom edge in an upright plane facing the spine side (lying flat it is edge-on from the default camera, which is unreadable on a thin spine); two rows down, clear of the width dimension. A narrow spine card sits centred on its face at its own size.
    const spine = panelOf(template, spec.faces['-x']);
    if (spine) {
      const inset = insetFaces(template, spec).some((f) => f.face === '-x');
      const len = inset ? spine.widthMm : spec.depthMm;
      // Likewise a printed spine's bottom edge is where its curve ends, `radiusMm` in from the side plane.
      const x = inset ? -spec.widthMm / 2 : -spec.widthMm / 2 + spec.radiusMm;
      const bottom = inset ? -Math.min(spec.heightMm, spine.heightMm) / 2 : -spec.heightMm / 2;
      dims.push({ a: v(x, bottom, len / 2), b: v(x, bottom, -len / 2), off: v(0, -OFFSET_MM * 2, 0), facing: v(-1, 0, 0), mm: spine.widthMm });
    }
  }
  return (
    <group scale={previewScale(spec)}>
      {dims.map((d, i) => (
        <Dimension key={i} {...d} />
      ))}
    </group>
  );
}
