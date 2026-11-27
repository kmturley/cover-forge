import { useEffect, useMemo } from 'react';
import { AddEquation, BoxGeometry, CustomBlending, ExtrudeGeometry, FrontSide, MeshPhysicalMaterial, MeshStandardMaterial, OneFactor, Path, Shape, ZeroFactor, type BufferGeometry, type Material, type Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CaseConstruction, PanelId, PlasticFinish, PlasticPart, TemplateConfig } from '../types/template';
import { createPanelStrip } from './PreviewGeometry';
import { createSleeveMaterial } from './PreviewMaterials';

type BoxSpec = Extract<TemplateConfig['preview'], { kind: 'box' }>;
type Piece = { geometry: BufferGeometry; position: [number, number, number]; rotation: [number, number, number] };

/** Polystyrene's refractive index. */
const PLASTIC_IOR = 1.57;

/**
 * How deep something behind a clear wall looks, mm: refraction makes it look closer, the wall's thickness over the plastic's
 * index (a 1 mm wall, about 0.64 mm). Clear plastic is drawn without refraction, so a printed piece against a wall is placed at
 * the depth it appears at, close under the surface as on a real case.
 */
const apparentDepth = (wallMm: number) => wallMm / PLASTIC_IOR;

/** Surface roughness for each finish: polished, lightly textured, textured. */
const ROUGHNESS: Record<PlasticFinish, number> = { glossy: 0.04, satin: 0.32, matte: 0.6 };

/**
 * Clear polystyrene, polished or textured: drawn as its reflections only, added over whatever is behind it, so the case and
 * everything in it show through at their own colour and the faces and rounded edges catch the light (most at a glancing angle,
 * as real plastic does). It writes no depth, so clear parts behind it still show.
 */
function createClearPlastic(part: PlasticPart): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: '#000000',
    roughness: ROUGHNESS[part.finish],
    // One surface reflection, about 4 % head on (polystyrene's), stronger at a glancing angle; every clear face adds its own.
    ior: PLASTIC_IOR,
    envMapIntensity: 0.7,
    transparent: true,
    // Adds its light to the colour behind it and leaves the alpha alone, so it also works over a transparent canvas (the
    // case picker's comparison, drawn over the page's own background).
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    depthWrite: false,
  });
}

/** A coloured plastic part, solid. */
function createSolidPlastic(part: PlasticPart): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: part.color, roughness: ROUGHNESS[part.finish], clearcoat: part.finish === 'glossy' ? 0.6 : 0, clearcoatRoughness: 0.1 });
}

/** The outer shell's plastic (the lid and base of a jewel case). */
export function createShellMaterial(part: PlasticPart): MeshPhysicalMaterial {
  return part.clear ? createClearPlastic(part) : createSolidPlastic(part);
}

/** A part inside the shell: the same clear plastic as the shell (so a clear tray is the black one's moulding in clear plastic), or a solid colour. */
export function createInnerPlasticMaterial(part: PlasticPart): MeshPhysicalMaterial {
  return part.clear ? createClearPlastic(part) : createSolidPlastic(part);
}

/** Draw order for clear parts inside the shell: before it, as they are behind it. */
const INNER_ORDER = -1;

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
  const zb = -D / 2 + apparentDepth(c.wallMm) + GAP;
  if (back) {
    both(createPanelStrip(t, 'back', 0, back.widthMm, [back.widthMm, back.heightMm]), [0, 0, zb], [0, Math.PI, 0], [0, 0, PAPER]);
    // Just outside the tray's ends, so card and tray never share a surface (which flickers).
    const xs = back.widthMm / 2 + GAP;
    // The flap on -x runs from the back (its edge on the sheet next to the back) towards the front; the one on +x the other way.
    if (left && leftId) both(createPanelStrip(t, leftId, 0, left.widthMm, [left.widthMm, left.heightMm]), [-xs, 0, zb + left.widthMm / 2], [0, -Math.PI / 2, 0], [PAPER, 0, 0]);
    if (right && rightId) both(createPanelStrip(t, rightId, 0, right.widthMm, [right.widthMm, right.heightMm]), [xs, 0, zb + right.widthMm / 2], [0, Math.PI / 2, 0], [-PAPER, 0, 0]);
  }
  // The booklet behind the lid, its edge just inside the opening side.
  if (front) {
    const x = W / 2 - c.bookletMarginMm - front.widthMm / 2;
    both(createPanelStrip(t, 'front', 0, front.widthMm, [front.widthMm, front.heightMm]), [x, 0, D / 2 - apparentDepth(c.wallMm) - GAP], [0, 0, 0], [0, 0, -PAPER]);
  }
  return { printed, backs };
}

