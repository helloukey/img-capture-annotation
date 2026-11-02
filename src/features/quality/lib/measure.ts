import type { CapturedImage } from '@/shared/types';
import { laplacianVariance, meanLuma, toGrayscale } from './metrics';
import { ANALYSIS_LONG_SIDE } from './thresholds';
import type { ImageMetrics } from './types';

async function loadDrawable(
  blob: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number; release(): void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // fall through
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

/**
 * Decodes the photo, draws a copy downscaled to a 512px long side, and computes brightness and
 * sharpness. The full-resolution original is never modified (Constitution II).
 */
export async function measureImage(image: CapturedImage): Promise<ImageMetrics> {
  const base: ImageMetrics = {
    width: image.width,
    height: image.height,
    byteSize: image.byteSize,
    brightnessPct: null,
    sharpness: null,
  };
  const started = performance.now();
  try {
    const drawable = await loadDrawable(image.blob);
    const scale = Math.min(1, ANALYSIS_LONG_SIDE / Math.max(drawable.width, drawable.height));
    const w = Math.max(1, Math.round(drawable.width * scale));
    const h = Math.max(1, Math.round(drawable.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      drawable.release();
      return base;
    }
    // High-quality (area-averaging) downscale. The default "low" quality skips pixels when
    // shrinking ~8×, and the resulting aliasing inflated sharpness scores ~4× in calibration.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawable.source, 0, 0, w, h);
    drawable.release();
    const { data } = ctx.getImageData(0, 0, w, h);
    const metrics = {
      ...base,
      brightnessPct: meanLuma(data),
      sharpness: laplacianVariance(toGrayscale(data), w, h),
    };
    if (import.meta.env.DEV) {
      console.info(
        `[quality] analyzed ${image.width}×${image.height} in ${Math.round(performance.now() - started)} ms`,
        metrics,
      );
    }
    return metrics;
  } catch {
    return base;
  }
}
