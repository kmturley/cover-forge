import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../types/media';
import { appIdOf, barcodeValue, digitsFrom, fillPattern } from './pattern';
import { encodeBars, encodeQr, QUIET } from './encode';

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: 'steam-1091500',
  type: 'game',
  title: 'Cyberpunk 2077',
  year: '2020',
  subtitle: 'CD PROJEKT RED',
  sourceId: '1091500',
  assets: { cover: null, hero: null, logo: null, screenshots: [] },
  ...over,
});

describe('fillPattern', () => {
  it('fills tokens from the item and leaves unknown ones alone', () => {
    expect(fillPattern('https://store.steampowered.com/app/{appId}', item())).toBe('https://store.steampowered.com/app/1091500');
    expect(fillPattern('https://www.google.com/search?q={titleEncoded}', item())).toBe('https://www.google.com/search?q=Cyberpunk%202077');
    expect(fillPattern('{title} ({year}) by {subtitle}', item())).toBe('Cyberpunk 2077 (2020) by CD PROJEKT RED');
    expect(fillPattern('{nope}-{id}', item())).toBe('{nope}-steam-1091500');
  });

  it('falls back to the id (minus "steam-") when an older save has no sourceId', () => {
    expect(appIdOf(item({ sourceId: undefined }))).toBe('1091500');
  });
});

describe('barcodeValue', () => {
  it('uses the pattern digits when there are enough', () => {
    expect(barcodeValue('ean13', '5901234123457', item())).toEqual({ value: '590123412345', generated: false });
    expect(barcodeValue('upca', '036000291452', item())).toEqual({ value: '03600029145', generated: false });
    expect(barcodeValue('ean13', '{appId}0000000', item())).toEqual({ value: '109150000000', generated: false });
  });

  it('generates a stable number in the reserved in-store ranges when the pattern has too few digits', () => {
    const a = barcodeValue('ean13', '{title}', item());
    const b = barcodeValue('ean13', '{title}', item());
    expect(a).toEqual(b);
    expect(a.generated).toBe(true);
    expect(a.value).toMatch(/^2\d{11}$/); // EAN-13: "2" = GS1 in-store / restricted circulation
    expect(barcodeValue('upca', '{title}', item()).value).toMatch(/^4\d{10}$/); // UPC-A: "4" = retailer use
    expect(barcodeValue('ean13', '{title}', item({ id: 'x', title: 'Other' })).value).not.toBe(a.value);
  });

  it('code128 encodes the text itself, falling back to the title', () => {
    expect(barcodeValue('code128', 'ABC-{appId}', item()).value).toBe('ABC-1091500');
    expect(barcodeValue('code128', '', item()).value).toBe('Cyberpunk 2077');
  });

  it('digitsFrom is deterministic and exactly the requested length', () => {
    expect(digitsFrom('abc', 11)).toHaveLength(11);
    expect(digitsFrom('abc', 30)).toHaveLength(30);
    expect(digitsFrom('abc', 11)).toBe(digitsFrom('abc', 11));
    expect(digitsFrom('abc', 11)).not.toBe(digitsFrom('abd', 11));
  });
});

describe('encodeBars', () => {
  it('EAN-13: 95 modules with start/middle/end guards, check digit added or verified', () => {
    const bars = encodeBars('ean13', '400638133393')!; // 12 digits: check digit is appended
    expect(bars.text).toBe('4006381333931');
    expect(bars.modules).toHaveLength(95);
    expect(bars.modules.startsWith('101')).toBe(true);
    expect(bars.modules.endsWith('101')).toBe(true);
    expect(bars.modules.slice(45, 50)).toBe('01010'); // centre guard
    expect(encodeBars('ean13', '4006381333931')!.modules).toBe(bars.modules);
    expect(encodeBars('ean13', '4006381333930')).toBeNull(); // wrong check digit
    expect(encodeBars('ean13', '12345')).toBeNull();
  });

  it('UPC-A: 95 modules, known valid code', () => {
    const bars = encodeBars('upca', '03600029145')!; // Wikipedia's example; check digit 2
    expect(bars.text).toBe('036000291452');
    expect(bars.modules).toHaveLength(95);
    expect(encodeBars('upca', '036000291453')).toBeNull();
  });

  it('EAN-13 and the same digits as UPC-A (with a leading 0) draw identical bars', () => {
    expect(encodeBars('ean13', '0036000291452')!.modules).toBe(encodeBars('upca', '036000291452')!.modules);
  });

  it('Code 128 encodes ASCII text and ends with the stop pattern', () => {
    const bars = encodeBars('code128', 'Cyberpunk 2077')!;
    expect(bars.modules.endsWith('1100011101011')).toBe(true);
    expect(bars.modules.length % 11).toBe(2); // 11-module symbols, plus the 13-module stop: (n*11)+2
  });

  it('exposes standard quiet zones', () => {
    expect(QUIET.ean13).toEqual([11, 7]);
  });
});

describe('encodeQr', () => {
  it('builds a valid grid with finder patterns in three corners', () => {
    const qr = encodeQr('https://store.steampowered.com/app/1091500')!;
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect((qr.size - 17) % 4).toBe(0); // sizes are 21, 25, 29, …
    for (const [r, c] of [[0, 0], [0, qr.size - 1], [qr.size - 1, 0]]) expect(qr.get(r, c)).toBe(true);
    expect(qr.get(qr.size - 1, qr.size - 1)).toBe(false); // the fourth corner has no finder
  });

  it('returns null for empty text or text too long for any QR code', () => {
    expect(encodeQr('')).toBeNull();
    expect(encodeQr('x'.repeat(5000))).toBeNull();
  });
});
