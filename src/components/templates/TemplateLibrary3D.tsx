import { useEffect, useMemo, useRef, useState, type ElementRef, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NeutralToneMapping, SRGBColorSpace, type OrthographicCamera, type Texture } from 'three';
import { useAppState } from '../../context/AppContext';
import { preloadItem, renderCover } from '../../engine/CanvasRenderer';
import { Model, StudioLighting } from '../../three/PreviewScene';
import type { MediaItem } from '../../types/media';
import { layoutRow, type Facing, type Placed, type SizedEntry } from '../../templates/compare';
import { withOwnBranding } from './useThumbnails';

/** Scene units per mm: every case is drawn at this one scale, so their sizes compare truly. */
const UNITS_PER_MM = 0.01;

/**
 * Artwork resolution per case. The view is about size and shape, and a few dozen cases are drawn at once, so each
 * texture is kept small (about a quarter of the main preview's longest side).
 */
const MAX_TEXTURE_PX = 1024;
const pxPerMm = (t: SizedEntry['template']) => Math.min(6, MAX_TEXTURE_PX / Math.max(t.totalWidthMm, t.totalHeightMm));

/** Turns a case about its vertical axis so the chosen side faces the camera (+z). */
function turnFor(c: SizedEntry, facing: Facing): number {
  if (facing === 'front') return 0;
  // The spine is on a side face; a card or sticker has none, so it is shown edge on.
  return c.spineFace === '+x' ? -Math.PI / 2 : Math.PI / 2;
}

const mm = (n: number) => `${Math.round(n * 10) / 10}`;
export const dims = (c: SizedEntry) => `${mm(c.widthMm)} × ${mm(c.heightMm)} × ${mm(c.depthMm)} mm`;

