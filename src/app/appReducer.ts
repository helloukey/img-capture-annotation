import {
  annotationReducer,
  initialAnnotationState,
  type AnnotationAction,
  type AnnotationState,
} from '@/features/annotation/lib/annotationReducer';
import { admit, type SessionState } from '@/features/session/lib/sessionSelectors';
import type { Photo } from '@/shared/types';
import { SESSION_MAX_PHOTOS } from '@/features/session/lib/limits';

export type AppStep = 'camera' | 'review' | 'annotate';

export interface AppState {
  step: AppStep;
  session: SessionState;
}

export type AppAction =
  | { type: 'PHOTOS_ADDED'; photos: Photo[] }
  | { type: 'SELECT'; photoId: string }
  | { type: 'DELETE_PHOTO'; photoId: string; token: string }
  | { type: 'UNDO_DELETE_PHOTO'; token: string }
  | { type: 'FINALIZE_DELETE'; token: string }
  | { type: 'START_OVER' }
  | { type: 'GO'; step: AppStep }
  | { type: 'ANNOTATION'; photoId: string; action: AnnotationAction }
  | { type: 'RESET' };

export const initialAppState: AppState = {
  step: 'camera',
  session: { photos: [], selectedId: null, annotations: {}, pending: {} },
};

function withSession(state: AppState, session: Partial<SessionState>, step: AppStep = state.step): AppState {
  return { step, session: { ...state.session, ...session } };
}

/**
 * Root state machine: the current step plus the multi-photo session (contracts/session-store.md).
 * Annotation actions are routed to feature 001's annotationReducer, one slice per photo.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  const { session } = state;
  switch (action.type) {
    case 'PHOTOS_ADDED': {
      const { accepted } = admit(session, action.photos);
      const added = action.photos.slice(0, accepted);
      const first = added[0];
      if (!first) return state;
      const annotations = { ...session.annotations };
      for (const p of added) annotations[p.id] = initialAnnotationState(p.id);
      return withSession(
        state,
        { photos: [...session.photos, ...added], selectedId: first.id, annotations },
        'review',
      );
    }

    case 'SELECT':
      if (action.photoId === session.selectedId || !session.photos.some((p) => p.id === action.photoId))
        return state;
      return withSession(state, { selectedId: action.photoId });

    case 'DELETE_PHOTO': {
      const index = session.photos.findIndex((p) => p.id === action.photoId);
      const photo = session.photos[index];
      if (!photo) return state;
      const photos = session.photos.filter((p) => p.id !== photo.id);
      const { [photo.id]: removed, ...annotations } = session.annotations;
      const pending = {
        ...session.pending,
        [action.token]: {
          token: action.token,
          photo,
          index,
          annotations: removed ?? initialAnnotationState(photo.id),
        },
      };
      let selectedId = session.selectedId;
      if (selectedId === photo.id) selectedId = (photos[index] ?? photos[index - 1])?.id ?? null;
      return withSession(
        state,
        { photos, annotations, pending, selectedId },
        photos.length ? state.step : 'camera',
      );
    }

    case 'UNDO_DELETE_PHOTO': {
      const entry = session.pending[action.token];
      if (!entry || session.photos.length >= SESSION_MAX_PHOTOS) return state;
      const photos = session.photos.slice();
      photos.splice(Math.min(entry.index, photos.length), 0, entry.photo);
      const { [action.token]: _restored, ...pending } = session.pending;
      return withSession(
        state,
        {
          photos,
          pending,
          selectedId: entry.photo.id,
          annotations: { ...session.annotations, [entry.photo.id]: entry.annotations },
        },
        state.step === 'camera' ? 'review' : state.step,
      );
    }

    case 'FINALIZE_DELETE': {
      if (!session.pending[action.token]) return state;
      const { [action.token]: _done, ...pending } = session.pending;
      return withSession(state, { pending });
    }

    case 'START_OVER':
    case 'RESET':
      return initialAppState;

    case 'GO':
      if (action.step === state.step) return state;
      if (action.step !== 'camera' && session.photos.length === 0) return state;
      return { ...state, step: action.step };

    case 'ANNOTATION': {
      const slice: AnnotationState | undefined = session.annotations[action.photoId];
      if (!slice) return state;
      const next = annotationReducer(slice, action.action);
      if (next === slice) return state;
      return withSession(state, { annotations: { ...session.annotations, [action.photoId]: next } });
    }
  }
}
