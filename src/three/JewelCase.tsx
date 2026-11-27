import { useEffect, useMemo } from 'react';
import { BoxGeometry, ExtrudeGeometry, FrontSide, MeshPhysicalMaterial, MeshStandardMaterial, Path, Shape, type BufferGeometry, type Material, type Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CaseConstruction, PanelId, PlasticFinish, PlasticPart, TemplateConfig } from '../types/template';
import { createPanelStrip } from './PreviewGeometry';
import { createSleeveMaterial } from './PreviewMaterials';

type BoxSpec = Extract<TemplateConfig['preview'], { kind: 'box' }>;
type Piece = { geometry: BufferGeometry; position: [number, number, number]; rotation: [number, number, number] };

/** Surface roughness for each finish: polished, lightly textured, textured. */
const ROUGHNESS: Record<PlasticFinish, number> = { glossy: 0.04, satin: 0.32, matte: 0.6 };

/**
 * The outer shell's plastic. Clear polystyrene (the lid and base of a jewel case) is see-through, refracting a little: it
 * shows everything inside it, and catches reflections on its faces and edges. It doesn't write depth, so the see-through
 * parts inside it (drawn after it) still show.
 */
export function createShellMaterial(part: PlasticPart): MeshPhysicalMaterial {
  return part.clear
    ? new MeshPhysicalMaterial({ color: part.color, transmission: 1, roughness: ROUGHNESS[part.finish], ior: 1.57, thickness: 0.6, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, depthWrite: false })
    : new MeshPhysicalMaterial({ color: part.color, roughness: ROUGHNESS[part.finish], clearcoat: part.finish === 'glossy' ? 1 : 0, clearcoatRoughness: 0.05 });
}

/**
 * A part inside the shell. A see-through part there is drawn as a faint transparent layer rather than with transmission,
 * which can't see through a second transmitting surface: a clear tray reads as a pale film over the tray card behind it.
 */
export function createInnerPlasticMaterial(part: PlasticPart, opacity = 0.28): MeshPhysicalMaterial {
  return part.clear
    ? new MeshPhysicalMaterial({ color: part.color, transparent: true, opacity, roughness: ROUGHNESS[part.finish], depthWrite: false })
    : new MeshPhysicalMaterial({ color: part.color, roughness: ROUGHNESS[part.finish], clearcoat: part.finish === 'glossy' ? 0.6 : 0, clearcoatRoughness: 0.1 });
}

/** How far a printed piece sits in from the plastic wall it lies against, mm, and how far its paper back is behind it. */
const GAP = 0.06;
const PAPER = 0.04;

/** The printed pieces of a jewel case, each placed where it sits inside the plastic, with a plain paper back facing the other way. */
function insertPieces(t: TemplateConfig, spec: BoxSpec, c: CaseConstruction): { printed: Piece[]; backs: Piece[] } {
  const [W, D] = [spec.widthMm, spec.depthMm];
  const panel = (id: PanelId | undefined) => (id ? t.panels.find((p) => p.id === id) : undefined);
  const back = panel('back');
  const leftId = spec.faces['-x'];
  const rightId = spec.faces['+x'];
  const left = panel(leftId);
  const right = panel(rightId);
  const front = panel('front');
  const printed: Piece[] = [];
  const backs: Piece[] = [];
  const both = (geometry: BufferGeometry, position: [number, number, number], rotation: [number, number, number], inward: [number, number, number]) => {
    printed.push({ geometry, position, rotation });
    backs.push({ geometry, position: [position[0] + inward[0], position[1] + inward[1], position[2] + inward[2]], rotation: [rotation[0], rotation[1] + Math.PI, rotation[2]] });
  };
  // The tray card against the inside of the base's back wall, read from behind; its flaps folded forward round the tray's ends.
  const zb = -D / 2 + c.wallMm + GAP;
  if (back) {
    both(createPanelStrip(t, 'back', 0, back.widthMm, [back.widthMm, back.heightMm]), [0, 0, zb], [0, Math.PI, 0], [0, 0, PAPER]);
    const xs = back.widthMm / 2;
    // The flap on -x runs from the back (its edge on the sheet next to the back) towards the front; the one on +x the other way.
    if (left && leftId) both(createPanelStrip(t, leftId, 0, left.widthMm, [left.widthMm, left.heightMm]), [-xs, 0, zb + left.widthMm / 2], [0, -Math.PI / 2, 0], [PAPER, 0, 0]);
    if (right && rightId) both(createPanelStrip(t, rightId, 0, right.widthMm, [right.widthMm, right.heightMm]), [xs, 0, zb + right.widthMm / 2], [0, Math.PI / 2, 0], [-PAPER, 0, 0]);
  }
  // The booklet behind the lid, its edge just inside the opening side.
  if (front) {
    const x = W / 2 - c.bookletMarginMm - front.widthMm / 2;
    both(createPanelStrip(t, 'front', 0, front.widthMm, [front.widthMm, front.heightMm]), [x, 0, D / 2 - c.wallMm - GAP], [0, 0, 0], [0, 0, -PAPER]);
  }
  return { printed, backs };
}

