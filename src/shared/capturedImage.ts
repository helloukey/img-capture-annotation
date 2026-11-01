import { decodeImage } from '@/features/camera/lib/decodeImage';
import type { CaptureMethod, CapturedImage, ImageSource } from './types';

export interface CapturedImageMeta {
  source: ImageSource;
  captureMethod: CaptureMethod;
  cameraLabel?: string;
  /** Already-decoded intrinsic size, to avoid decoding a large photo twice. */
  size?: { width: number; height: number };
}

export async function createCapturedImage(blob: Blob, meta: CapturedImageMeta): Promise<CapturedImage> {
  const { width, height } = meta.size ?? (await decodeImage(blob));
  return {
    id: crypto.randomUUID(),
    blob,
    objectUrl: URL.createObjectURL(blob),
    width,
    height,
    byteSize: blob.size,
    mimeType: blob.type || 'image/jpeg',
    source: meta.source,
    captureMethod: meta.captureMethod,
    capturedAt: Date.now(),
    ...(meta.cameraLabel ? { cameraLabel: meta.cameraLabel } : {}),
  };
}

export function releaseCapturedImage(image: CapturedImage | null | undefined): void {
  if (image) URL.revokeObjectURL(image.objectUrl);
}
