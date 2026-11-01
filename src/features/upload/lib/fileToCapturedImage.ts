import { createCapturedImage } from '@/shared/capturedImage';
import type { CapturedImage } from '@/shared/types';

export class UploadError extends Error {
  override readonly name = 'UploadError';
}

/** Turns a chosen file into a CapturedImage that flows through the same review/annotate steps (FR-012). */
export async function fileToCapturedImage(file: File): Promise<CapturedImage> {
  if (!file.type.startsWith('image/')) {
    throw new UploadError('That file isn’t an image. Choose a JPEG, PNG, HEIC or WebP photo.');
  }
  try {
    return await createCapturedImage(file, { source: 'upload', captureMethod: 'file' });
  } catch (cause) {
    throw new UploadError('That file couldn’t be opened as an image.', { cause });
  }
}
