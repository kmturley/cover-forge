import { useEffect, useMemo, useRef, type ElementRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import type { Texture } from 'three';
import type { TemplateConfig } from '../types/template';
import { createCaseGeometry } from './CaseGeometry';
import { caseMaterials, createCasingMaterial, createSleeveMaterial } from './CaseMaterials';

/** Three-quarter view showing the spine (-X), top edge (+Y) and front cover (+Z). Tune via the console log. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [-2.2, 1.1, 2.6];

const fmt = (v: { x: number; y: number; z: number }) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`;

function Case({ texture, template }: { texture: Texture; template: TemplateConfig }) {
  const geometry = useMemo(() => createCaseGeometry(template), [template]);
  const materials = useMemo(
    () => caseMaterials(createSleeveMaterial(texture), createCasingMaterial()),
    [texture],
  );
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(
    () => () => {
      // Sleeve and casing are shared across faces; dispose each once.
      new Set(materials).forEach((m) => m.dispose());
    },
    [materials],
  );
  return <mesh geometry={geometry} material={materials} />;
}

export function BlurayScene({ texture, template }: { texture: Texture; template: TemplateConfig }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  // Logged after each drag/zoom so a good angle can be copied into DEFAULT_CAMERA_POSITION.
  const logCamera = () => {
    const c = controls.current;
    if (c) console.log(`[CoverForge 3D] camera position: ${fmt(c.object.position)}  target: ${fmt(c.target)}`);
  };
  return (
    <Canvas camera={{ fov: 40, position: DEFAULT_CAMERA_POSITION }} dpr={[1, 2]}>
      <Environment preset="city" />
      <Case texture={texture} template={template} />
      <ContactShadows position={[0, -0.8, 0]} opacity={0.5} blur={2.5} scale={6} />
      <OrbitControls ref={controls} onEnd={logCamera} enableDamping enablePan={false} minDistance={1.8} maxDistance={6} />
    </Canvas>
  );
}
