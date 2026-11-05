import type { AppState, AppStep } from '@/app/appReducer';
import { initialAnnotationState, type AnnotationState } from '@/features/annotation/lib/annotationReducer';
import type { Photo } from '@/shared/types';

let n = 0;
/** A complete Photo with sensible defaults; override any field. */
export function makePhoto(overrides: Partial<Photo> = {}): Photo {
  n += 1;
  const id = overrides.id ?? `photo-${n}`;
  return {
    id,
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    objectUrl: `blob:${id}`,
    width: 4000,
    height: 3000,
    byteSize: 2_000_000,
    mimeType: 'image/jpeg',
    source: 'camera',
    captureMethod: 'image-capture',
    capturedAt: 1_700_000_000_000 + n,
    ...overrides,
  };
}

/** Builds an AppState holding `photos`, with optional per-photo annotation slices. */
export function makeAppState(
  photos: Photo[],
  opts: { step?: AppStep; selectedId?: string; annotations?: Record<string, AnnotationState> } = {},
): AppState {
  const annotations: Record<string, AnnotationState> = {};
  for (const p of photos) annotations[p.id] = opts.annotations?.[p.id] ?? initialAnnotationState(p.id);
  return {
    step: opts.step ?? (photos.length ? 'review' : 'camera'),
    session: {
      photos,
      selectedId: opts.selectedId ?? photos[0]?.id ?? null,
      annotations,
      pending: {},
    },
  };
}
