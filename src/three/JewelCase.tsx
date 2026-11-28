import { useEffect, useMemo } from 'react';
import { AddEquation, CustomBlending, ExtrudeGeometry, FrontSide, MeshPhysicalMaterial, MeshStandardMaterial, OneFactor, Path, Shape, ZeroFactor, type BufferGeometry, type Material, type Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { JEWEL_CASE } from '../templates/cases';
import type { CaseConstruction, PanelId, PlasticFinish, PlasticPart, TemplateConfig } from '../types/template';
import { createPanelStrip } from './PreviewGeometry';
import { createSleeveMaterial } from './PreviewMaterials';

type BoxSpec = Extract<TemplateConfig['preview'], { kind: 'box' }>;
type Vec3 = [number, number, number];
type Piece = { geometry: BufferGeometry; position: Vec3; rotation: Vec3 };
/** A moulded part: its geometry, where it sits, and which plastic it is. */
type Part = { geometry: BufferGeometry; position: Vec3; rotation?: Vec3; material: 'shell' | 'tray' | 'strip' | 'moulding'; inner?: boolean };

/** Polystyrene's refractive index. */
const PLASTIC_IOR = 1.57;

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
    // A closed case stacks several front to back (both faces of the lid, the tray and the base), which reads hazy, so each
    // is turned down. (envMapIntensity would not do it: it only scales a material's own envMap, not the scene's.)
    ior: PLASTIC_IOR,
    specularIntensity: 0.5,
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

/**
 * The case's plastic parts, mm, from cases.ts (measured from a real case). Drawn simplified: flat plates with softened
 * edges rather than the real mouldings.
 */
const CASE = {
  ...JEWEL_CASE.parts,
  /** How much the plates' edges are softened. */
  edgeMm: 0.4,
};

/** The hub's rosette: a small round hole with slots radiating from it, as one outline (a hole through the crown). */
function rosette(cx: number, cy: number): Path {
  const { holeMm: r0, crownMm: r1, slotWidthMm: sw, slots } = CASE.tray.hub;
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

const extrude = (shape: Shape | Shape[], depth: number) => new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });

/** A flat plate with softened edges, from its two corners (x0, y0, z0) and (x1, y1, z1). */
function plate(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: Part['material'], inner = false): Part {
  const [w, h, d] = [x1 - x0, y1 - y0, z1 - z0];
  const r = Math.min(CASE.edgeMm, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  return { geometry: new RoundedBoxGeometry(w, h, d, 2, r), position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], material, inner };
}

