# Contract: Session Store (`appReducer` + `AppProvider`)

**Module**: `src/app/` and `src/features/session/` · **Implements**: FR-012, FR-013, FR-015 to
FR-027, FR-032 · **Research**: R1, R2, R6, R10 · **Replaces**: feature 001's `appFlowReducer`
(its behavior for a single photo is kept)

## Pure reducer (`src/app/appReducer.ts`)

```ts
type AppAction =
  | { type: 'PHOTOS_ADDED'; photos: Photo[] }               // append ≤ limits, select first new, step → review
  | { type: 'SELECT'; photoId: string }
  | { type: 'DELETE_PHOTO'; photoId: string; token: string }
  | { type: 'UNDO_DELETE_PHOTO'; token: string }
  | { type: 'FINALIZE_DELETE'; token: string }
  | { type: 'START_OVER' }
  | { type: 'GO'; step: AppStep }
  | { type: 'ANNOTATION'; photoId: string; action: AnnotationAction } // routed to feature 001's annotationReducer
  | { type: 'RESET' };

function appReducer(state: AppState, action: AppAction): AppState;
```

**Rules** (each is a unit test):

1. **`PHOTOS_ADDED`**:
   - It appends only as many photos as fit both `SESSION_MAX_PHOTOS` and `SESSION_MAX_BYTES`
     (measured against `heldBytes`).
   - Photos that don't fit are not added. Callers check limits first with
     `admit(session, photos)` (below), so in practice nothing is dropped.
   - Adding an empty list is a no-op that returns the same state object.
2. **New photos**: every added photo gets `initialAnnotationState(photo.id)`.
3. **`DELETE_PHOTO`**:
   - Moves `{ photo, index, annotations }` into `pending[token]`.
   - Selection moves to the next photo, or the previous one if the deleted photo was last.
   - If no photos remain, `step` becomes `camera` and `selectedId` becomes `null`.
4. **`UNDO_DELETE_PHOTO`**:
   - Restores the photo and its annotations at `min(index, photos.length)` and selects it.
   - It is a no-op (same state object) if the token is unknown or the session is at
     `SESSION_MAX_PHOTOS`.
   - If the restore happens while on the camera step, `step` returns to `review`.
5. **`FINALIZE_DELETE`**: removes `pending[token]` and does nothing else. Revoking the URLs is the
   provider's side effect (see below).
6. **`START_OVER` and `RESET`**: return `initialAppState` (step `camera`, empty session).
7. **`GO`**: `review` and `annotate` require `photos.length > 0`; otherwise it's a no-op. `camera` is
   always allowed, and the session is kept.
8. **`ANNOTATION`**: an unknown `photoId` is a no-op. Otherwise the reducer applies
   `annotationReducer(state.session.annotations[photoId], action)` and returns the same top-level
   object if that slice didn't change.

## Selectors and pure helpers (`src/features/session/lib/sessionSelectors.ts`, `limits.ts`)

```ts
selectedPhoto(s: SessionState): Photo | null;
heldBytes(s: SessionState): number;                 // live photos + pending deletions
fullReason(s: SessionState): 'count' | 'memory' | null;
annotationCount(s: SessionState, photoId: string): number;
totalAnnotations(s: SessionState): number;
admit(s: SessionState, incoming: { byteSize: number }[]):
  { accepted: number; rejected: number; reason: 'count' | 'memory' | null };
```

## Provider (`src/app/AppContext.tsx`)

```ts
<AppProvider>                         // mounted ABOVE every step (R1)
useApp(): { state: AppState; dispatch: Dispatch<AppAction> };
useSession(): {
  photos: Photo[]; selected: Photo | null; isFull: boolean; fullReason: 'count' | 'memory' | null;
  addPhotos(photos: Photo[]): { added: number; skipped: number; reason: string | null };
  select(id: string): void;
  deletePhoto(id: string): void;      // dispatches DELETE_PHOTO and shows notify.undo (5 s)
                                      // undo: UNDO_DELETE_PHOTO, or a toast "Session is full" if refused
                                      // dismiss: FINALIZE_DELETE, then release that photo's URLs
  startOver(): void;                  // START_OVER, then releaseAll()
  go(step: AppStep): void;
};
```

**Side-effect rules (the provider, not the reducer):**
- When a deletion is finalized, the provider revokes `photo.objectUrl` and calls
  `photoProcessor.release(photo.id)`.
- On start over, reset or unmount, it revokes every live and pending URL and calls
  `photoProcessor.releaseAll()`.
- Whenever `selectedId` changes, it calls `photoProcessor.prioritize(selectedId)`.

## Annotation adapter (`src/features/annotation/state/AnnotationProvider.tsx`, rewritten)

```ts
<AnnotationProvider>   // no props: reads the selected photo from useApp()
useAnnotationContext(): { state: AnnotationState; dispatch: Dispatch<AnnotationAction> }
// dispatch(a) === appDispatch({ type: 'ANNOTATION', photoId: selectedIdAtCallTime, action: a })
```

- **API unchanged**: `useAnnotations()` keeps its current API. The canvas, the list, the shortcuts
  and the export don't change.
- **Undo targets the right photo**: `deleteWithUndo` and `clearAllWithUndo` capture `photoId` when
  the delete happens, so a later undo restores the annotations to that photo (FR-025).
- **Key**: the annotation canvas is keyed by `selectedId`, so any in-progress gesture or label
  draft resets when the user switches photos.
