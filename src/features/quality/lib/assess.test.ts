import { describe, expect, it } from 'vitest';
import { assessQuality, worstRating } from './assess';
import { formatBytes, formatResolution } from './format';
import { QUALITY_THRESHOLDS as T } from './thresholds';
import type { ImageMetrics } from './types';

const good: ImageMetrics = {
  width: 4032,
  height: 3024,
  byteSize: 3_400_000,
  brightnessPct: 50,
  sharpness: 300,
};
const rating = (m: Partial<ImageMetrics>, id: string, ctx?: { torchSupported?: boolean }) =>
  assessQuality({ ...good, ...m }, T, ctx).checks.find((c) => c.id === id)!;

/** Builds a w×h with the given megapixels (square-ish). */
const mp = (n: number) => ({ width: 1_000_000, height: n });

describe('assessQuality', () => {
  it('rates a well-exposed, sharp, high-res photo Good with no messages', () => {
    const a = assessQuality(good);
    expect(a.verdict).toBe('good');
    expect(a.checks.map((c) => c.id)).toEqual(['resolution', 'fileSize', 'brightness', 'sharpness']);
    expect(a.checks.every((c) => !c.message && !c.tip)).toBe(true);
  });

  it.each([
    [5.0, 'good'],
    [4.99, 'fair'],
    [2.0, 'fair'],
    [1.99, 'poor'],
  ])('resolution %s MP → %s', (n, expected) => {
    expect(rating(mp(n), 'resolution').rating).toBe(expected);
  });

  it.each([
    [15_000_000, 'good'],
    [15_000_001, 'fair'],
    [500_000, 'good'],
    [499_999, 'fair'],
    [150_000, 'fair'],
    [149_999, 'poor'],
  ])('file size %s bytes → %s', (bytes, expected) => {
    expect(rating({ byteSize: bytes }, 'fileSize').rating).toBe(expected);
  });

  it.each([
    [25, 'good'],
    [80, 'good'],
    [24.9, 'fair'],
    [15, 'fair'],
    [14.9, 'poor'],
    [80.1, 'fair'],
    [90, 'fair'],
    [90.1, 'poor'],
  ])('brightness %s%% → %s', (pct, expected) => {
    expect(rating({ brightnessPct: pct }, 'brightness').rating).toBe(expected);
  });

  it.each([
    [T.sharpness.good, 'good'],
    [T.sharpness.good - 0.1, 'fair'],
    [T.sharpness.fair, 'fair'],
    [T.sharpness.fair - 0.1, 'poor'],
  ])('sharpness %s → %s', (v, expected) => {
    expect(rating({ sharpness: v }, 'sharpness').rating).toBe(expected);
  });

  it('the verdict is the worst individual rating', () => {
    expect(assessQuality({ ...good, brightnessPct: 10 }).verdict).toBe('poor');
    expect(assessQuality({ ...good, ...mp(3) }).verdict).toBe('fair');
    expect(worstRating(['good', 'fair', 'good'])).toBe('fair');
    expect(worstRating([])).toBe('good');
  });

  it('gives a message and tip for each failed check', () => {
    const dark = rating({ brightnessPct: 10 }, 'brightness');
    expect(dark.message).toMatch(/dark/i);
    expect(dark.tip).toBeTruthy();
    const blurry = rating({ sharpness: 5 }, 'sharpness');
    expect(blurry.message).toMatch(/blur/i);
    expect(blurry.tip).toMatch(/steady|focus/i);
  });

  it('only suggests the torch when it is supported', () => {
    expect(rating({ brightnessPct: 10 }, 'brightness', { torchSupported: true }).tip).toMatch(/torch|flash/i);
    expect(rating({ brightnessPct: 10 }, 'brightness', { torchSupported: false }).tip).not.toMatch(
      /torch|flash/i,
    );
  });

  it('null pixel metrics produce a non-alarming fair result without a tip', () => {
    const b = rating({ brightnessPct: null }, 'brightness');
    expect(b).toMatchObject({ rating: 'fair' });
    expect(b.message).toMatch(/couldn.t analyze/i);
    expect(b.tip).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats bytes', () => {
    expect(formatBytes(3_400_000)).toBe('3.4 MB');
    expect(formatBytes(820_000)).toBe('820 KB');
    expect(formatBytes(512)).toBe('512 B');
  });
  it('formats resolution', () => {
    expect(formatResolution(4032, 3024)).toBe('12.2 MP (4032 × 3024)');
    expect(formatResolution(640, 480)).toBe('0.3 MP (640 × 480)');
  });
});