/** Where the tray's features sit, mm, from a photo of an empty jewel case (black tray, supplied in review). */
const TRAY = {
  /** The tray's end on the hinge side: a strip the full height of the inside, this wide. */
  stripMm: 14,
  /** The main tray's height: a little shorter than the inside, leaving a narrow clear band above and below it for the lid's tabs. */
  mainHeightMm: 115,
  cornerMm: 4,
  /** The disc's centre, a little to the opening side of the case's middle, and the rim of its well (cut off by the tray's top and bottom edges). */
  disc: { x: 4, wellMm: [60.2, 61] as const },
  /** The hub: a raised round platform with a rosette of slots through it, the gaps between the teeth that grip the disc. */
  hub: { platformMm: 13, holeMm: 2.6, slotMm: 7, slotWidthMm: 1.6, slots: 8 },
  /** The lid's four booklet tabs, at the top and bottom edges, at these distances from the middle. */
  tabsX: [-14, 44] as const,
};

/** The hub's rosette: a small round hole with slots radiating from it, as one outline (a hole in the tray and the platform). */
function rosette(cx: number, cy: number): Path {
  const { holeMm: r0, slotMm: r1, slotWidthMm: sw, slots } = TRAY.hub;
  const path = new Path();
  for (let k = 0; k < slots; k++) {
    const a = (k / slots) * Math.PI * 2;
    const [i0, o] = [Math.asin(sw / 2 / r0), Math.asin(sw / 2 / r1)];
    const pts = [
      [r0, a - i0],
      [r1, a - o],
      [r1, a + o],
      [r0, a + i0],
    ];
    for (const [j, [r, t]] of pts.entries()) {
      const [x, y] = [cx + r * Math.cos(t), cy + r * Math.sin(t)];
      if (k === 0 && j === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    // Round the centre hole between this slot and the next.
    const next = ((k + 1) / slots) * Math.PI * 2;
    path.absarc(cx, cy, r0, a + i0, next - i0, false);
  }
  path.closePath();
  return path;
}

/** A rounded rectangle outline, centred at (cx, cy). */
function roundedRect(cx: number, cy: number, w: number, h: number, r: number): Shape {
  const [x0, y0, x1, y1] = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  const s = new Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, (3 * Math.PI) / 2, false);
  return s;
}

const extrude = (shape: Shape | Shape[], depth: number) => new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });

/**
 * The disc tray's mouldings, in the case's frame (z is the tray's back face): the strip at the hinge end, the main tray with
 * the hub's rosette cut through it, the raised hub platform, and the rim of the disc well.
 */
function trayParts(W: number, H: number, D: number, c: CaseConstruction, trayDepth: number) {
  const inner = { x0: -W / 2 + c.sideWallMm, x1: W / 2 - c.sideWallMm - 0.5, h: H - 2 * c.wallMm - 1 };
  const z = -D / 2 + c.wallMm + GAP + 0.1;
  const stripX1 = inner.x0 + TRAY.stripMm;
  const { x: dx } = TRAY.disc;
  const main = roundedRect((stripX1 + inner.x1) / 2, 0, inner.x1 - stripX1, TRAY.mainHeightMm, TRAY.cornerMm);
  main.holes.push(rosette(dx, 0));
  const platform = new Shape();
  platform.absarc(dx, 0, TRAY.hub.platformMm, 0, Math.PI * 2, false);
  platform.holes.push(rosette(dx, 0));
  // The well's rim: the two sides of the ring that lie on the tray, where its top and bottom run off the tray's edges.
  const [r0, r1] = TRAY.disc.wellMm;
  const half = TRAY.mainHeightMm / 2 - 0.5;
  const wellArcs = [0, Math.PI].map((mid) => {
    const [a1, a0] = [Math.asin(Math.min(1, half / r1)), Math.asin(Math.min(1, half / r0))];
    const s = new Shape();
    s.absarc(dx, 0, r1, mid - a1, mid + a1, false);
    s.absarc(dx, 0, r0, mid + a0, mid - a0, true);
    s.closePath();
    return s;
  });
  return {
    z,
    face: z + trayDepth,
    strip: { geometry: new BoxGeometry(TRAY.stripMm, inner.h, trayDepth), position: [inner.x0 + TRAY.stripMm / 2, 0, z + trayDepth / 2] as [number, number, number] },
    main: extrude(main, trayDepth),
    platform: extrude(platform, 0.6),
    well: extrude(wellArcs, 0.4),
  };
}

