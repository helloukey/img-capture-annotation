import { vi } from 'vitest';
import { fakeImageBlob } from './fakeImage';

export interface FakeImageCaptureOptions {
  photoWidth?: number;
  photoHeight?: number;
  fail?: boolean;
  /** Simulates the real shutter latency. */
  delayMs?: number;
}

/** Installs a global ImageCapture whose takePhoto returns a JPEG of the max photo size. */
export function installFakeImageCapture(opts: FakeImageCaptureOptions = {}) {
  const { photoWidth = 4032, photoHeight = 3024, fail = false, delayMs = 0 } = opts;
  const takePhoto = vi.fn(async (settings?: { imageWidth?: number; imageHeight?: number }) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (fail) throw new DOMException('takePhoto failed', 'UnknownError');
    return fakeImageBlob(settings?.imageWidth ?? photoWidth, settings?.imageHeight ?? photoHeight, 3_400_000);
  });
  const getPhotoCapabilities = vi.fn(async () => ({
    imageWidth: { min: 640, max: photoWidth, step: 1 },
    imageHeight: { min: 480, max: photoHeight, step: 1 },
  }));
  class FakeImageCapture {
    constructor(public track: MediaStreamTrack) {}
    takePhoto = takePhoto;
    getPhotoCapabilities = getPhotoCapabilities;
  }
  vi.stubGlobal('ImageCapture', FakeImageCapture);
  return { takePhoto, getPhotoCapabilities };
}
