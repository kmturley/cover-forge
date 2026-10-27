import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../types/media';
import { MAX_SVG_CHARS, SVG_PRESETS, fillSvg, sanitizeSvg, svgAspect, svgImageUrl } from './svgTemplate';

const item: MediaItem = { id: 'steam-9', type: 'game', title: 'Tom & "Jerry" <3', year: '2026', sourceId: '9', assets: { cover: null, hero: null, logo: null, screenshots: [] } };
const svg = (inner: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"${attrs}>${inner}</svg>`;

describe('fillSvg', () => {
  it('fills the item’s variables, escaped so a title cannot break the markup', () => {
    expect(fillSvg('<text>{title} {year} {appId} {id}</text>', item)).toBe('<text>Tom &amp; &quot;Jerry&quot; &lt;3 2026 9 steam-9</text>');
  });
  it('leaves unknown variables as typed, and does not read inherited ones', () => {
    expect(fillSvg('{nope} {constructor}', item)).toBe('{nope} {constructor}');
  });
});

describe('sanitizeSvg', () => {
  it('keeps a plain graphic as it is', () => {
    const s = svg('<rect width="10" height="10" fill="#f00"/><text x="1" y="2">hi</text>');
    expect(sanitizeSvg(s)).toBe(s);
  });
  it('accepts an XML declaration and comments before the graphic', () => {
    expect(sanitizeSvg(`<?xml version="1.0"?>\n<!-- c -->${svg('<g/>')}`)).toBe(svg('<g/>'));
  });
  it('refuses what is not an SVG, is too long, or declares entities', () => {
    expect(sanitizeSvg('<div>hi</div>')).toBeNull();
    expect(sanitizeSvg('<svg>no end')).toBeNull();
    expect(sanitizeSvg(svg('x'.repeat(MAX_SVG_CHARS)))).toBeNull();
    expect(sanitizeSvg(`<!DOCTYPE svg [<!ENTITY a "b">]>${svg('')}`)).toBeNull();
    expect(sanitizeSvg(undefined as never)).toBeNull();
  });
  it('removes scripts, foreign content, handlers and animation', () => {
    const out = sanitizeSvg(svg('<script>alert(1)</script><foreignObject><div onclick="x()">hi</div></foreignObject><rect onload="x()" width="1" height="1"/><animate attributeName="x"/><set to="1"/>'))!;
    expect(out).not.toMatch(/script|foreignObject|onclick|onload|animate|<set/i);
    expect(out).toContain('<rect');
  });
  it('drops links out, keeping references to the graphic itself and small embedded pictures', () => {
    const out = sanitizeSvg(svg('<image href="https://evil.example/x.png"/><use xlink:href="#a"/><image href="data:image/png;base64,AAAA"/><image href="data:image/svg+xml;base64,AAAA"/><a href=\'javascript:alert(1)\'><rect/></a>'))!;
    expect(out).not.toMatch(/evil|svg\+xml;base64|javascript/i);
    expect(out).toContain('xlink:href="#a"');
    expect(out).toContain('data:image/png;base64,AAAA');
  });
  it('removes imports and external urls from styles', () => {
    const out = sanitizeSvg(svg('<style>@import url(https://evil.example/a.css); .a{fill:url(https://evil.example/p)} .b{fill:url(#grad)}</style><rect style="fill:url(http://x/y)"/>'))!;
    expect(out).not.toMatch(/evil|http:\/\/x/i);
    expect(out).toContain('url(#grad)');
  });
});

describe('svgAspect and svgImageUrl', () => {
  it('reads the shape from the viewBox, else the size, else 1', () => {
    expect(svgAspect(svg(''))).toBe(2);
    expect(svgAspect('<svg width="300" height="100"></svg>')).toBe(3);
    expect(svgAspect('<svg></svg>')).toBe(1);
  });
  it('makes a picture address from the filled, cleaned graphic, or nothing when it cannot be one', () => {
    const url = svgImageUrl(svg('<text>{title}</text>'), item)!;
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(url.split(',')[1])).toContain('Tom &amp; &quot;Jerry&quot; &lt;3');
    expect(svgImageUrl('not svg', item)).toBeNull();
  });
  it('every preset is a valid SVG that survives cleaning', () => {
    for (const p of SVG_PRESETS) {
      expect(sanitizeSvg(p.svg), p.label).not.toBeNull();
      expect(svgAspect(p.svg), p.label).toBeGreaterThan(0);
    }
  });
});
