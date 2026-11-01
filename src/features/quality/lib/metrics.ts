// Pure pixel metrics on raw buffers (no DOM) so they can be unit-tested with synthetic data.
// Hot loops index typed arrays within bounds; non-null assertions avoid per-pixel branches.
/* eslint-disable @typescript-eslint/no-non-null-assertion */

const R = 0.2126;
const G = 0.7152;
const B = 0.0722;

/** Rec. 709 luma per pixel, 0–255. */
export function toGrayscale(rgba: Uint8ClampedArray): Float32Array {
  const n = rgba.length / 4;
  const gray = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) gray[i] = R * rgba[j]! + G * rgba[j + 1]! + B * rgba[j + 2]!;
  return gray;
}

/** Mean Rec. 709 luma as a percentage of full scale (0–100). */
export function meanLuma(rgba: Uint8ClampedArray): number {
  const n = rgba.length / 4;
  if (n === 0) return 0;
  let sum = 0;
  for (let j = 0; j < rgba.length; j += 4) sum += R * rgba[j]! + G * rgba[j + 1]! + B * rgba[j + 2]!;
  return Math.round((sum / n / 255) * 100 * 100) / 100;
}

/**
 * Variance of the 3×3 Laplacian ([0,1,0; 1,-4,1; 0,1,0]) over the interior pixels.
 * Low values mean few edges, i.e. a blurry (or featureless) frame.
 */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const lap = gray[i - width]! + gray[i + width]! + gray[i - 1]! + gray[i + 1]! - 4 * gray[i]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}

/** 3×3 box blur; used by tests to synthesize a blurred frame. */
export function boxBlur(gray: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < width && yy < height) {
            s += gray[yy * width + xx]!;
            c++;
          }
        }
      }
      out[y * width + x] = s / c;
    }
  }
  return out;
}
