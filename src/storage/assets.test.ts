import { describe, expect, it } from 'vitest';
import { assetFromUrl, isMissing, matchAsset, sha256Hex } from './assets';
import type { Asset } from '../types/layers';

describe('assetFromUrl', () => {
  it('keeps only the address, and names the asset after its file', () => {
    const a = assetFromUrl('https://example.com/img/esrb%20rating.png?v=2');
    expect(a.source).toEqual({ kind: 'url', url: 'https://example.com/img/esrb%20rating.png?v=2' });
    expect(a.name).toBe('esrb rating.png');
    expect(a.id).toMatch(/^asset-/);
  });
  it('refuses anything that is not http or https, and what is not an address', () => {
    expect(() => assetFromUrl('javascript:alert(1)')).toThrow(/http/);
    expect(() => assetFromUrl('file:///etc/passwd')).toThrow(/http/);
    expect(() => assetFromUrl('not a url')).toThrow(/web address/);
  });
});

describe('finding a missing file again', () => {
  const file = new File([new Uint8Array([1, 2, 3, 4])], 'badge.png', { type: 'image/png' });
  const asset = async (over: Partial<Asset> = {}): Promise<Asset> => ({ id: 'a', name: 'badge.png', source: { kind: 'local', ref: 'local:gone' }, size: 4, hash: await sha256Hex(file), ...over });

  it('hashes bytes the same way twice', async () => {
    expect(await sha256Hex(file)).toBe(await sha256Hex(new Blob([new Uint8Array([1, 2, 3, 4])])));
    expect(await sha256Hex(file)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('matches by contents first, then by name and size, else not at all', async () => {
    expect(await matchAsset(await asset(), file)).toBe('hash');
    expect(await matchAsset(await asset({ hash: 'other' }), file)).toBe('name');
    expect(await matchAsset(await asset({ hash: 'other', size: 99 }), file)).toBe('none');
    expect(await matchAsset(await asset({ hash: undefined, name: 'other.png' }), file)).toBe('none');
  });
  it('is missing only for an upload whose bytes are not in this browser', async () => {
    expect(isMissing(await asset())).toBe(true);
    expect(isMissing({ id: 'u', name: 'u', source: { kind: 'url', url: 'https://e/u.png' } })).toBe(false);
  });
});
