import { createContext, useContext, useMemo, type Dispatch, type ReactNode } from 'react';
import { useApp } from '@/app/AppContext';
import {
  initialAnnotationState,
  type AnnotationAction,
  type AnnotationState,
} from '../lib/annotationReducer';

interface AnnotationContextValue {
  /** The selected photo's annotations. */
  state: AnnotationState;
  /** Acts on the selected photo. */
  dispatch: Dispatch<AnnotationAction>;
  photoId: string | null;
  /** Acts on a specific photo, e.g. an Undo for a photo that is no longer selected (FR-025). */
  dispatchTo(photoId: string, action: AnnotationAction): void;
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null);

/**
 * Adapter over the session store (contracts/session-store.md): exposes the selected photo's
 * annotation slice with feature 001's API, so the canvas, list, shortcuts and export are unchanged.
 */
export function AnnotationProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const photoId = state.session.selectedId;
  const slice = photoId ? state.session.annotations[photoId] : undefined;

  const value = useMemo<AnnotationContextValue>(
    () => ({
      state: slice ?? initialAnnotationState(photoId),
      photoId,
      dispatch: (action) => {
        if (photoId) dispatch({ type: 'ANNOTATION', photoId, action });
      },
      dispatchTo: (target, action) => dispatch({ type: 'ANNOTATION', photoId: target, action }),
    }),
    [slice, photoId, dispatch],
  );
  return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>;
}

export function useAnnotationContext(): AnnotationContextValue {
  const ctx = useContext(AnnotationContext);
  if (!ctx) throw new Error('useAnnotations must be used inside <AnnotationProvider>');
  return ctx;
}
