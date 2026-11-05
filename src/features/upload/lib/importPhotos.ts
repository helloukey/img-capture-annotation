import { admit, type SessionState } from '@/features/session/lib/sessionSelectors';
import type { Photo } from '@/shared/types';
import { UploadError } from './fileToCapturedImage';

export interface SkippedCounts {
  notImage: number;
  unreadable: number;
  sessionFull: number;
  memory: number;
}

/**
 * Converts several chosen files in order, within the session limits (FR-031). Each file is checked
 * against the limits by its size *before* it is decoded, so files that can't fit are never decoded.
 */
export async function importPhotos(
  files: readonly File[],
  session: SessionState,
  convert: (file: File) => Promise<Photo>,
): Promise<{ photos: Photo[]; skipped: SkippedCounts }> {
  const photos: Photo[] = [];
  const skipped: SkippedCounts = { notImage: 0, unreadable: 0, sessionFull: 0, memory: 0 };
  for (const file of files) {
    const fit = admit(session, [...photos, { byteSize: file.size }]);
    if (fit.accepted <= photos.length) {
      if (fit.reason === 'memory') skipped.memory++;
      else skipped.sessionFull++;
      continue;
    }
    try {
      photos.push(await convert(file));
    } catch (err) {
      if (err instanceof UploadError && err.kind === 'not-image') skipped.notImage++;
      else skipped.unreadable++;
    }
  }
  return { photos, skipped };
}

/** One-line result for the toast, or null when every file was added. */
export function importSummary(added: number, s: SkippedCounts): string | null {
  const parts = [
    s.notImage && `${s.notImage} skipped: not an image`,
    s.unreadable && `${s.unreadable} skipped: couldn’t be opened`,
    s.sessionFull && `${s.sessionFull} skipped: session full`,
    s.memory && `${s.memory} skipped: memory limit`,
  ].filter(Boolean);
  return parts.length ? [`${added} added`, ...parts].join(' · ') : null;
}
