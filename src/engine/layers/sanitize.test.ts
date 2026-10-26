import { describe, expect, it } from 'vitest';
import type { ImageLayer, ShapeLayer, TextLayer } from '../../types/layers';
import { sanitizeDiff, sanitizeLayer, sanitizePatch } from './sanitize';

const shape = (extra: Record<string, unknown>) => sanitizeLayer({ id: 's', type: 'shape', target: 'front', ...extra }) as ShapeLayer;

describe('sanitizePatch', () => {
  it('keeps valid gradients and drops broken ones', () => {
    const good = { axis: 'x', stops: [[0, '#fff'], [1.5, '#000'], ['no', 'x']] };
    expect(sanitizePatch({ fill: good }).fill).toEqual({ axis: 'x', stops: [[0, '#fff'], [1, '#000']] });
    expect(sanitizePatch({ fill: { axis: 'z', stops: [[0, '#fff'], [1, '#000']] } }).fill).toBeUndefined();
    expect(sanitizePatch({ fill: { axis: 'x', stops: [[0, '#fff']] } }).fill).toBeUndefined();
    expect(sanitizePatch({ fill: null }).fill).toBeNull();
    expect(sanitizePatch({ fill: '#123456' }).fill).toBe('#123456');
  });

  it('accepts path data and nothing but', () => {
    expect(sanitizePatch({ path: 'M0 0L100 0 100 100Z' }).path).toBe('M0 0L100 0 100 100Z');
    expect(sanitizePatch({ path: 'M0 0 <script>' }).path).toBeUndefined();
    expect(sanitizePatch({ path: '' }).path).toBeUndefined();
    expect(sanitizePatch({ path: 'M'.repeat(60_001) }).path).toBeUndefined();
  });

  it('checks a mark’s parts and a spine title’s fit', () => {
    expect(sanitizePatch({ source: { kind: 'vector', id: 'xbox', crop: [0, 0, 0.5, 1], only: [0, 2, -1, 1.5], mono: true } }).source).toEqual({ kind: 'vector', id: 'xbox', only: [0, 2], crop: [0, 0, 0.5, 1], mono: true });
    expect((sanitizePatch({ source: { kind: 'vector', id: 'xbox', crop: [0.5, 0, 0.2, 1] } }).source as { crop?: unknown }).crop).toBeUndefined();
    expect(sanitizePatch({ spineFit: { startMm: 30, scale: 1.2, contrast: { on: '#fff', color: '#333' } } }).spineFit).toEqual({ startMm: 30, scale: 1.2, contrast: { on: '#fff', color: '#333' } });
    expect(sanitizePatch({ spineFit: { startMm: 'x', scale: 1 } }).spineFit).toBeUndefined();
    expect(sanitizePatch({ textCase: 'lower', singleLine: 'yes' })).toEqual({});
    expect(sanitizePatch({ textCase: 'upper', singleLine: true })).toEqual({ textCase: 'upper', singleLine: true });
  });
});

describe('sanitizeLayer', () => {
  it('keeps a path shape with its outline and fill', () => {
    const l = shape({ shape: 'path', path: 'M0 0L100 100', fill: { axis: 'y', stops: [[0, '#fff'], [1, '#000']] } });
    expect(l).toMatchObject({ shape: 'path', path: 'M0 0L100 100', fill: { axis: 'y' } });
  });
  it('keeps single-line text and its folder', () => {
    const l = sanitizeLayer({ id: 't', type: 'text', target: 'back', singleLine: true, textCase: 'upper', parent: 'f1', letterSpacing: 150, textHeightMm: 4 }) as TextLayer;
    expect(l).toMatchObject({ singleLine: true, textCase: 'upper', parent: 'f1', letterSpacing: 150, textHeightMm: 4 });
  });
  it('keeps a mark layer’s parts', () => {
    const l = sanitizeLayer({ id: 'm', type: 'image', target: 'front', source: { kind: 'vector', id: 'wii', mono: true } }) as ImageLayer;
    expect(l.source).toEqual({ kind: 'vector', id: 'wii', mono: true });
  });
  it('makes a folder, and refuses an id that is not safe', () => {
    expect(sanitizeLayer({ id: 'f', type: 'group', target: 'front', name: 'Branded', visible: false })).toMatchObject({ type: 'group', name: 'Branded', visible: false });
    expect(sanitizeLayer({ id: '../x', type: 'group', target: 'front' })).toBeNull();
  });
});

describe('sanitizeDiff', () => {
  it('carries folders and their layers through', () => {
    const d = sanitizeDiff({ added: [{ layer: { id: 'f', type: 'group', target: 'front' } }, { layer: { id: 'c', type: 'shape', target: 'front', parent: 'f' } }] });
    expect(d?.added?.map((a) => [a.layer.id, a.layer.parent])).toEqual([['f', undefined], ['c', 'f']]);
  });
});

describe('a text layer survives a save', () => {
  it('keeps the height, rotation and words it was given', () => {
    const l = sanitizeLayer({ id: 't', type: 'text', target: 'front', text: 'Hi {title}', textTemplate: '{title}', textHeightMm: 6, textRotationDeg: 180, align: 'right', weight: 400, italic: true, letterSpacing: 40, lineHeight: 0.9 }) as TextLayer;
    expect(l).toMatchObject({ text: 'Hi {title}', textTemplate: '{title}', textHeightMm: 6, textRotationDeg: 180, align: 'right', weight: 400, italic: true, letterSpacing: 40, lineHeight: 0.9 });
  });
});
