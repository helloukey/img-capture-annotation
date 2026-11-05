export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImageSource = 'camera' | 'upload';
export type CaptureMethod = 'image-capture' | 'canvas' | 'file' | 'burst';

/**
 * The single photo being worked on (data-model.md §1). Immutable once created.
 * `width`/`height` are intrinsic pixels after EXIF orientation is applied.
 */
export interface CapturedImage {
  id: string;
  blob: Blob;
  /** MUST be revoked when the image is replaced or discarded. */
  objectUrl: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: string;
  source: ImageSource;
  captureMethod: CaptureMethod;
  capturedAt: number;
  cameraLabel?: string;
  /** Shared by every photo taken in one burst. */
  burstId?: string;
  /** 1-based position within its burst. */
  burstIndex?: number;
  /** Whether the capturing camera supported torch control (drives the brightness tip). */
  torchAvailable?: boolean;
}

/** One photo in a multi-image session (feature 002). */
export type Photo = CapturedImage;