/**
 * A CD jewel case modelled from its parts: the clear shell (lid and base), the disc tray inside the base (black or clear),
 * the tray card behind the tray with its flaps round the tray's ends, and the booklet behind the lid. `showInserts` hides
 * the printed pieces, so the empty case can be checked against a real one first.
 */
export function JewelCase({ texture, template, spec, construction: c, showInserts }: { texture: Texture; template: TemplateConfig; spec: BoxSpec; construction: CaseConstruction; showInserts: boolean }) {
  const [W, H, D] = [spec.widthMm, spec.heightMm, spec.depthMm];
  const shellGeometry = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, spec.radiusMm), [W, H, D, spec.radiusMm]);
  const flap = template.panels.find((p) => p.id === spec.faces['-x']);
  // The tray: as deep as the tray card's flaps, from the card forward.
  const tray = useMemo(() => trayParts(W, H, D, c, (flap?.widthMm ?? (D - 2 * c.wallMm) / 2) - 0.2), [W, H, D, c, flap]);
  const pieces = useMemo(() => insertPieces(template, spec, c), [template, spec, c]);
  // The lid's details: the ridge beside the booklet's spine-side edge, and the four tabs that hold the booklet.
  const lid = useMemo(() => {
    const front = template.panels.find((p) => p.id === 'front');
    const zIn = D / 2 - c.wallMm - 0.4;
    const ridgeX = front ? W / 2 - c.bookletMarginMm - front.widthMm - 2 : -W / 2 + c.sideWallMm + TRAY.stripMm + 2;
    const tab = new BoxGeometry(9, 3, 0.8);
    const yTab = H / 2 - c.wallMm - 1.5;
    return {
      ridge: { geometry: new BoxGeometry(1.2, H - 2 * c.wallMm - 2, 0.8), position: [ridgeX, 0, zIn] as [number, number, number] },
      tab,
      tabs: TRAY.tabsX.flatMap((x) => [[x, yTab, zIn] as [number, number, number], [x, -yTab, zIn] as [number, number, number]]),
    };
  }, [template, W, H, D, c]);

  const materials = useMemo(() => {
    // The hinge end of a coloured tray reads darker than its face, which catches the light.
    const strip = c.tray.clear ? c.tray : { ...c.tray, color: '#08090a' };
    return {
      shell: createShellMaterial(c.shell),
      tray: createInnerPlasticMaterial(c.tray),
      strip: createInnerPlasticMaterial(strip),
      // The moulded details read more strongly than the tray's flat face, as edges of clear plastic do.
      moulding: createInnerPlasticMaterial(c.tray.clear ? c.tray : { ...c.tray, color: '#0c0d0f' }, 0.55),
      lid: createInnerPlasticMaterial({ ...c.shell, color: '#9aa2ab' }, 0.45),
      sleeve: createSleeveMaterial(texture, spec.glossy),
      paper: new MeshStandardMaterial({ color: '#f1efe9', roughness: 0.92, side: FrontSide }),
    };
  }, [c, texture, spec.glossy]);
  useEffect(() => () => Object.values(materials).forEach((m: Material) => m.dispose()), [materials]);
  useEffect(() => () => shellGeometry.dispose(), [shellGeometry]);
  useEffect(() => () => [tray.strip.geometry, tray.main, tray.platform, tray.well].forEach((g) => g.dispose()), [tray]);
  useEffect(() => () => [lid.ridge.geometry, lid.tab].forEach((g) => g.dispose()), [lid]);
  useEffect(() => () => pieces.printed.forEach((p) => p.geometry.dispose()), [pieces]);

  return (
    <>
      {showInserts && (
        <>
          {pieces.printed.map((p, i) => (
            <mesh key={`p${i}`} geometry={p.geometry} material={materials.sleeve} position={p.position} rotation={p.rotation} />
          ))}
          {pieces.backs.map((p, i) => (
            <mesh key={`b${i}`} geometry={p.geometry} material={materials.paper} position={p.position} rotation={p.rotation} />
          ))}
        </>
      )}
      <mesh geometry={tray.strip.geometry} material={materials.strip} position={tray.strip.position} />
      <mesh geometry={tray.main} material={materials.tray} position={[0, 0, tray.z]} />
      <mesh geometry={tray.platform} material={materials.moulding} position={[0, 0, tray.face]} />
      <mesh geometry={tray.well} material={materials.moulding} position={[0, 0, tray.face]} />
      <mesh geometry={lid.ridge.geometry} material={materials.lid} position={lid.ridge.position} />
      {lid.tabs.map((p, i) => (
        <mesh key={`t${i}`} geometry={lid.tab} material={materials.lid} position={p} />
      ))}
      <mesh geometry={shellGeometry} material={materials.shell} />
    </>
  );
}