/** Where the tray's features sit, mm, from a photo of an empty jewel case (black tray, supplied in review). */
const TRAY = {
  /**
   * The tray's end on the hinge side: a strip reaching this far in from the case's outside edge (14 of the case's 142 mm in a
   * photo of an empty clear case). The whole tray fills the base's inside height, a snug fit.
   */
  stripMm: 14,
  cornerMm: 1.5,
  /**
   * The rim of the disc well, centred on the main tray (beside the strip, never under it), as wide as it can be within the
   * main tray: its sides just touch the strip and the opening end, and its top and bottom run off the tray's edges.
   */
  disc: { wellMm: 61, rimMm: 0.8 },
  /** The hub: a raised round platform with a rosette of slots through it, the gaps between the teeth that grip the disc. */
  hub: { platformMm: 15, holeMm: 3.5, slotMm: 9.5, slotWidthMm: 1.1, slots: 16 },
  /** The lid's four booklet tabs: half-round clips on the top and bottom edges, this radius, centred this far from the middle. */
  tabMm: 6,
  tabsX: [-37, 46] as const,
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
  // A little inside the tray card's flaps at each end, so the card and the tray never share a surface.
  const inner = { x0: -W / 2 + c.sideWallMm + 0.3, x1: W / 2 - c.sideWallMm - 0.5, h: H - 2 * c.wallMm - 0.6 };
  const z = -D / 2 + apparentDepth(c.wallMm) + GAP + 0.1;
  const stripX1 = -W / 2 + TRAY.stripMm;
  // The well's rim just touches the strip; the hub is at its centre.
  const r1 = Math.min(TRAY.disc.wellMm, (inner.x1 - stripX1) / 2);
  const r0 = r1 - TRAY.disc.rimMm;
  const dx = stripX1 + r1 + 0.2;
  const main = roundedRect((stripX1 + inner.x1) / 2, 0, inner.x1 - stripX1, inner.h, TRAY.cornerMm);
  main.holes.push(rosette(dx, 0));
  const platform = new Shape();
  platform.absarc(dx, 0, TRAY.hub.platformMm, 0, Math.PI * 2, false);
  platform.holes.push(rosette(dx, 0));
  // The well's rim: the two sides of the ring that lie on the tray, where its top and bottom run off the tray's edges.
  const half = inner.h / 2 - 0.5;
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
    strip: { geometry: new BoxGeometry(stripX1 - inner.x0, inner.h, trayDepth), position: [(inner.x0 + stripX1) / 2, 0, z + trayDepth / 2] as [number, number, number] },
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
    const ridgeX = front ? W / 2 - c.bookletMarginMm - front.widthMm - 2 : -W / 2 + TRAY.stripMm + 2;
    // Half a disc, its flat side along the edge; the top ones turned to face down.
    const half = new Shape();
    half.moveTo(-TRAY.tabMm, 0);
    half.absarc(0, 0, TRAY.tabMm, Math.PI, Math.PI * 2, false);
    half.closePath();
    const tab = extrude(half, 0.8);
    const yTab = H / 2 - c.wallMm;
    return {
      ridge: { geometry: new BoxGeometry(1.2, H - 2 * c.wallMm - 2, 0.8), position: [ridgeX, 0, zIn] as [number, number, number] },
      tab,
      // Against the lid's inside face: the extrusion runs 0.8 mm forward from its back.
      tabs: TRAY.tabsX.flatMap((x) => [
        { position: [x, yTab, zIn - 0.4] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
        { position: [x, -yTab, zIn - 0.4] as [number, number, number], rotation: [0, 0, Math.PI] as [number, number, number] },
      ]),
    };
  }, [template, W, H, D, c]);

  const materials = useMemo(() => {
    // The hinge end of a coloured tray reads darker than its face, which catches the light.
    const strip = c.tray.clear ? c.tray : { ...c.tray, color: '#08090a' };
    return {
      shell: createShellMaterial(c.shell),
      tray: createInnerPlasticMaterial(c.tray),
      strip: createInnerPlasticMaterial(strip),
      // The well's rim and the hub are a shade darker than a coloured tray's face; in clear plastic they're the same plastic.
      moulding: createInnerPlasticMaterial(c.tray.clear ? c.tray : { ...c.tray, color: '#0c0d0f' }),
      // The lid's ridge and tabs are part of the lid: the shell's plastic.
      lid: createInnerPlasticMaterial(c.shell),
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
      <mesh geometry={tray.strip.geometry} material={materials.strip} position={tray.strip.position} renderOrder={INNER_ORDER} />
      <mesh geometry={tray.main} material={materials.tray} position={[0, 0, tray.z]} renderOrder={INNER_ORDER} />
      <mesh geometry={tray.platform} material={materials.moulding} position={[0, 0, tray.face]} renderOrder={INNER_ORDER} />
      <mesh geometry={tray.well} material={materials.moulding} position={[0, 0, tray.face]} renderOrder={INNER_ORDER} />
      <mesh geometry={lid.ridge.geometry} material={materials.lid} position={lid.ridge.position} renderOrder={INNER_ORDER} />
      {lid.tabs.map((p, i) => (
        <mesh key={`t${i}`} geometry={lid.tab} material={materials.lid} position={p.position} rotation={p.rotation} renderOrder={INNER_ORDER} />
      ))}
      <mesh geometry={shellGeometry} material={materials.shell} />
    </>
  );
}
