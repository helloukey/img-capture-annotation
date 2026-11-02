// Reproduces the sharpness calibration behind QUALITY_THRESHOLDS.sharpness.
// Usage: node scripts/calibrate-sharpness.mjs path/to/photo.jpg
// Scores the photo and Gaussian-blurred copies with the same pipeline as
// src/features/quality/lib (512px long side, high-quality downscale, Rec. 709 luma,
// 3×3 Laplacian variance) in headless Chromium.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/calibrate-sharpness.mjs <photo.jpg>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const rows = await page.evaluate(async (b64) => {
  const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const W = bmp.width;
  const H = bmp.height;
  const score = (src) => {
    const s = Math.min(1, 512 / Math.max(W, H));
    const w = Math.round(W * s);
    const h = Math.round(H * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < w * h; i++, j += 4)
      g[i] = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2];
    let sum = 0;
    let sq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let xx = 1; xx < w - 1; xx++) {
        const i = y * w + xx;
        const l = g[i - w] + g[i + w] + g[i - 1] + g[i + 1] - 4 * g[i];
        sum += l;
        sq += l * l;
        n++;
      }
    }
    const m = sum / n;
    return Math.round(sq / n - m * m);
  };
  const out = [[`original ${W}×${H}`, score(bmp)]];
  for (const px of [2, 4, 6, 8, 12]) {
    const c = new OffscreenCanvas(W, H);
    const x = c.getContext('2d');
    x.filter = `blur(${px}px)`;
    x.drawImage(bmp, 0, 0);
    out.push([`focus blur σ=${px}px`, score(await createImageBitmap(c))]);
  }
  return out;
}, readFileSync(file).toString('base64'));

for (const [label, value] of rows) console.log(label.padEnd(24), value);
await browser.close();
