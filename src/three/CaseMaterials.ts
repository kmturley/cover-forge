import { MeshPhysicalMaterial, type Texture } from 'three';

/** Printed paper sleeve under glossy film. */
export function createSleeveMaterial(map: Texture): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    map,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
}

/** Translucent blue polypropylene casing. */
export function createCasingMaterial(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: '#0a4da2',
    roughness: 0.3,
    transmission: 0.8,
    thickness: 1.2,
    ior: 1.5,
  });
}

/** Material per BoxGeometry face: [+X open, -X spine, +Y top, -Y bottom, +Z front, -Z back]. */
export function caseMaterials(sleeve: MeshPhysicalMaterial, casing: MeshPhysicalMaterial): MeshPhysicalMaterial[] {
  return [casing, sleeve, casing, casing, sleeve, sleeve];
}
