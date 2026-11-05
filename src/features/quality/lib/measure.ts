import type { CapturedImage } from '@/shared/types';
import { laplacianVariance, meanLuma, toGrayscale } from './metrics';
import { ANALYSIS_LONG_SIDE } from './thresholds';
import type { ImageMetrics } from './types';

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

/** Decodes once (EXIF orientation applied); callers MUST call close(). */
export async function decodeForProcessing(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function scaledCanvas(source: CanvasImageSource, w: number, h: number, longSide: number, readBack: boolean) {
  const scale = Math.min(1, longSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', readBack ? { willReadFrequently: true } : undefined);
  if (!ctx) return null;
  // High-quality (area-averaging) downscale. The default "low" quality skips pixels when
  // shrinking ~8×, and the resulting aliasing inflated sharpness scores ~4× in calibration.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, cw, ch);
  return { canvas, ctx, w: cw, h: ch };
}

/** Brightness and sharpness from a 512 px copy. Null when 2D canvas is unavailable. */
export function analyzeSource(
  source: CanvasImageSource,
  w: number,
  h: number,
): { brightnessPct: number; sharpness: number } | null {
  const c = scaledCanvas(source, w, h, ANALYSIS_LONG_SIDE, true);
  if (!c) return null;
  const { data } = c.ctx.getImageData(0, 0, c.w, c.h);
  return { brightnessPct: meanLuma(data), sharpness: laplacianVariance(toGrayscale(data), c.w, c.h) };
}

/** A small JPEG preview for thumbnails, so strips never render full-resolution images. */
export function renderThumbnail(
  source: CanvasImageSource,
  w: number,
  h: number,
  longSide: number,
): Promise<Blob> {
  const c = scaledCanvas(source, w, h, longSide, false);
  if (!c) return Promise.reject(new Error('Canvas 2D is not available.'));
  return new Promise((resolve, reject) =>
    c.canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode thumbnail.'))),
      'image/jpeg',
      0.8,
    ),
  );
}

/**
 * Decodes the photo and computes brightness and sharpness on a downscaled copy. The
 * full-resolution original is never modified (Constitution II).
 */
export async function measureImage(image: CapturedImage): Promise<ImageMetrics> {
  const base: ImageMetrics = {
    width: image.width,
    height: image.height,
    byteSize: image.byteSize,
    brightnessPct: null,
    sharpness: null,
  };
  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeForProcessing(image.blob);
    const pixels = analyzeSource(decoded.source, decoded.width, decoded.height);
    return pixels ? { ...base, ...pixels } : base;
  } catch {
    return base;
  } finally {
    decoded?.close();
  }
}
