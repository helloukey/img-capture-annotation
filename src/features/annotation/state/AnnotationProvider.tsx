import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  annotationReducer,
  initialAnnotationState,
  type AnnotationAction,
  type AnnotationState,
} from '../lib/annotationReducer';

interface AnnotationContextValue {
  state: AnnotationState;
  dispatch: Dispatch<AnnotationAction>;
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null);

export interface AnnotationProviderProps {
  imageId: string;
  /** Reports the annotation count so the app flow can guard destructive steps (FR-028). */
  onCountChange?: (count: number) => void;
  initialState?: AnnotationState;
  children: ReactNode;
}

/**
 * Single source of truth for the canvas and the list. Mount it ABOVE the review/annotate views,
 * keyed by image id, so annotations survive Annotate → Review → Annotate (data-model.md §4).
 */
export function AnnotationProvider({
  imageId,
  onCountChange,
  initialState,
  children,
}: AnnotationProviderProps) {
  const [state, dispatch] = useReducer(annotationReducer, initialState ?? initialAnnotationState(imageId));

  useEffect(() => {
    if (state.imageId !== imageId) dispatch({ type: 'RESET', imageId });
  }, [imageId, state.imageId]);

  const count = state.items.length;
  useEffect(() => {
    onCountChange?.(count);
  }, [count, onCountChange]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>;
}

export function useAnnotationContext(): AnnotationContextValue {
  const ctx = useContext(AnnotationContext);
  if (!ctx) throw new Error('useAnnotations must be used inside <AnnotationProvider>');
  return ctx;
}
