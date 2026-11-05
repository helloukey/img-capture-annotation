import { useCallback, useMemo } from 'react';
import { notify } from '@/shared/ui/toast';
import { displayName, type Annotation } from '../lib/annotationReducer';
import type { Rect } from '../lib/geometry';
import { useAnnotationContext } from '../state/AnnotationProvider';

export { UNDO_WINDOW_MS } from '@/features/session/lib/limits';
import { UNDO_WINDOW_MS } from '@/features/session/lib/limits';

export function useAnnotations() {
  const { state, dispatch, photoId, dispatchTo } = useAnnotationContext();

  const selected = useMemo<Annotation | null>(
    () => state.items.find((a) => a.id === state.selectedId) ?? null,
    [state.items, state.selectedId],
  );

  const create = useCallback(
    (rect: Rect) => dispatch({ type: 'CREATE', id: crypto.randomUUID(), rect, createdAt: Date.now() }),
    [dispatch],
  );

  const select = useCallback((id: string | null) => dispatch({ type: 'SELECT', id }), [dispatch]);

  const rename = useCallback(
    (id: string, label: string) => dispatch({ type: 'RENAME', id, label }),
    [dispatch],
  );

  /** Undo targets the photo the annotation was deleted from, even after switching photos (FR-025). */
  const offerUndo = useCallback(
    (message: string, token: string) => {
      const owner = photoId;
      if (!owner) return;
      notify.undo(message, () => dispatchTo(owner, { type: 'UNDO_DELETE', token }), {
        durationMs: UNDO_WINDOW_MS,
        onDismiss: () => dispatchTo(owner, { type: 'DISMISS_UNDO', token }),
      });
    },
    [photoId, dispatchTo],
  );

  /** Deletes with a 5 s Undo toast (FR-026). */
  const deleteWithUndo = useCallback(
    (id: string) => {
      const token = crypto.randomUUID();
      dispatch({ type: 'DELETE', id, token });
      offerUndo('Annotation deleted', token);
    },
    [dispatch, offerUndo],
  );

  const clearAllWithUndo = useCallback(() => {
    const token = crypto.randomUUID();
    const n = state.items.length;
    dispatch({ type: 'CLEAR_ALL', token });
    offerUndo(`${n} annotation${n === 1 ? '' : 's'} cleared`, token);
  }, [dispatch, offerUndo, state.items.length]);

  return { state, dispatch, selected, displayName, create, select, rename, deleteWithUndo, clearAllWithUndo };
}
