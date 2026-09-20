import { MeshPhysicalMaterial, type Texture } from 'three';
import type { PreviewMaterial } from '../types/template';

/** The printed artwork: paper, optionally under glossy film. */
export function createSleeveMaterial(map: Texture, glossy: boolean): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    map,
    roughness: glossy ? 0.22 : 0.75,
    clearcoat: glossy ? 1 : 0,
    clearcoatRoughness: 0.04,
  });
}

/** The unprinted body: translucent plastic, opaque plastic or card, depending on the template. */
export function createBodyMaterial(m: PreviewMaterial): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: m.color,
    roughness: m.roughness ?? 0.3,
    transmission: m.transmission ?? 0,
    thickness: m.transmission ? 1.2 : 0,
    ior: 1.5,
  });
}
