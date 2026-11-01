import type { Rect } from './geometry';

export const LABEL_MAX_LENGTH = 50;

/** A labeled rectangle in intrinsic image pixels (data-model.md §3). */
export interface Annotation extends Rect {
  id: string;
  /** Trimmed, 0–50 chars. Empty displays as "Untitled {ordinal}". */
  label: string;
  createdAt: number;
  /** 1-based creation index, never reused within a session. */
  ordinal: number;
}

export interface DeletedSnapshot {
  token: string;
  entries: { item: Annotation; index: number }[];
}

export interface AnnotationState {
  imageId: string | null;
  items: Annotation[];
  selectedId: string | null;
  lastDeleted: DeletedSnapshot | null;
  nextOrdinal: number;
}

export type AnnotationAction =
  | { type: 'RESET'; imageId: string }
  | { type: 'CREATE'; id: string; rect: Rect; createdAt: number }
  | { type: 'UPDATE_RECT'; id: string; rect: Rect }
  | { type: 'RENAME'; id: string; label: string }
  | { type: 'SELECT'; id: string | null }
  | { type: 'DELETE'; id: string; token?: string }
  | { type: 'CLEAR_ALL'; token?: string }
  | { type: 'UNDO_DELETE'; token?: string }
  | { type: 'DISMISS_UNDO'; token?: string };

export function initialAnnotationState(imageId: string | null): AnnotationState {
  return { imageId, items: [], selectedId: null, lastDeleted: null, nextOrdinal: 1 };
}

export function normalizeLabel(label: string): string {
  return label.trim().slice(0, LABEL_MAX_LENGTH);
}

export function displayName(a: Pick<Annotation, 'label' | 'ordinal'>): string {
  return a.label || `Untitled ${a.ordinal}`;
}

const tokenFor = (entries: DeletedSnapshot['entries'], ordinal: number) =>
  `${ordinal}:${entries.map((e) => e.item.id).join(',')}`;

function updateItem(
  state: AnnotationState,
  id: string,
  patch: (a: Annotation) => Annotation,
): AnnotationState {
  const index = state.items.findIndex((a) => a.id === id);
  const current = state.items[index];
  if (!current) return state;
  const next = patch(current);
  if (next === current) return state;
  const items = state.items.slice();
  items[index] = next;
  return { ...state, items };
}

/** Pure annotation store (contracts/annotation-store.md). */
export function annotationReducer(state: AnnotationState, action: AnnotationAction): AnnotationState {
  switch (action.type) {
    case 'RESET':
      return initialAnnotationState(action.imageId);

    case 'CREATE': {
      const item: Annotation = {
        id: action.id,
        label: '',
        createdAt: action.createdAt,
        ordinal: state.nextOrdinal,
        x: action.rect.x,
        y: action.rect.y,
        width: action.rect.width,
        height: action.rect.height,
      };
      return {
        ...state,
        items: [...state.items, item],
        selectedId: item.id,
        nextOrdinal: state.nextOrdinal + 1,
      };
    }

    case 'UPDATE_RECT':
      return updateItem(state, action.id, (a) => ({ ...a, ...action.rect }));

    case 'RENAME': {
      const label = normalizeLabel(action.label);
      return updateItem(state, action.id, (a) => (a.label === label ? a : { ...a, label }));
    }

    case 'SELECT':
      if (action.id === state.selectedId) return state;
      if (action.id !== null && !state.items.some((a) => a.id === action.id)) return state;
      return { ...state, selectedId: action.id };

    case 'DELETE': {
      const index = state.items.findIndex((a) => a.id === action.id);
      const item = state.items[index];
      if (!item) return state;
      const entries = [{ item, index }];
      return {
        ...state,
        items: state.items.filter((a) => a.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        lastDeleted: { token: action.token ?? tokenFor(entries, state.nextOrdinal), entries },
      };
    }

    case 'CLEAR_ALL': {
      if (state.items.length === 0) return state;
      const entries = state.items.map((item, index) => ({ item, index }));
      return {
        ...state,
        items: [],
        selectedId: null,
        lastDeleted: { token: action.token ?? tokenFor(entries, state.nextOrdinal), entries },
      };
    }

    case 'UNDO_DELETE': {
      const snapshot = state.lastDeleted;
      if (!snapshot || (action.token !== undefined && action.token !== snapshot.token)) return state;
      const items = state.items.slice();
      for (const { item, index } of [...snapshot.entries].sort((a, b) => a.index - b.index)) {
        items.splice(Math.min(index, items.length), 0, item);
      }
      return { ...state, items, lastDeleted: null };
    }

    case 'DISMISS_UNDO':
      if (!state.lastDeleted || (action.token !== undefined && action.token !== state.lastDeleted.token))
        return state;
      return { ...state, lastDeleted: null };
  }
}
