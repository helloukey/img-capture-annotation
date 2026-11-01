/** A Blob that the test createImageBitmap/Image stubs decode to the given size. */
export interface SizedBlob extends Blob {
  __width: number;
  __height: number;
}

export function fakeImageBlob(
  width: number,
  height: number,
  bytes = 2_000_000,
  type = 'image/jpeg',
): SizedBlob {
  const blob = new Blob([new Uint8Array(Math.min(bytes, 64))], { type }) as SizedBlob;
  Object.defineProperty(blob, 'size', { value: bytes });
  blob.__width = width;
  blob.__height = height;
  return blob;
}

export function brokenImageBlob(type = 'image/jpeg'): SizedBlob {
  return fakeImageBlob(0, 0, 10, type);
}
