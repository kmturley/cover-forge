import { useEffect, useMemo, useState } from 'react';
import { AddEquation, CustomBlending, DoubleSide, FrontSide, MeshPhysicalMaterial, MeshStandardMaterial, OneFactor, ZeroFactor, type BufferGeometry, type Material, type Mesh, type Texture } from 'three';
import { useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import modelUrl from '../assets/models/jewel-case.glb?url';
import type { CaseConstruction, PanelId, PlasticFinish, PlasticPart, TemplateConfig } from '../types/template';
import { createPanelStrip } from './PreviewGeometry';
import { createSleeveMaterial } from './PreviewMaterials';

type BoxSpec = Extract<TemplateConfig['preview'], { kind: 'box' }>;
type Piece = { geometry: BufferGeometry; position: [number, number, number]; rotation: [number, number, number] };

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
    // A closed case stacks six of them front to back (both faces of the lid, the tray and the base), which reads hazy, so
    // each is turned down. (envMapIntensity would not do it: it only scales a material's own envMap, not the scene's.)
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
    // Both surfaces of a clear wall reflect; the model was also drawn double-sided.
    side: DoubleSide,
    flatShading: true,
  });
}

/** A coloured plastic part, solid. */
function createSolidPlastic(part: PlasticPart): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: part.color, roughness: ROUGHNESS[part.finish], clearcoat: part.finish === 'glossy' ? 0.6 : 0, clearcoatRoughness: 0.1, side: DoubleSide });
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
 * The jewel case's plastic parts, from "Compact disc and case" by effe on BlendSwap (CC0, blendswap.com/blend/1986), closed
 * and exported in the preview's frame, in mm, centred, the hinge on -x and the lid at +z. Measured from it:
 * - the base: 142 x 122.8 mm, its back wall 1 mm (z -5 to -4) and its end walls 1 mm (the opening end's inside at x 69);
 * - the lid: 142 x 125 x 10 mm, its front 1 mm (z 4 to 5) and its top and bottom walls 1 mm, wrapping over the base's edges;
 *   its front stops 12 mm in from the hinge edge (x -59), where the tray's hinge strip is the front;
 * - the tray: its floor 0.2 mm in front of the base's back wall (the tray card's place), its opening end 0.2 mm inside the
 *   base's end wall (the card's flap's place); its hinge strip a hollow channel, so the other flap sits inside it.
 */
const MODEL = {
  /** The inside of the opening end, where the tray card's flap sits between the tray and the base. */
  flapXMm: 68.9,
};

type ModelParts = { base: BufferGeometry; lid: BufferGeometry; tray: BufferGeometry };

let modelPromise: Promise<ModelParts> | undefined;

/** Loads the case's plastic parts once, shared by every jewel case drawn. */
function loadModel(): Promise<ModelParts> {
  modelPromise ??= new GLTFLoader().loadAsync(modelUrl).then((gltf) => {
    const parts: Partial<ModelParts> = {};
    gltf.scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      // The tray's second primitive is a flat plane carrying the moulded "compact disc" logo as a normal map: left out.
      if (mesh.name === 'base' || mesh.name === 'lid') parts[mesh.name] = mesh.geometry;
      else if (mesh.parent?.name === 'tray' && !parts.tray) parts.tray = mesh.geometry;
    });
    if (!parts.base || !parts.lid || !parts.tray) throw new Error('jewel case model is missing a part');
    return parts as ModelParts;
  });
  return modelPromise;
}

function useModel(): ModelParts | undefined {
  const [parts, setParts] = useState<ModelParts>();
  // A scene drawn on demand (the case comparison) redraws once the parts arrive.
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    if (parts) invalidate();
  }, [parts, invalidate]);
  useEffect(() => {
    let live = true;
    loadModel().then((p) => live && setParts(p), (e) => console.error(e));
    return () => {
      live = false;
    };
  }, []);
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
  const both = (geometry: BufferGeometry, position: [number, number, number], rotation: [number, number, number], inward: [number, number, number]) => {
    printed.push({ geometry, position, rotation });
    backs.push({ geometry, position: [position[0] + inward[0], position[1] + inward[1], position[2] + inward[2]], rotation: [rotation[0], rotation[1] + Math.PI, rotation[2]] });
  };
  // The tray card against the inside of the base's back wall, read from behind; its flaps folded forward round the tray's
  // ends: the opening end's in the gap between the tray and the base's end wall, the hinge end's inside the hinge strip.
  const zb = -D / 2 + c.wallMm + GAP;
  if (back) {
    const x0 = MODEL.flapXMm - back.widthMm / 2;
    both(createPanelStrip(t, 'back', 0, back.widthMm, [back.widthMm, back.heightMm]), [x0, 0, zb], [0, Math.PI, 0], [0, 0, PAPER]);
    // The flap on -x runs from the back (its edge on the sheet next to the back) towards the front; the one on +x the other way.
    if (left && leftId) both(createPanelStrip(t, leftId, 0, left.widthMm, [left.widthMm, left.heightMm]), [x0 - back.widthMm / 2, 0, zb + left.widthMm / 2], [0, -Math.PI / 2, 0], [PAPER, 0, 0]);
    if (right && rightId) both(createPanelStrip(t, rightId, 0, right.widthMm, [right.widthMm, right.heightMm]), [MODEL.flapXMm, 0, zb + right.widthMm / 2], [0, Math.PI / 2, 0], [-PAPER, 0, 0]);
  }
  // The booklet behind the lid's front, its edge just inside the opening side.
  if (front) {
    const x = W / 2 - c.bookletMarginMm - front.widthMm / 2;
    both(createPanelStrip(t, 'front', 0, front.widthMm, [front.widthMm, front.heightMm]), [x, 0, D / 2 - c.wallMm - GAP], [0, 0, 0], [0, 0, -PAPER]);
  }
  return { printed, backs };
}

/**
 * A CD jewel case: the real case's plastic parts (see MODEL), the lid and base in clear plastic and the disc tray in black or
 * clear, with the tray card behind the tray, its flaps round the tray's ends, and the booklet behind the lid. `showInserts`
 * hides the printed pieces, so the empty case can be checked against a real one first.
 */
export function JewelCase({ texture, template, spec, construction: c, showInserts }: { texture: Texture; template: TemplateConfig; spec: BoxSpec; construction: CaseConstruction; showInserts: boolean }) {
  const model = useModel();
  const pieces = useMemo(() => insertPieces(template, spec, c), [template, spec, c]);
  const materials = useMemo(
    () => ({
      shell: createShellMaterial(c.shell),
      tray: createInnerPlasticMaterial(c.tray),
      sleeve: createSleeveMaterial(texture, spec.glossy),
      paper: new MeshStandardMaterial({ color: '#f1efe9', roughness: 0.92, side: FrontSide }),
    }),
    [c, texture, spec.glossy],
  );
  useEffect(() => () => Object.values(materials).forEach((m: Material) => m.dispose()), [materials]);
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
      {model && (
        <>
          <mesh geometry={model.tray} material={materials.tray} renderOrder={INNER_ORDER} />
          <mesh geometry={model.base} material={materials.shell} />
          <mesh geometry={model.lid} material={materials.shell} />
        </>
      )}
    </>
  );
}
