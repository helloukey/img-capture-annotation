import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { SESSION_MAX_PHOTOS, UNDO_WINDOW_MS } from '@/features/session/lib/limits';
import { photoProcessor } from '@/features/session/lib/defaultPhotoProcessor';
import {
  admit,
  annotationCount,
  fullReason,
  heldBytes,
  selectedPhoto,
  totalAnnotations,
  type FullReason,
} from '@/features/session/lib/sessionSelectors';
import type { Photo } from '@/shared/types';
import { notify } from '@/shared/ui/toast';
import { appReducer, initialAppState, type AppAction, type AppState, type AppStep } from './appReducer';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  /** Latest state, for event handlers that run after a render (undo toasts, bursts). */
  stateRef: { readonly current: AppState };
}

const AppContext = createContext<AppContextValue | null>(null);

/** Revokes every object URL the session holds and drops all background-processing results. */
function releaseAll(state: AppState) {
  for (const p of state.session.photos) URL.revokeObjectURL(p.objectUrl);
  for (const d of Object.values(state.session.pending)) URL.revokeObjectURL(d.photo.objectUrl);
  photoProcessor.releaseAll();
}

/** Mounted ABOVE every step so the session survives "Add more" trips to the camera (research R1). */
export function AppProvider({
  children,
  initialState = initialAppState,
}: {
  children: ReactNode;
  initialState?: AppState;
}) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const initialPhotos = useRef(initialState.session.photos);
  useEffect(() => {
    if (initialPhotos.current.length) photoProcessor.enqueue(initialPhotos.current);
    const ref = stateRef;
    return () => releaseAll(ref.current);
  }, []);

  const selectedId = state.session.selectedId;
  useEffect(() => {
    if (selectedId) photoProcessor.prioritize(selectedId);
  }, [selectedId]);

  const value = useMemo(() => ({ state, dispatch, stateRef }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export interface AddResult {
  added: number;
  skipped: number;
  reason: FullReason | null;
}

/** Session operations with their side effects (contracts/session-store.md). */
export function useSession() {
  const { state, dispatch, stateRef } = useApp();
  const { session } = state;

  const finalize = useCallback(
    (token: string) => {
      const entry = stateRef.current.session.pending[token];
      dispatch({ type: 'FINALIZE_DELETE', token });
      if (entry) {
        URL.revokeObjectURL(entry.photo.objectUrl);
        photoProcessor.release(entry.photo.id);
      }
    },
    [dispatch, stateRef],
  );

  const addPhotos = useCallback(
    (photos: Photo[]): AddResult => {
      const { accepted, rejected, reason } = admit(stateRef.current.session, photos);
      const kept = photos.slice(0, accepted);
      // Photos that don't fit are never stored, so release them right away.
      for (const p of photos.slice(accepted)) URL.revokeObjectURL(p.objectUrl);
      if (kept.length) {
        dispatch({ type: 'PHOTOS_ADDED', photos: kept });
        photoProcessor.enqueue(kept);
      }
      return { added: kept.length, skipped: rejected, reason };
    },
    [dispatch, stateRef],
  );

  const deletePhoto = useCallback(
    (photoId: string) => {
      const token = crypto.randomUUID();
      dispatch({ type: 'DELETE_PHOTO', photoId, token });
      notify.undo(
        'Photo deleted',
        () => {
          if (stateRef.current.session.photos.length >= SESSION_MAX_PHOTOS) {
            notify.error('Session is full — delete a photo first');
            finalize(token);
            return;
          }
          dispatch({ type: 'UNDO_DELETE_PHOTO', token });
        },
        { durationMs: UNDO_WINDOW_MS, onDismiss: () => finalize(token) },
      );
    },
    [dispatch, finalize, stateRef],
  );

  const startOver = useCallback(() => {
    releaseAll(stateRef.current);
    dispatch({ type: 'START_OVER' });
  }, [dispatch, stateRef]);

  const select = useCallback((photoId: string) => dispatch({ type: 'SELECT', photoId }), [dispatch]);
  const go = useCallback((step: AppStep) => dispatch({ type: 'GO', step }), [dispatch]);

  return {
    photos: session.photos,
    selected: selectedPhoto(session),
    selectedId: session.selectedId,
    isFull: fullReason(session) !== null,
    fullReason: fullReason(session),
    heldBytes: heldBytes(session),
    totalAnnotations: totalAnnotations(session),
    annotationCount: (photoId: string) => annotationCount(session, photoId),
    addPhotos,
    deletePhoto,
    startOver,
    select,
    go,
  };
}
