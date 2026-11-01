import type { CaptureMethod } from '@/shared/types';
import type { DecodedSize } from './decodeImage';

/** Above the constitution's 0.92 floor; visually lossless for photos (research R3). */
export const JPEG_QUALITY = 0.95;

interface PhotoCapabilitiesLike {
  imageWidth?: { max?: number };
  imageHeight?: { max?: number };
}

interface ImageCaptureLike {
  takePhoto(settings?: { imageWidth?: number; imageHeight?: number }): Promise<Blob>;
  getPhotoCapabilities(): Promise<PhotoCapabilitiesLike>;
}

type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

export interface CaptureInput {
  track: MediaStreamTrack;
  video: HTMLVideoElement;
  decode: (blob: Blob) => Promise<DecodedSize>;
}

export interface CaptureResult extends DecodedSize {
  blob: Blob;
  captureMethod: CaptureMethod;
}

function getImageCapture(): ImageCaptureCtor | undefined {
  return (globalThis as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
}

async function takeFullResolutionPhoto(Ctor: ImageCaptureCtor, track: MediaStreamTrack): Promise<Blob> {
  const capture = new Ctor(track);
  let settings: { imageWidth?: number; imageHeight?: number } | undefined;
  try {
    const caps = await capture.getPhotoCapabilities();
    const w = caps.imageWidth?.max;
    const h = caps.imageHeight?.max;
    if (w && h) settings = { imageWidth: w, imageHeight: h };
  } catch {
    // Some devices don't report photo capabilities; let takePhoto use its default.
  }
  return settings ? capture.takePhoto(settings) : capture.takePhoto();
}

/** Draws the current frame at the stream's real resolution (never the element's CSS size). */
export function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return Promise.reject(new Error('The camera has not produced a frame yet.'));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D is not available.'));
  ctx.drawImage(video, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * Highest-resolution still capture (research R3): ImageCapture.takePhoto at the max photo
 * capabilities where supported, otherwise (or if it yields fewer pixels than the live stream)
 * a full-resolution canvas frame. The returned size is decoded from the actual photo.
 */
export async function capturePhoto({ track, video, decode }: CaptureInput): Promise<CaptureResult> {
  const Ctor = getImageCapture();
  if (Ctor) {
    try {
      const blob = await takeFullResolutionPhoto(Ctor, track);
      const size = await decode(blob);
      const streamPixels = video.videoWidth * video.videoHeight;
      if (size.width * size.height >= streamPixels) {
        return { blob, captureMethod: 'image-capture', ...size };
      }
    } catch {
      // Fall back to the canvas path below.
    }
  }
  const blob = await captureVideoFrame(video);
  const size = await decode(blob);
  return { blob, captureMethod: 'canvas', ...size };
}
