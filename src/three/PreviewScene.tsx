import { useEffect, useMemo, useRef, type ElementRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { MeshStandardMaterial, type PlaneGeometry, type Texture } from 'three';
import type { TemplateConfig } from '../types/template';
import { FACE_ORDER, createBodyGeometry, createLabelGeometry, createLabelSliceGeometry, labelWrap, modelSizeMm, previewScale, printedFaces } from './PreviewGeometry';
import { createBodyMaterial, createSleeveMaterial } from './PreviewMaterials';

/** Three-quarter view showing the left edge (-X), top edge (+Y) and front (+Z). Tune via the console log. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [-2.2, 1.1, 2.6];

const fmt = (v: { x: number; y: number; z: number }) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`;

/** The 3D model of the current template: a case/box, or a card/disk with an optional separate label. */
function Model({ texture, template }: { texture: Texture; template: TemplateConfig }) {
  const spec = template.preview;
  const geometry = useMemo(() => createBodyGeometry(template, spec), [template, spec]);

  // Everything printed that isn't a face of the body: partial-face decals, or a disk label (possibly wrapping round).
  const pieces = useMemo(() => {
    const out: { geometry: PlaneGeometry; position: [number, number, number]; rotation: [number, number, number] }[] = [];
    if (spec.kind === 'box') {
      for (const d of spec.decals ?? []) {
        const panel = template.panels.find((p) => p.id === d.panel);
        if (!panel) continue;
        const x = d.align === 'min-x' ? -spec.widthMm / 2 + panel.widthMm / 2 : spec.widthMm / 2 - panel.widthMm / 2;
        // On the back face, seen from behind: the plane is turned to face -z, and sits a hair off the surface (no z-fighting).
        out.push({ geometry: createLabelGeometry(template, d.panel), position: [x, 0, -spec.depthMm / 2 - 0.05], rotation: [0, Math.PI, 0] });
      }
    } else if (!spec.fullFace) {
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
    const printed = printedFaces(spec);
    return FACE_ORDER.map((f) => (printed[f] ? sleeve : body));
  }, [spec, sleeve, body]);
  const metal = useMemo(() => new MeshStandardMaterial({ color: '#b9bcc2', metalness: 0.9, roughness: 0.35 }), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => pieces.forEach((p) => p.geometry.dispose()), [pieces]);
  useEffect(() => () => metal.dispose(), [metal]);
  useEffect(
    () => () => {
      sleeve.dispose();
      body.dispose();
    },
    [sleeve, body],
  );

  const [, height, depth] = modelSizeMm(spec);
  const shutter = spec.kind === 'slab' ? spec.shutter : undefined;
  return (
    <group scale={previewScale(spec)}>
      <mesh geometry={geometry} material={materials} />
      {pieces.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={sleeve} position={p.position} rotation={p.rotation} />
      ))}
      {shutter && (
        // Slides over the top edge, so it shows on both faces and is a little thicker than the body.
        <mesh material={metal} position={[shutter.xMm, height / 2 - shutter.heightMm / 2, 0]}>
          <boxGeometry args={[shutter.widthMm, shutter.heightMm, depth + 0.5]} />
        </mesh>
      )}
    </group>
  );
}

export function PreviewScene({ texture, template }: { texture: Texture; template: TemplateConfig }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const [, height] = modelSizeMm(template.preview);
  // Logged after each drag/zoom so a good angle can be copied into DEFAULT_CAMERA_POSITION.
  const logCamera = () => {
    const c = controls.current;
    if (c) console.log(`[CoverForge 3D] camera position: ${fmt(c.object.position)}  target: ${fmt(c.target)}`);
  };
  return (
    <Canvas camera={{ fov: 40, position: DEFAULT_CAMERA_POSITION }} dpr={[1, 2]}>
      <Environment preset="city" />
      <Model texture={texture} template={template} />
      <ContactShadows position={[0, (-height * previewScale(template.preview)) / 2 - 0.02, 0]} opacity={0.5} blur={2.5} scale={6} />
      <OrbitControls ref={controls} onEnd={logCamera} enableDamping enablePan={false} minDistance={1.8} maxDistance={6} />
    </Canvas>
  );
}
