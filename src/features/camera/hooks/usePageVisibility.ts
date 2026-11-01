import { useSyncExternalStore } from 'react';

/** True while the page is visible. Used to release the camera when backgrounded (FR-006). */
export function usePageVisibility(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    },
    () => document.visibilityState !== 'hidden',
    () => true,
  );
}
