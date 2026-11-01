export class ImageDecodeError extends Error {
  override readonly name = 'ImageDecodeError';
}

export interface DecodedSize {
  width: number;
  height: number;
}

async function decodeWithImageElement(blob: Blob): Promise<DecodedSize> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // rejects for corrupt or unsupported images
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new ImageDecodeError('The image could not be decoded.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Reads the real intrinsic size of an encoded image, honoring EXIF orientation.
 * This is what the UI reports, never the requested capture size (Constitution II).
 */
export async function decodeImage(blob: Blob): Promise<DecodedSize> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (size.width > 0 && size.height > 0) return size;
    } catch {
      // Fall through to the <img> path (older Safari, unusual formats).
    }
  }
  const size = await decodeWithImageElement(blob);
  if (size.width <= 0 || size.height <= 0) throw new ImageDecodeError('The image has no pixels.');
  return size;
}
