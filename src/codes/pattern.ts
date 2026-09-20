import type { MediaItem } from '../types/media';

/** The value of `{appId}`: the source id (e.g. Steam app id), or the item id without a "steam-" prefix for older saves. */
export const appIdOf = (item: MediaItem) => item.sourceId ?? item.id.replace(/^steam-/, '');

/** Tokens usable in a pattern, for the UI. */
export const PATTERN_TOKENS = ['{title}', '{titleEncoded}', '{appId}', '{id}', '{year}', '{subtitle}'] as const;

/** Fills a pattern's tokens for one item. Unknown tokens are left as written. */
export function fillPattern(pattern: string, item: MediaItem): string {
  const values: Record<string, string> = {
    title: item.title,
    titleEncoded: encodeURIComponent(item.title),
    appId: appIdOf(item),
    id: item.id,
    year: item.year ?? '',
    subtitle: item.subtitle ?? '',
  };
  return pattern.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

/** 32-bit FNV-1a; small, stable and good enough to spread titles over digits. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** `count` stable digits derived from a string. */
export function digitsFrom(text: string, count: number): string {
  let out = '';
  for (let salt = 0; out.length < count; salt++) out += fnv1a(`${salt}:${text}`).toString().padStart(10, '0');
  return out.slice(0, count);
}

export interface BarcodeValue {
  /** The digits/characters that get encoded (a check digit is added for EAN/UPC when drawing). */
  value: string;
  /** True when the pattern had too few digits and a number was generated from the title. */
  generated: boolean;
}

/**
 * What a barcode should encode. EAN-13 needs 12 digits and UPC-A 11 (the check digit is added), so the pattern's digits
 * are used if there are enough. Otherwise a number is generated from the item: EAN-13 starts with "2" (GS1's in-store
 * range) and UPC-A with "4" (retailer-use range), so it can never collide with a real product's registered code.
 */
export function barcodeValue(kind: 'ean13' | 'upca' | 'code128', pattern: string, item: MediaItem): BarcodeValue {
  const text = fillPattern(pattern, item);
  if (kind === 'code128') return { value: text.length ? text : item.title, generated: false };
  const need = kind === 'ean13' ? 12 : 11;
  const digits = text.replace(/\D/g, '');
  if (digits.length >= need) return { value: digits.slice(0, need), generated: false };
  const lead = kind === 'ean13' ? '2' : '4';
  return { value: lead + digitsFrom(`${item.id}|${item.title}`, need - 1), generated: true };
}
