import { getBrand } from '../../brands';
import { computeCodePlacement } from '../../engine/code';
import { libraryImages } from '../../engine/imageLibrary';
import { computeLogoPlacement } from '../../engine/logo';
import { brandAspect } from '../../brands';
import { srcOf } from '../../storage/localImages';
import type { ResolvedPanel } from '../../engine/resolve';
import type { MediaItem } from '../../types/media';
import type { CodeKind, SpineSettings } from '../../types/editor';
import type { PanelRect, TemplateConfig } from '../../types/template';
import { FONTS } from './SpineEditor';

const Swatch = ({ color }: { color: string }) => <span className="swatch" style={{ background: color }} aria-hidden="true" />;

export const CODE_LABELS: Record<CodeKind, string> = { none: 'None', qr: 'QR code', ean13: 'Barcode · EAN-13', upca: 'Barcode · UPC-A', code128: 'Barcode · Code 128' };

export function BackgroundSummary({ r }: { r: ResolvedPanel }) {
  return r.backgroundColor ? (
    <>
      <Swatch color={r.backgroundColor} />
      {r.backgroundColor}
    </>
  ) : (
    <span className="muted">None</span>
  );
}

export function BorderSummary({ r }: { r: ResolvedPanel }) {
  if (r.border.widthMm <= 0) return <span className="muted">None</span>;
  return (
    <>
      <Swatch color={r.border.color} />
      <span>
        {r.border.widthMm} mm · {r.border.insetMm} mm in from the edge
      </span>
    </>
  );
}

export function ImageSummary({ r, item }: { r: ResolvedPanel; item: MediaItem }) {
  if (r.imageRef === null || !r.imageUrl) return <span className="muted">None</span>;
  const t = r.transform;
  const parts = [
    libraryImages(item).find((i) => i.ref === r.imageRef)?.label ?? 'Image',
    t.xMm === null && t.yMm === null ? 'centred' : `at ${t.xMm ?? 'centre'}, ${t.yMm ?? 'centre'} mm`,
    `${t.scale}×`,
    ...(t.rotationDeg ? [`${t.rotationDeg}°`] : []),
    ...(t.opacity < 1 ? [`${Math.round(t.opacity * 100)}% opacity`] : []),
  ];
  return (
    <>
      <img className="summary-thumb" src={srcOf(r.imageUrl)} alt="" crossOrigin="anonymous" />
      <span>{parts.join(' · ')}</span>
    </>
  );
}

export function LogoSummary({ r, template, rect }: { r: ResolvedPanel; template: TemplateConfig; rect: PanelRect }) {
  const brand = getBrand(r.logo.brand);
  if (!brand) return <span className="muted">None</span>;
  const pl = computeLogoPlacement(template, rect, brandAspect(brand), r.logo);
  const placed = r.logo.xMm !== null || r.logo.yMm !== null ? `at ${Math.round(pl.xMm * 10) / 10}, ${Math.round(pl.yMm * 10) / 10} mm` : 'default position';
  return (
    <>
      <Swatch color={r.logo.color} />
      <span>
        {brand.label} · {Math.round(pl.widthMm * 10) / 10} mm wide · {placed}
      </span>
    </>
  );
}

export function CodeSummary({ r, template, rect }: { r: ResolvedPanel; template: TemplateConfig; rect: PanelRect }) {
  if (r.code.kind === 'none') return <span className="muted">None</span>;
  const pl = computeCodePlacement(template, rect, r.code);
  return (
    <span>
      {CODE_LABELS[r.code.kind]} · {r.code.pattern}{pl && ` · ${Math.round(pl.widthMm * 10) / 10} mm wide`}
    </span>
  );
}

export function SpineSummary({ spine, autoMm }: { spine: SpineSettings; autoMm: number }) {
  return (
    <>
      <Swatch color={spine.color} />
      <span>
        {FONTS.find(([v]) => v === spine.fontFamily)?.[1] ?? 'Custom font'} · {spine.textHeightMm !== undefined ? `${spine.textHeightMm} mm` : `automatic (${autoMm} mm)`}
        {spine.rotationDeg ? ` · ${spine.rotationDeg}° rotated` : ''}
      </span>
    </>
  );
}
