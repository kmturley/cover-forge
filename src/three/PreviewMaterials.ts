import { CanvasTexture, MeshPhysicalMaterial, SRGBColorSpace, type Texture } from 'three';
import { getLogo, logoHeight, logoPaths2D, logoWidth } from '../brands';
import { paintLogoLayers } from '../engine/logoLayers';
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

/**
 * A logo moulded into plastic, as a texture: its shapes in white on transparent, `px` tall. Layers filled near white (the
 * holes of a mark drawn as shapes on top) are cut out, so it reads as one raised shape. Null when there is no such logo or
 * no canvas (tests).
 */
export function createEmbossTexture(id: string, px = 256, printed = false): { texture: CanvasTexture; aspect: number } | null {
  const logo = getLogo(id);
  if (!logo || typeof document === 'undefined') return null;
  const aspect = logoWidth(logo) / logoHeight(logo);
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [Math.round(px * aspect), px];
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const k = px / logoHeight(logo);
  ctx.scale(k, k);
  if (printed) {
    // In its own colours, as printed (white where it has none).
    paintLogoLayers(ctx, logo, logo.layers.map((_, i) => i), -logo.bbox[0], -logo.bbox[1], '#ffffff', false);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { texture, aspect };
  }
  ctx.translate(-logo.bbox[0], -logo.bbox[1]);
  const light = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return false;
    const n = parseInt(m[1], 16);
    return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 200;
  };
  logoPaths2D(logo).forEach((path, i) => {
    const layer = logo.layers[i];
    ctx.save();
    ctx.translate(layer.offset[0], layer.offset[1]);
    ctx.globalCompositeOperation = layer.fill && light(layer.fill) ? 'destination-out' : 'source-over';
    ctx.fillStyle = ctx.strokeStyle = '#ffffff';
    if (layer.fill !== 'none') ctx.fill(path, logo.evenodd ? 'evenodd' : 'nonzero');
    if (layer.stroke !== undefined && layer.strokeWidth) {
      ctx.lineWidth = layer.strokeWidth;
      ctx.stroke(path);
    }
    ctx.restore();
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, aspect };
}

/**
 * A logo on the case: printed (its own colours, opaque), or moulded, the plastic only slightly frosted where it is raised:
 * barely there on a clear case, a little lighter on a coloured one.
 */
export function createEmbossMaterial(map: Texture, casing: PreviewMaterial, printed = false): MeshPhysicalMaterial {
  if (printed) return new MeshPhysicalMaterial({ map, transparent: true, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
  return new MeshPhysicalMaterial({ map, color: casing.transmission ? '#ffffff' : casing.color, transparent: true, opacity: casing.transmission ? 0.16 : 0.85, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false, emissive: casing.color, emissiveIntensity: casing.transmission ? 0 : 0.25 });
}