/** The case's plastic parts, in the case's frame. */
function caseParts(W: number, H: number, D: number, c: CaseConstruction): Part[] {
  const t = CASE.tray;
  const wall = c.wallMm;
  const [xh, xo] = [-W / 2, W / 2];
  const zBack = -D / 2 + wall;
  const hb = CASE.base.heightMm / 2;
  const lidFrontX = xh + CASE.lid.frontFromHingeMm;
  const openingWallX = xo - CASE.base.openingWallInsetMm;
  const parts: Part[] = [
    // The lid: its front, and its top and bottom walls, the full depth of the case, over the base's edges.
    plate(lidFrontX, xo, -H / 2, H / 2, D / 2 - wall, D / 2, 'shell'),
    plate(xh, xo, H / 2 - wall, H / 2, -D / 2, D / 2, 'shell'),
    plate(xh, xo, -H / 2, -H / 2 + wall, -D / 2, D / 2, 'shell'),
    // The base: its back, and its end walls (the opening side's set in, under the lid's edge).
    plate(xh, xo, -hb, hb, -D / 2, zBack, 'shell'),
    plate(xh, xh + wall, -hb, hb, zBack, D / 2 - wall, 'shell'),
    plate(openingWallX - wall, openingWallX, -hb, hb, zBack, D / 2 - wall, 'shell'),
  ];

  // The tray, inside the base: its floor just in front of the back wall (the tray card behind it), filling the inside height.
  const th = hb - wall - 0.1;
  const zFloor = zBack + t.floorGapMm;
  const zFloorTop = zFloor + t.floorMm;
  const zDeck = zBack + t.deckMm;
  const trayX1 = openingWallX - wall - t.endGapMm;
  const stripInner = lidFrontX - t.strip.wallMm;
  // The hinge strip: a channel open to the outside, its front flush with the lid's, its inner wall from the floor up.
  const zFront = D / 2 - t.strip.frontMm;
  parts.push(plate(xh + 0.1, lidFrontX, -hb, hb, zFront, D / 2 - t.strip.ribMm, 'strip', true));
  parts.push(plate(stripInner, lidFrontX, -th, th, zFloor, zFront, 'strip', true));
  // Ribs along the strip's front, the grip on a real case's hinge.
  const ribSpan = lidFrontX - xh - 1.2;
  for (let k = 0; k < t.strip.ribs; k++) {
    const x = xh + 0.6 + ((k + 0.5) / t.strip.ribs) * ribSpan;
    parts.push(plate(x - t.strip.ribWidthMm / 2, x + t.strip.ribWidthMm / 2, -hb + 1, hb - 1, D / 2 - t.strip.ribMm - 0.2, D / 2, 'strip', true));
  }
  // The floor, from the strip's inner wall to the opening end, with the hub's rosette cut through it.
  const floor = new Shape();
  floor.moveTo(lidFrontX, -th);
  floor.lineTo(trayX1, -th);
  floor.lineTo(trayX1, th);
  floor.lineTo(lidFrontX, th);
  floor.closePath();
  const hx = t.well.xMm;
  floor.holes.push(rosette(hx, 0));
  parts.push({ geometry: extrude(floor, t.floorMm), position: [0, 0, zFloor], material: 'tray', inner: true });
  // The deck round the well, either side of it: the well runs off the tray's top and bottom edges.
  const r1 = t.well.radiusMm;
  const half = Math.sqrt(Math.max(0, r1 * r1 - th * th));
  const a = Math.atan2(th, -half);
  const deckDepth = t.floorMm;
  const left = new Shape();
  left.moveTo(lidFrontX, th);
  left.lineTo(hx - half, th);
  left.absarc(hx, 0, r1, a, 2 * Math.PI - a, false);
  left.lineTo(lidFrontX, -th);
  left.closePath();
  const right = new Shape();
  right.moveTo(trayX1, -th);
  right.lineTo(hx + half, -th);
  right.absarc(hx, 0, r1, -(Math.PI - a), Math.PI - a, false);
  right.lineTo(trayX1, th);
  right.closePath();
  parts.push({ geometry: extrude([left, right], deckDepth), position: [0, 0, zDeck - deckDepth], material: 'tray', inner: true });
  // The deck's end walls, down to the floor, and the well's rim: the two sides of a ring that lie on the tray.
  parts.push(plate(trayX1 - 0.6, trayX1, -th, th, zFloorTop, zDeck, 'tray', true));
  const r0 = r1 - t.well.rimMm;
  const wellArcs = [0, Math.PI].map((mid) => {
    const [a1, a0] = [Math.asin(Math.min(1, th / r1)), Math.asin(Math.min(1, th / r0))];
    const s = new Shape();
    s.absarc(hx, 0, r1, mid - a1, mid + a1, false);
    s.absarc(hx, 0, r0, mid + a0, mid - a0, true);
    s.closePath();
    return s;
  });
  parts.push({ geometry: extrude(wellArcs, zDeck - zFloorTop), position: [0, 0, zFloorTop], material: 'moulding', inner: true });
  // The hub: a low platform, and the crown of teeth on it.
  const { platformMm, platformHeightMm, crownMm, crownHeightMm } = t.hub;
  const platform = new Shape();
  platform.absarc(hx, 0, platformMm, 0, Math.PI * 2, false);
  const ring = new Path();
  ring.absarc(hx, 0, crownMm, 0, Math.PI * 2, true);
  platform.holes.push(ring);
  parts.push({ geometry: extrude(platform, platformHeightMm), position: [0, 0, zFloorTop], material: 'moulding', inner: true });
  const crown = new Shape();
  crown.absarc(hx, 0, crownMm, 0, Math.PI * 2, false);
  crown.holes.push(rosette(hx, 0));
  parts.push({ geometry: extrude(crown, crownHeightMm), position: [0, 0, zFloorTop], material: 'moulding', inner: true });

  // The lid's booklet tabs: half discs, flat side along the lid's top and bottom walls, against the inside of its front.
  const tab = new Shape();
  tab.moveTo(-CASE.tabs.radiusMm, 0);
  tab.absarc(0, 0, CASE.tabs.radiusMm, Math.PI, Math.PI * 2, false);
  tab.closePath();
  const yTab = H / 2 - wall;
  const zTab = D / 2 - wall - CASE.tabs.depthMm;
  for (const x of CASE.tabs.xMm) {
    // Each tab its own geometry, so every part can be disposed on its own.
    parts.push({ geometry: extrude(tab, CASE.tabs.depthMm), position: [x, yTab, zTab], material: 'shell', inner: true });
    parts.push({ geometry: extrude(tab, CASE.tabs.depthMm), position: [x, -yTab, zTab], rotation: [0, 0, Math.PI], material: 'shell', inner: true });
  }
  return parts;
}

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
  const both = (geometry: BufferGeometry, position: Vec3, rotation: Vec3, inward: Vec3) => {
    printed.push({ geometry, position, rotation });
    backs.push({ geometry, position: [position[0] + inward[0], position[1] + inward[1], position[2] + inward[2]], rotation: [rotation[0], rotation[1] + Math.PI, rotation[2]] });
  };
  // The tray card against the inside of the base's back wall, read from behind; its flaps folded forward round the tray's
  // ends: the opening end's between the tray and the base's end wall, the hinge end's inside the hinge strip.
  const zb = -D / 2 + c.wallMm + GAP;
  if (back) {
    const flapX = W / 2 - CASE.base.openingWallInsetMm - c.wallMm - CASE.tray.endGapMm / 2;
    const x0 = flapX - back.widthMm / 2;
    both(createPanelStrip(t, 'back', 0, back.widthMm, [back.widthMm, back.heightMm]), [x0, 0, zb], [0, Math.PI, 0], [0, 0, PAPER]);
    // The flap on -x runs from the back (its edge on the sheet next to the back) towards the front; the one on +x the other way.
    if (left && leftId) both(createPanelStrip(t, leftId, 0, left.widthMm, [left.widthMm, left.heightMm]), [x0 - back.widthMm / 2, 0, zb + left.widthMm / 2], [0, -Math.PI / 2, 0], [PAPER, 0, 0]);
    if (right && rightId) both(createPanelStrip(t, rightId, 0, right.widthMm, [right.widthMm, right.heightMm]), [flapX, 0, zb + right.widthMm / 2], [0, Math.PI / 2, 0], [-PAPER, 0, 0]);
  }
  // The booklet behind the lid's front, its edge just inside the opening side.
  if (front) {
    const x = W / 2 - c.bookletMarginMm - front.widthMm / 2;
    both(createPanelStrip(t, 'front', 0, front.widthMm, [front.widthMm, front.heightMm]), [x, 0, D / 2 - c.wallMm - GAP], [0, 0, 0], [0, 0, -PAPER]);
  }
  return { printed, backs };
}

