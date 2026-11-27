import { useEffect, useMemo, useRef, type ElementRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { BackSide, CylinderGeometry, MeshStandardMaterial, PlaneGeometry, type BufferGeometry, type Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { PanelId, TemplateConfig } from '../types/template';
import { FACE_ORDER, createBodyGeometry, createCornerArc, createPanelStrip, createWrappedPanelGeometry, createLabelGeometry, createLabelSliceGeometry, createSlabBodyGeometry, createSlabFaceGeometry, bodyPrintedFaces, insetFaces, insetPlacement, labelWrap, modelSizeMm, previewScale, SLEEVE_WALL_MM } from './PreviewGeometry';
import { Measurements3D } from './Measurements3D';
import { createBodyMaterial, createSleeveMaterial } from './PreviewMaterials';

/** Three-quarter view showing the left edge (-X), top edge (+Y) and front (+Z). Tune via the console log. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [-2.2, 1.1, 2.6];

type Piece = { geometry: BufferGeometry; position: [number, number, number]; rotation: [number, number, number] };

/**
 * A tray card folded round a case, drawn as one continuous wrap the height of the flat of the case's sides (stretched a little
 * where the card is shorter, as on the MiniDisc album case: 101.5 mm to the 105 mm booklet), so its top and bottom line up with
 * the front's and stop where the rounded top and bottom edges start: the flat of the back, each rounded back
 * corner (half the corner's arc of the back, half of the flap), the flat of each side, and half of each front corner (the
 * flap's end). Every arc shows exactly its own length of artwork, so nothing is stretched and the design runs on round the
 * folds. Seen from behind, the back's left edge on the sheet is on the case's +x side.
 */
function trayWrap(t: TemplateConfig, spec: Extract<TemplateConfig['preview'], { kind: 'box' }>): Piece[] {
  const back = t.panels.find((p) => p.id === 'back');
  const leftId = spec.faces['-x'];
  const rightId = spec.faces['+x'];
  const left = t.panels.find((p) => p.id === leftId);
  const right = t.panels.find((p) => p.id === rightId);
  if (!back || !left || !right || !leftId || !rightId) return [];
  const { widthMm: w, depthMm: d, radiusMm: r } = spec;
  const arc = Math.PI / 4;
  // The length of artwork on half a corner's arc.
  const e = r * arc;
  const h = spec.heightMm - 2 * r;
  const off = 0.05;
  const R = r + off;
  const [cx, cz] = [w / 2 - r, d / 2 - r];
  const [B, L, Rt] = [back.widthMm, left.widthMm, right.widthMm];
  const corner = (id: PanelId, from: number, to: number, x: number, z: number, theta: number): Piece => ({ geometry: createCornerArc(t, id, from, to, R, h, theta, arc), position: [x, 0, z], rotation: [0, 0, 0] });
  // Angles as three's CylinderGeometry: 0 faces +z, π/2 +x, π -z, 3π/2 -x; each arc's artwork runs with the angle.
  return [
    // The back, seen from behind: turned to face -z, so the sheet's left edge is at +x.
    { geometry: createPanelStrip(t, 'back', e, B - e, [w - 2 * r, h]), position: [0, 0, -d / 2 - off], rotation: [0, Math.PI, 0] },
    // The flap on -x runs from the back edge (its left on the sheet) towards the front; the one on +x the other way.
    { geometry: createPanelStrip(t, leftId, e, L - e, [d - 2 * r, h]), position: [-w / 2 - off, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { geometry: createPanelStrip(t, rightId, e, Rt - e, [d - 2 * r, h]), position: [w / 2 + off, 0, 0], rotation: [0, Math.PI / 2, 0] },
    // Back-left corner: from the back (facing -z) round to the -x flap; then the flap's end round the front-left corner.
    corner('back', B - e, B, -cx, -cz, Math.PI),
    corner(leftId, 0, e, -cx, -cz, Math.PI + arc),
    corner(leftId, L - e, L, -cx, cz, (3 * Math.PI) / 2),
    // Front-right corner: the +x flap's start; then the back-right corner, from the flap round to the back.
    corner(rightId, 0, e, cx, cz, arc),
    corner(rightId, Rt - e, Rt, cx, -cz, Math.PI / 2),
    corner('back', 0, e, cx, -cz, Math.PI / 2 + arc),
  ];
}

/** How far in from a box's edges its tray and hinge stop: past the clear rim, and clear of the rounded edges. */
const trayInset = (spec: Extract<TemplateConfig['preview'], { kind: 'box' }>) => Math.max(spec.tray?.rimMm ?? 0.4, spec.radiusMm);

/** How thick the hinge strip on a case's front is drawn, mm. */
const HINGE_DEPTH_MM = 0.6;

const fmt = (v: { x: number; y: number; z: number }) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`;

/**
 * The 3D model of a template: a case/box, or a card/disk with an optional separate label. Built in mm; `scale` turns mm
 * into scene units (by default the preview's own, so any case fills the view; a comparison passes one scale for all).
 */
export function Model({ texture, template, scale }: { texture: Texture; template: TemplateConfig; scale?: number }) {
  const spec = template.preview;
  const geometry = useMemo(() => (spec.kind === 'slab' ? createSlabBodyGeometry(spec) : createBodyGeometry(template, spec)), [template, spec]);

  // Everything printed that isn't a face of the body: partial-face decals, or a disk label (possibly wrapping round).
  const pieces = useMemo(() => {
    const out: { geometry: BufferGeometry; position: [number, number, number]; rotation: [number, number, number] }[] = [];
    if (spec.kind === 'box') {
      if (spec.wrapTray) out.push(...trayWrap(template, spec));
      // Pieces on part of a face, at their own size; where one reaches the end of the face's flat it wraps round the rounded edge.
      else for (const { face, panel } of insetFaces(template, spec)) out.push({ geometry: createWrappedPanelGeometry(template, panel, spec.depthMm, spec.heightMm, spec.radiusMm), ...insetPlacement(spec, face) });
      for (const d of spec.decals ?? []) {
        const panel = template.panels.find((p) => p.id === d.panel);
        if (!panel) continue;
        const m = d.marginMm ?? 0;
        const x = d.align === 'min-x' ? -spec.widthMm / 2 + panel.widthMm / 2 + m : spec.widthMm / 2 - panel.widthMm / 2 - m;
        // A hair off the surface (no z-fighting); on the back face it is turned to face -z, seen from behind, so its x is mirrored.
        const front = d.face === '+z';
        const geometry = createWrappedPanelGeometry(template, d.panel, spec.widthMm, spec.heightMm, spec.radiusMm, front ? x : -x);
        out.push({ geometry, position: [0, 0, (front ? 1 : -1) * (spec.depthMm / 2 + 0.05)], rotation: [0, front ? 0 : Math.PI, 0] });
      }
    } else if (spec.fullFace) {
      // A card or sticker: the artwork follows the body's own outline, so rounded corners show. Just proud of the surface.
      const off = spec.bodyDepthMm / 2 + 0.03;
      out.push({ geometry: createSlabFaceGeometry(template, spec, spec.panel), position: [0, 0, off], rotation: [0, 0, 0] });
      if (spec.backPanel) out.push({ geometry: createSlabFaceGeometry(template, spec, spec.backPanel), position: [0, 0, -off], rotation: [0, Math.PI, 0] });
    } else {
      const panel = template.panels.find((p) => p.id === spec.panel);
      if (panel && spec.labelTopMm !== undefined) {
        const H = spec.bodyHeightMm;
        const D = spec.bodyDepthMm;
        const { frontMm, edgeMm, backMm } = labelWrap(H, D, panel.heightMm, spec.labelTopMm);
        const top = H / 2 - spec.labelTopMm;
        out.push({ geometry: createLabelSliceGeometry(template, spec.panel, 0, frontMm), position: [0, top - frontMm / 2, D / 2 + 0.05], rotation: [0, 0, 0] });
        if (edgeMm > 0) out.push({ geometry: createLabelSliceGeometry(template, spec.panel, frontMm, frontMm + edgeMm), position: [0, -H / 2 - 0.05, 0], rotation: [Math.PI / 2, 0, 0] });
        // Turned over the bottom edge, so the artwork is upside down when the disk is flipped upright.
        if (backMm > 0) out.push({ geometry: createLabelSliceGeometry(template, spec.panel, frontMm + edgeMm, frontMm + edgeMm + backMm), position: [0, -H / 2 + backMm / 2, -D / 2 - 0.05], rotation: [Math.PI, 0, 0] });
      } else if (panel) {
        out.push({ geometry: createLabelGeometry(template, spec.panel), position: [0, 0, spec.bodyDepthMm / 2 + 0.05], rotation: [0, 0, 0] });
      }
    }
    return out;
  }, [template, spec]);

  const { sleeve, body } = useMemo(
    () => ({
      sleeve: createSleeveMaterial(texture, spec.kind === 'box' ? spec.glossy : true),
      body: createBodyMaterial(spec.kind === 'box' ? spec.casing : spec.body),
    }),
    [texture, spec],
  );
  // One material per face: the printed sleeve where a panel is mapped, otherwise the body.
  const materials = useMemo(() => {
    if (spec.kind === 'slab') return body; // slabs are one solid body; their printed faces are separate pieces
    const printed = bodyPrintedFaces(template, spec);
    return FACE_ORDER.map((f) => (printed[f] ? sleeve : body));
  }, [template, spec, sleeve, body]);
  const metal = useMemo(() => new MeshStandardMaterial({ color: '#b9bcc2', metalness: 0.9, roughness: 0.35 }), []);
  // The inside of an open-ended sleeve: a slightly smaller copy of the shell, seen from behind through the open ends.
  const hollow = spec.kind === 'box' && spec.hollow ? spec : undefined;
  const inner = useMemo(() => (hollow ? new MeshStandardMaterial({ color: hollow.casing.color, roughness: 0.9, side: BackSide }) : undefined), [hollow]);
  const dark = useMemo(() => new MeshStandardMaterial({ color: '#0b0c0f', roughness: 0.9 }), []);
  const tray = spec.kind === 'box' ? spec.tray : undefined;
  const trayMaterial = useMemo(() => (tray ? new MeshStandardMaterial({ color: tray.color, roughness: 0.5 }) : undefined), [tray]);
  useEffect(() => () => trayMaterial?.dispose(), [trayMaterial]);
  const trayParts = useMemo(() => {
    if (!tray || spec.kind !== 'box') return undefined;
    const r = spec.radiusMm;
    const [w, h, d] = [spec.widthMm, spec.heightMm - 2 * trayInset(spec), spec.depthMm];
    const flat = new PlaneGeometry(w - 2 * r, h);
    const [cx, cz] = [w / 2 - r, d / 2 - r];
    const arc = (theta: number) => new CylinderGeometry(r + 0.02, r + 0.02, h, 6, 1, true, theta, Math.PI / 4);
    const parts: Piece[] = [
      { geometry: flat, position: [0, 0, d / 2 + 0.02], rotation: [0, 0, 0] },
      // Angles as three's CylinderGeometry: 0 faces +z. Front-left from 7π/4 round to the front, front-right from the front.
      { geometry: arc((7 * Math.PI) / 4), position: [-cx, 0, cz], rotation: [0, 0, 0] },
      { geometry: arc(0), position: [cx, 0, cz], rotation: [0, 0, 0] },
    ];
    if (!spec.wrapTray) parts.push({ geometry: new PlaneGeometry(w - 2 * r, h), position: [0, 0, -d / 2 - 0.02], rotation: [0, Math.PI, 0] });
    return parts;
  }, [tray, spec]);
  useEffect(() => () => trayParts?.forEach((p) => p.geometry.dispose()), [trayParts]);
  const hinge = spec.kind === 'box' ? spec.hinge : undefined;
  const hingeMaterial = useMemo(() => (hinge ? new MeshStandardMaterial({ color: hinge.color, roughness: 0.45 }) : undefined), [hinge]);
  const hingeGeometry = useMemo(
    // A thin strip on the front only, on the flat of the face, so its ends line up with the front's printed artwork.
    () => (hinge && spec.kind === 'box' ? new RoundedBoxGeometry(hinge.widthMm, spec.heightMm - 2 * trayInset(spec), HINGE_DEPTH_MM, 2, HINGE_DEPTH_MM / 2) : undefined),
    [hinge, spec],
  );
  useEffect(() => () => hingeMaterial?.dispose(), [hingeMaterial]);
  useEffect(() => () => hingeGeometry?.dispose(), [hingeGeometry]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => pieces.forEach((p) => p.geometry.dispose()), [pieces]);
  useEffect(() => () => metal.dispose(), [metal]);
  useEffect(() => () => dark.dispose(), [dark]);
  useEffect(() => () => inner?.dispose(), [inner]);
  useEffect(
    () => () => {
      sleeve.dispose();
      body.dispose();
    },
    [sleeve, body],
  );

  const [, height, depth] = modelSizeMm(spec);
  const shutter = spec.kind === 'slab' ? spec.shutter : undefined;
  const hub = spec.kind === 'slab' ? spec.hub : undefined;
  return (
    <group scale={scale ?? previewScale(spec)}>
      <mesh geometry={geometry} material={materials} />
      {hollow && inner && <mesh geometry={geometry} material={[inner, inner, inner, inner, inner, inner]} scale={[(hollow.widthMm - 2 * SLEEVE_WALL_MM) / hollow.widthMm, 1, (hollow.depthMm - 2 * SLEEVE_WALL_MM) / hollow.depthMm]} />}
      {tray && trayMaterial && trayParts && (
        // The tray inside the clear rim, just under the printed parts, on the flat of the front (and of the back when no tray
        // card wraps it) and round the front half of each front corner, meeting the tray card's flaps there.
        <>
          {trayParts.map((p, i) => (
            <mesh key={i} material={trayMaterial} geometry={p.geometry} position={p.position} rotation={p.rotation} />
          ))}
        </>
      )}
      {hinge && hingeMaterial && spec.kind === 'box' && (
        // The lid's hinge: a bar at the front of the spine edge, just proud of the body so it covers the faces it sits on.
        // On the front face, out to the spine edge, just proud of the surface.
        <mesh material={hingeMaterial} geometry={hingeGeometry!} position={[-spec.widthMm / 2 + trayInset(spec) + hinge.widthMm / 2, 0, spec.depthMm / 2 + HINGE_DEPTH_MM / 2 - 0.2]} />
      )}
      {pieces.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={sleeve} position={p.position} rotation={p.rotation} />
      ))}
      {shutter && (
        // Slides over the top edge, so it shows on both faces and is a little thicker than the body. The window is dark.
        <>
          <mesh material={metal} position={[shutter.xMm, height / 2 - shutter.heightMm / 2, 0]}>
            <boxGeometry args={[shutter.widthMm, shutter.heightMm, depth + 0.5]} />
          </mesh>
          <mesh material={dark} position={[shutter.xMm + shutter.widthMm * 0.18, height / 2 - shutter.heightMm * 0.55, 0]}>
            <boxGeometry args={[shutter.widthMm * 0.26, shutter.heightMm * 0.58, depth + 0.56]} />
          </mesh>
        </>
      )}
      {hub && (
        // The drive hub on the back: a metal disc with the square spindle hole.
        <>
          <mesh material={metal} position={[0, hub.yMm, -depth / 2 - 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[hub.radiusMm, hub.radiusMm, 0.3, 40]} />
          </mesh>
          <mesh material={dark} position={[0, hub.yMm, -depth / 2 - 0.3]}>
            <boxGeometry args={[hub.radiusMm * 0.34, hub.radiusMm * 0.34, 0.2]} />
          </mesh>
        </>
      )}
    </group>
  );
}

export function PreviewScene({ texture, template, autoRotate = false, showMeasurements = false }: { texture: Texture; template: TemplateConfig; autoRotate?: boolean; showMeasurements?: boolean }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const [, height] = modelSizeMm(template.preview);
  // Logged after each drag/zoom so a good angle can be copied into DEFAULT_CAMERA_POSITION.
  const logCamera = () => {
    const c = controls.current;
    if (c) console.log(`[CoverForge 3D] camera position: ${fmt(c.object.position)}  target: ${fmt(c.target)}`);
  };
  // Dev only: lets scripts/check-previews.mjs put the camera at exact angles (front, rear, sides…) for its screenshots.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __coverForge3D?: { setCamera: (position: [number, number, number]) => void } };
    w.__coverForge3D = {
      setCamera(position) {
        const c = controls.current;
        if (!c) throw new Error('3D preview not ready');
        c.enableDamping = false;
        c.object.position.set(...position);
        c.target.set(0, 0, 0);
        c.update();
      },
    };
    return () => {
      delete w.__coverForge3D;
    };
  }, []);
  return (
    <Canvas camera={{ fov: 40, position: DEFAULT_CAMERA_POSITION }} dpr={[1, 2]}>
      <Environment preset="city" />
      <Model texture={texture} template={template} />
      {showMeasurements && <Measurements3D spec={template.preview} template={template} />}
      <ContactShadows position={[0, (-height * previewScale(template.preview)) / 2 - 0.02, 0]} opacity={0.5} blur={2.5} scale={6} />
      <OrbitControls
        ref={controls}
        onEnd={logCamera}
        enableDamping
        enablePan={false}
        minDistance={1.8}
        maxDistance={6}
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}
