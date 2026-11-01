import { useCallback, useMemo } from 'react';
import { notify } from '@/shared/ui/toast';
import { displayName, type Annotation } from '../lib/annotationReducer';
import type { Rect } from '../lib/geometry';
import { useAnnotationContext } from '../state/AnnotationProvider';

export const UNDO_WINDOW_MS = 5000;

export function useAnnotations() {
  const { state, dispatch } = useAnnotationContext();

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

  const offerUndo = useCallback(
    (message: string, token: string) =>
      notify.undo(message, () => dispatch({ type: 'UNDO_DELETE', token }), {
        durationMs: UNDO_WINDOW_MS,
        onDismiss: () => dispatch({ type: 'DISMISS_UNDO', token }),
      }),
    [dispatch],
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
