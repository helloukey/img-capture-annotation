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
export type CaptureMethod = 'image-capture' | 'canvas' | 'file';

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
  /** Whether the capturing camera supported torch control (drives the brightness tip). */
  torchAvailable?: boolean;
}
