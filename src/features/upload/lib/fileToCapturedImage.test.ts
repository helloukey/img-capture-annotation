import { describe, expect, it } from 'vitest';
import { brokenImageBlob, fakeImageBlob } from '../../../../tests/fakes/fakeImage';
import { fileToCapturedImage, UploadError } from './fileToCapturedImage';

function asFile(blob: Blob, name: string, type = blob.type) {
  const file = new File([blob], name, { type });
  Object.assign(file, {
    __width: (blob as { __width?: number }).__width,
    __height: (blob as { __height?: number }).__height,
  });
  Object.defineProperty(file, 'size', { value: blob.size });
  return file;
}

describe('fileToCapturedImage', () => {
  it('turns an image file into an upload CapturedImage with its decoded size', async () => {
    const image = await fileToCapturedImage(asFile(fakeImageBlob(3000, 2000, 1_800_000), 'photo.jpg'));
    expect(image).toMatchObject({
      source: 'upload',
      captureMethod: 'file',
      width: 3000,
      height: 2000,
      byteSize: 1_800_000,
      mimeType: 'image/jpeg',
    });
  });

  it('rejects non-image files with a friendly error', async () => {
    await expect(
      fileToCapturedImage(new File(['hi'], 'notes.txt', { type: 'text/plain' })),
    ).rejects.toBeInstanceOf(UploadError);
  });

  it('rejects images that cannot be decoded', async () => {
    const err = await fileToCapturedImage(asFile(brokenImageBlob(), 'broken.jpg')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect((err as UploadError).message).toMatch(/couldn.t be opened/i);
  });

  it('tells a non-image apart from an unreadable image', async () => {
    const notImage = await fileToCapturedImage(new File(['hi'], 'notes.txt', { type: 'text/plain' })).catch(
      (e: UploadError) => e,
    );
    const unreadable = await fileToCapturedImage(asFile(brokenImageBlob(), 'broken.jpg')).catch(
      (e: UploadError) => e,
    );
    expect((notImage as UploadError).kind).toBe('not-image');
    expect((unreadable as UploadError).kind).toBe('unreadable');
  });
});