/** One artwork texture per template: the item's design on it, painted small, repainted once its images have loaded. */
function useTextures(list: SizedEntry[], item: MediaItem | null): { textures: Map<string, Texture>; version: number } {
  const { shared, designs, assets } = useAppState();
  const [version, setVersion] = useState(0);
  const shown = useMemo(() => withOwnBranding(item), [item]);
  const textures = useMemo(() => {
    const out = new Map<string, Texture>();
    for (const c of list) {
      const canvas = document.createElement('canvas');
      const px = pxPerMm(c.template);
      canvas.width = Math.max(1, Math.round(c.template.totalWidthMm * px));
      canvas.height = Math.max(1, Math.round(c.template.totalHeightMm * px));
      const t = new CanvasTexture(canvas);
      t.colorSpace = SRGBColorSpace;
      t.generateMipmaps = true;
      t.minFilter = LinearMipmapLinearFilter;
      t.magFilter = LinearFilter;
      out.set(c.entry.id, t);
    }
    return out;
  }, [list]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  useEffect(() => {
    let cancelled = false;
    const paint = (c: SizedEntry) => {
      const t = textures.get(c.entry.id);
      const canvas = t?.image as HTMLCanvasElement | undefined;
      const ctx = canvas?.getContext('2d');
      if (!t || !canvas || !ctx || cancelled) return;
      renderCover(ctx, { template: c.template, item: shown, shared, designs, assets, showGuides: false }, canvas.width / c.template.totalWidthMm);
      t.needsUpdate = true;
    };
    // Painted before the first frame is drawn; the repaint after loading asks for a redraw through `version`.
    list.forEach(paint);
    void Promise.all(list.map((c) => preloadItem({ template: c.template, item: shown, shared, designs, assets }).catch(() => undefined))).then(() => {
      if (cancelled) return;
      list.forEach(paint);
      setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [list, textures, shown, shared, designs, assets]);

  return { textures, version };
}

/** The scene only redraws when asked (frameloop "demand"); this asks whenever something it can't see changes. */
function Redraw({ on }: { on: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [on, invalidate]);
  return null;
}

/** Points the camera at the row and zooms so all of it fits across the view (the user can zoom and pan from there). */
function FitRow({ lengthMm, heightMm, controls, layoutKey }: { lengthMm: number; heightMm: number; controls: RefObject<ElementRef<typeof OrbitControls>>; layoutKey: string }) {
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { camera, invalidate } = get();
    const cam = camera as OrthographicCamera;
    const cx = (lengthMm / 2) * UNITS_PER_MM;
    const cy = (heightMm / 2) * UNITS_PER_MM;
    const wide = (lengthMm * 1.06 + 80) * UNITS_PER_MM;
    const tall = (heightMm * 1.6 + 80) * UNITS_PER_MM;
    cam.zoom = Math.min(size.width / wide, size.height / tall);
    // A little above and to the left, so the tops and one side show as well as the faces being compared.
    cam.position.set(cx - 1.5, cy + 1.4, 10);
    cam.updateProjectionMatrix();
    controls.current?.target.set(cx, cy, 0);
    controls.current?.update();
    invalidate();
    // Refit when the layout or the view's size changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, size.width, size.height]);
  return null;
}

function Row({ placed, textures, facing, focused, hovered, current, onFocus, onHover, onPick }: {
  placed: Placed[];
  textures: Map<string, Texture>;
  facing: Facing;
  focused: string | null;
  hovered: string | null;
  current: string[];
  onFocus: (id: string) => void;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  return (
    <>
      {placed.map(({ item: c, xMm }) => {
        const id = c.entry.id;
        const texture = textures.get(id);
        if (!texture) return null;
        const on = id === focused;
        const lit = on || id === hovered;
        const isCurrent = current.includes(id);
        const footprint = facing === 'front' ? c.widthMm : c.depthMm;
        return (
          <group key={id} position={[xMm * UNITS_PER_MM, 0, 0]}>
            <group
              position={[0, (c.heightMm / 2) * UNITS_PER_MM, 0]}
              rotation={[0, turnFor(c, facing), 0]}
              onClick={(e) => {
                e.stopPropagation();
                onFocus(id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onPick(id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                onHover(id);
              }}
              onPointerOut={() => onHover(null)}
            >
              <Model texture={texture} template={c.template} scale={UNITS_PER_MM} />
            </group>
            {(lit || isCurrent) && (
              // A pad under the case: blue for the one in focus, green for the one in use, grey under the pointer.
              <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[(footprint + 10) * UNITS_PER_MM, (Math.max(c.depthMm, 20) + 20) * UNITS_PER_MM]} />
                <meshBasicMaterial color={on ? '#3b82f6' : isCurrent ? '#22c55e' : '#8b919c'} transparent opacity={0.55} />
              </mesh>
            )}
            {lit && (
              <Html position={[0, (c.heightMm + 12) * UNITS_PER_MM, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <div className={`compare-tag ${on ? 'on' : ''}`}>
                  <strong>{c.entry.name}</strong>
                  <span>{dims(c)}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

interface Props {
  /** What to show, already searched, sorted and grouped by the picker. */
  groups: { name: string; entries: SizedEntry[] }[];
  /** Every template, so textures are made once and kept while the list is filtered. */
  all: SizedEntry[];
  item: MediaItem | null;
  /** Templates the items are on now. */
  current: string[];
  focused: string | null;
  onFocus: (id: string | null) => void;
  onPick: (id: string) => void;
  empty: string;
}

/**
 * The template list in 3D: every case side by side at true relative size, with the item's design on each, so one can be
 * found by its size and shape. Fronts or spines face the viewer; click to look at one, double-click to pick it.
 */
export function TemplateLibrary3D({ groups, all, item, current, focused, onFocus, onPick, empty }: Props) {
  const [facing, setFacing] = useState<Facing>('front');
  const [hovered, setHovered] = useState<string | null>(null);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const { placed, lengthMm } = useMemo(() => layoutRow(groups, facing), [groups, facing]);
  const tallest = Math.max(1, ...placed.map((p) => p.item.heightMm));
  const layoutKey = `${facing}|${placed.map((p) => p.item.entry.id).join(',')}`;
  const { textures, version } = useTextures(all, item);

  // Group names sit on the floor in front of their group.
  const groupMarks = useMemo(() => {
    const w = (p: Placed) => (facing === 'front' ? p.item.widthMm : p.item.depthMm);
    return groups.flatMap((g) => {
      const mine = placed.filter((p) => p.group === g.name);
      if (!g.name || !mine.length) return [];
      const [first, last] = [mine[0], mine[mine.length - 1]];
      return [{ name: g.name, xMm: (first.xMm - w(first) / 2 + last.xMm + w(last) / 2) / 2 }];
    });
  }, [groups, placed, facing]);

  return (
    <div className="compare-view" onPointerLeave={() => setHovered(null)}>
      <div className="seg compare-facing" role="group" aria-label="Facing">
        {(['front', 'spine'] as const).map((f) => (
          <button key={f} className={f === facing ? 'active' : ''} aria-pressed={f === facing} onClick={() => setFacing(f)}>
            {f === 'front' ? 'Fronts' : 'Spines'}
          </button>
        ))}
      </div>
      {placed.length === 0 ? (
        <p className="empty-hint">{empty}</p>
      ) : (
        <Canvas orthographic frameloop="demand" dpr={[1, 1.5]} gl={{ toneMapping: NeutralToneMapping }} camera={{ position: [0, 1.4, 10], near: 0.1, far: 100 }} onPointerMissed={() => onFocus(null)}>
          <Redraw on={`${version}|${layoutKey}|${focused}|${hovered}`} />
          <StudioLighting />
          <FitRow lengthMm={lengthMm} heightMm={tallest} controls={controls} layoutKey={layoutKey} />
          <Row placed={placed} textures={textures} facing={facing} focused={focused} hovered={hovered} current={current} onFocus={onFocus} onHover={setHovered} onPick={onPick} />
          {groupMarks.map((g) => (
            <Html key={g.name} position={[g.xMm * UNITS_PER_MM, -0.12, 0.3]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div className="compare-group">{g.name}</div>
            </Html>
          ))}
          {/* One still shadow for the whole row, drawn once per layout rather than every frame. */}
          <ContactShadows key={layoutKey} frames={1} position={[(lengthMm / 2) * UNITS_PER_MM, 0, 0]} scale={[(lengthMm + 400) * UNITS_PER_MM, 3]} opacity={0.45} blur={2} far={2} />
          <OrbitControls ref={controls} enableDamping={false} screenSpacePanning minZoom={10} maxZoom={2000} maxPolarAngle={Math.PI / 2} />
        </Canvas>
      )}
    </div>
  );
}
