import { create } from 'qrcode';
import EAN13 from 'jsbarcode/src/barcodes/EAN_UPC/EAN13.js';
import UPC from 'jsbarcode/src/barcodes/EAN_UPC/UPC.js';
import CODE128 from 'jsbarcode/src/barcodes/CODE128/CODE128_AUTO.js';

/** Bars as a string of modules: '1' = dark, '0' = light. Quiet zones are not included. */
export interface Bars {
  modules: string;
  /** The full human-readable value (with check digit for EAN/UPC). */
  text: string;
}

const FLAT = { flat: true, width: 1, height: 1, fontSize: 1, textMargin: 0, displayValue: false } as const;

/** Standard quiet zones in modules: EAN-13 11 left / 7 right, UPC-A 9 both, Code 128 10 both. */
export const QUIET = { ean13: [11, 7], upca: [9, 9], code128: [10, 10] } as const;

/** Encodes a value with a checked, standard encoder. Returns null when the value isn't valid for the symbology. */
export function encodeBars(kind: 'ean13' | 'upca' | 'code128', value: string): Bars | null {
  try {
    const Encoder = kind === 'ean13' ? EAN13 : kind === 'upca' ? UPC : CODE128;
    const enc = new Encoder(value, { ...FLAT });
    if (!enc.valid()) return null;
    const out = enc.encode();
    const one = Array.isArray(out) ? out[0] : out;
    return one?.data ? { modules: one.data, text: enc.text ?? enc.data } : null;
  } catch {
    return null;
  }
}

/** QR module grid: `size` × `size`, `get(row, col)` true for a dark module. Medium error correction. */
export interface QrMatrix {
  size: number;
  get(row: number, col: number): boolean;
}

export function encodeQr(text: string): QrMatrix | null {
  if (!text) return null;
  try {
    const m = create(text, { errorCorrectionLevel: 'M' }).modules;
    return { size: m.size, get: (r, c) => m.get(r, c) === 1 || (m.get(r, c) as unknown) === true };
  } catch {
    return null; // too much data for a QR code
  }
}