/**
 * A CD jewel case modelled from its parts (see CASE): the clear lid and base, the disc tray inside the base (black or clear)
 * with its hinge strip forming the front by the hinge, the tray card behind the tray with its flaps round the tray's ends, and
 * the booklet behind the lid. `showInserts` hides the printed pieces, so the empty case can be checked against a real one.
 */
export function JewelCase({ texture, template, spec, construction: c, showInserts }: { texture: Texture; template: TemplateConfig; spec: BoxSpec; construction: CaseConstruction; showInserts: boolean }) {
  const [W, H, D] = [spec.widthMm, spec.heightMm, spec.depthMm];
  const parts = useMemo(() => caseParts(W, H, D, c), [W, H, D, c]);
  const pieces = useMemo(() => insertPieces(template, spec, c), [template, spec, c]);
  const materials = useMemo(
    () => ({
      shell: createShellMaterial(c.shell),
      tray: createInnerPlasticMaterial(c.tray),
      // The hinge strip of a coloured tray reads darker than its face, which catches the light.
      strip: createInnerPlasticMaterial(c.tray.clear ? c.tray : { ...c.tray, color: '#08090a' }),
      // The well's rim and the hub are a shade darker than a coloured tray's face; in clear plastic they're the same plastic.
      moulding: createInnerPlasticMaterial(c.tray.clear ? c.tray : { ...c.tray, color: '#0c0d0f' }),
      sleeve: createSleeveMaterial(texture, spec.glossy),
      paper: new MeshStandardMaterial({ color: '#f1efe9', roughness: 0.92, side: FrontSide }),
    }),
    [c, texture, spec.glossy],
  );
  useEffect(() => () => Object.values(materials).forEach((m: Material) => m.dispose()), [materials]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
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
      {parts.map((p, i) => (
        <mesh key={`c${i}`} geometry={p.geometry} material={materials[p.material]} position={p.position} rotation={p.rotation} renderOrder={p.inner ? INNER_ORDER : 0} />
      ))}
    </>
  );
}
