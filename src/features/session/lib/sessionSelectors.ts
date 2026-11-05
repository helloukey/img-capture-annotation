import type { AnnotationState } from '@/features/annotation/lib/annotationReducer';
import type { Photo } from '@/shared/types';
import { SESSION_MAX_BYTES, SESSION_MAX_PHOTOS } from './limits';

/** A deleted photo still inside its undo window (data-model.md §3). */
export interface PendingDeletion {
  token: string;
  photo: Photo;
  index: number;
  annotations: AnnotationState;
}

export interface SessionState {
  /** Capture order. */
  photos: Photo[];
  selectedId: string | null;
  /** One annotation slice per photo, driven by feature 001's annotationReducer. */
  annotations: Record<string, AnnotationState>;
  pending: Record<string, PendingDeletion>;
}

export type FullReason = 'count' | 'memory';

export function selectedPhoto(s: SessionState): Photo | null {
  return s.photos.find((p) => p.id === s.selectedId) ?? null;
}

/** Encoded bytes held: live photos plus photos inside their undo window (research R6). */
export function heldBytes(s: SessionState): number {
  let total = 0;
  for (const p of s.photos) total += p.byteSize;
  for (const d of Object.values(s.pending)) total += d.photo.byteSize;
  return total;
}

export function fullReason(s: SessionState): FullReason | null {
  if (s.photos.length >= SESSION_MAX_PHOTOS) return 'count';
  if (heldBytes(s) >= SESSION_MAX_BYTES) return 'memory';
  return null;
}

export function remainingSlots(s: SessionState): number {
  return Math.max(0, SESSION_MAX_PHOTOS - s.photos.length);
}

export function annotationCount(s: SessionState, photoId: string): number {
  return s.annotations[photoId]?.items.length ?? 0;
}

export function totalAnnotations(s: SessionState): number {
  let n = 0;
  for (const a of Object.values(s.annotations)) n += a.items.length;
  return n;
}

/**
 * How many of `incoming` (in order) fit within the photo-count and byte limits. Stops at the first
 * item that doesn't fit, so order is preserved.
 */
export function admit(
  s: SessionState,
  incoming: readonly { byteSize: number }[],
): { accepted: number; rejected: number; reason: FullReason | null } {
  let count = s.photos.length;
  let bytes = heldBytes(s);
  let accepted = 0;
  let reason: FullReason | null = null;
  for (const item of incoming) {
    if (count >= SESSION_MAX_PHOTOS) {
      reason = 'count';
      break;
    }
    if (bytes + item.byteSize > SESSION_MAX_BYTES) {
      reason = 'memory';
      break;
    }
    count++;
    bytes += item.byteSize;
    accepted++;
  }
  return { accepted, rejected: incoming.length - accepted, reason };
}
