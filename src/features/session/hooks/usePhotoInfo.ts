import { useCallback, useSyncExternalStore } from 'react';
import { photoProcessor } from '../lib/defaultPhotoProcessor';
import type { PhotoInfo } from '../lib/photoProcessor';

const subscribe = (listener: () => void) => photoProcessor.subscribe(listener);

/** Thumbnail and metrics for one photo, updated as background processing completes. */
export function usePhotoInfo(photoId: string | null | undefined): PhotoInfo | undefined {
  const get = useCallback(() => (photoId ? photoProcessor.get(photoId) : undefined), [photoId]);
  return useSyncExternalStore(subscribe, get, get);
}

/** Every listed photo's info, for strips. Re-renders only when one of them changes. */
export function usePhotoInfos(photoIds: readonly string[]): Record<string, PhotoInfo | undefined> {
  // A primitive signature keeps the snapshot stable between unrelated store updates.
  const signature = useSyncExternalStore(subscribe, () =>
    photoIds
      .map((id) => {
        const i = photoProcessor.get(id);
        return i ? `${i.status}:${i.thumbnailUrl ?? ''}` : '-';
      })
      .join('|'),
  );
  void signature;
  const out: Record<string, PhotoInfo | undefined> = {};
  for (const id of photoIds) out[id] = photoProcessor.get(id);
  return out;
}
