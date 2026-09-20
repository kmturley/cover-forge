import { describe, expect, it } from 'vitest';
import { buildAssetUrls } from './steam';

describe('buildAssetUrls', () => {
  it('builds deterministic CDN URLs', () => {
    const a = buildAssetUrls(620, ['s1']);
    expect(a.cover).toContain('/620/library_600x900_2x.jpg');
    expect(a.hero).toContain('/620/library_hero_2x.jpg');
    expect(a.logo).toContain('/620/logo.png');
    expect(a.screenshots).toEqual(['s1']);
  });
});
