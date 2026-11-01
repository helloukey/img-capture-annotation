import { describe, expect, it } from 'vitest';
import { boxBlur, laplacianVariance, meanLuma, toGrayscale } from './metrics';

function solid(w: number, h: number, v: number) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([v, v, v, 255], i * 4);
  return rgba;
}

function checkerboard(w: number, h: number, cell = 2) {
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) gray[y * w + x] = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? 255 : 0;
  return gray;
}

describe('quality metrics', () => {
  it('meanLuma is 0 for black, 100 for white, ~50 for mid-gray', () => {
    expect(meanLuma(solid(8, 8, 0))).toBe(0);
    expect(meanLuma(solid(8, 8, 255))).toBe(100);
    expect(meanLuma(solid(8, 8, 128))).toBeCloseTo(50.2, 1);
  });

  it('toGrayscale uses Rec. 709 weights', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
    const g = toGrayscale(rgba);
    expect(g[0]).toBeCloseTo(0.2126 * 255, 3);
    expect(g[1]).toBeCloseTo(0.7152 * 255, 3);
    expect(g[2]).toBeCloseTo(0.0722 * 255, 3);
  });

  it('laplacianVariance is 0 for a flat image', () => {
    expect(laplacianVariance(new Float32Array(64 * 64).fill(120), 64, 64)).toBe(0);
  });

  it('a sharp checkerboard scores far higher than a blurred one', () => {
    const sharp = checkerboard(64, 64);
    const blurred = boxBlur(boxBlur(sharp, 64, 64), 64, 64);
    const s = laplacianVariance(sharp, 64, 64);
    const b = laplacianVariance(blurred, 64, 64);
    expect(s).toBeGreaterThan(1000);
    expect(b).toBeLessThan(s / 10);
  });

  it('returns 0 for images too small to convolve', () => {
    expect(laplacianVariance(new Float32Array(4), 2, 2)).toBe(0);
  });
});
