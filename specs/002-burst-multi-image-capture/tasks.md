---

description: "Task list for Burst Capture & Multi-Image Sessions"
---

# Tasks: Burst Capture & Multi-Image Sessions

**Input**: Design documents from `/specs/002-burst-multi-image-capture/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution v1.1.0 (Development Workflow) requires:
- unit tests for the burst scheduler (300 ms threshold, cadence, every Principle VIII limit,
  sequential capture, and each early-stop reason);
- component tests for per-image delete (with confirm or undo) and for annotations staying isolated
  per image across switches.

Write each story's tests first and confirm they fail. **Every feature 001 test must keep passing
(SC-009).** Tests that assumed a one-photo session are updated, never deleted.

**Organization**: Tasks are grouped by user story (US1–US6 in spec.md). Every story is an
`enhancement` (constitution I). Feature 001's core is complete and MUST NOT regress.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1…US6 from spec.md
- Paths are relative to the repository root (single-project layout, see plan.md)

---

## Phase 1: Setup

**Purpose**: Constants and folders for the new `session` feature

- [X] T001 Create the folders `src/features/session/{lib,hooks,components}`. Confirm the existing ESLint rule (`src/features/*/lib/**` cannot import React) applies to `src/features/session/lib` by running `npm run lint`
- [X] T002 Create `src/features/session/lib/limits.ts` with the constants from data-model.md §1, verbatim: `TAP_THRESHOLD_MS = 300`, `BURST_INTERVAL_MS = 333`, `BURST_MAX_MS = 3000`, `BURST_MAX_FRAMES = 10`, `SESSION_MAX_PHOTOS = 20`, `SESSION_MAX_BYTES = 150_000_000`, `FIRST_FRAME_ESTIMATE_BYTES = 4_000_000`, `THUMBNAIL_LONG_SIDE = 160`. Re-export `UNDO_WINDOW_MS` (5000) from `src/features/annotation/hooks/useAnnotations.ts`, or move it here and import it there. Add a doc comment citing constitution Principle VIII
- [X] T003 Extend the `CapturedImage` type in `src/shared/types.ts`: `captureMethod` becomes `"image-capture" | "canvas" | "file" | "burst"`, plus the optional fields `burstId?: string` and `burstIndex?: number` ("1-based position within the burst"). Export `type Photo = CapturedImage`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The session store mounted above every step, per-photo annotation routing, background
photo processing, and the shared `PhotoStrip`. All stories depend on these.

**⚠️ CRITICAL**: No user-story work starts until this phase is complete and every feature 001 test
is green again.

### Tests (write first)

- [X] T004 [P] Write `src/app/appReducer.test.ts`, covering every rule in contracts/session-store.md:
  - `PHOTOS_ADDED`: appends, selects the first new photo, sets step to `review`, gives each photo an empty annotation entry, caps at `SESSION_MAX_PHOTOS` and at `SESSION_MAX_BYTES` (against held bytes), and returns the same state for an empty list.
  - `SELECT`.
  - `DELETE_PHOTO`: moves the photo to `pending` with its annotations and index; selects the next photo, or the previous if it was last; with no photos left, step becomes `camera` and `selectedId` becomes `null`.
  - `UNDO_DELETE_PHOTO`: restores the photo and its annotations at the original index and selects it; returns to `review` if on the camera; is a no-op when the session is at 20 photos or the token is unknown.
  - `FINALIZE_DELETE`.
  - `START_OVER` and `RESET`, both returning the initial state.
  - `GO`: `review` and `annotate` are refused with no photos; `camera` is always allowed and keeps the session.
  - `ANNOTATION`: routes to the correct photo, an unknown id is a no-op, and an unchanged slice returns the same object.
- [X] T005 [P] Write `src/features/session/lib/sessionSelectors.test.ts`, covering: `heldBytes` (live photos plus pending deletions), `fullReason` (`'count'` at 20 photos, `'memory'` at 150 MB, otherwise null), `annotationCount`, `totalAnnotations`, `selectedPhoto`, and `admit()` returning accepted, rejected and reason when the count or memory would be exceeded
- [X] T006 [P] Write `src/features/session/lib/photoProcessor.test.ts` with fake `decode`, `analyze`, `thumbnail` and `schedule`, covering guarantees 1–6 of contracts/photo-processing-and-strip.md:
  - one job at a time;
  - the prioritized photo first, then capture order;
  - no new job after `pause()` until `resume()`;
  - a single decode per photo, with `close()` called even when `analyze` throws;
  - `release(id)` revoking the thumbnail URL and discarding a running job's result;
  - `releaseAll()`;
  - a decode error giving `status: 'error'`.
- [X] T007 [P] Write `src/features/session/components/PhotoStrip.test.tsx`, covering:
  - it renders nothing for fewer than 2 photos;
  - each item has `aria-pressed`, with the accessible name "Photo {i} of {n}, {verdict ?? 'quality pending'}, {k} annotation(s)";
  - ←/→ arrows move focus with a roving tabindex;
  - Enter selects;
  - Delete or Backspace on a focused item calls `onDelete(id)`;
  - the selected item scrolls into view;
  - the burst marker shows for `captureMethod: 'burst'`.

### Implementation

- [X] T008 Implement `src/features/session/lib/sessionSelectors.ts`: `selectedPhoto`, `heldBytes`, `fullReason`, `annotationCount`, `totalAnnotations`, `remainingSlots` and `admit()`, per data-model.md §3 and contracts/session-store.md. No React imports
- [X] T009 Implement `src/app/appReducer.ts`, replacing `src/app/appFlowReducer.ts`:
  - `AppState { step; session: { photos; selectedId; annotations: Record<photoId, AnnotationState>; pending: Record<token, PendingDeletion> } }`, the `AppAction` union from contracts/session-store.md, and `initialAppState`.
  - Route `ANNOTATION` to the unchanged `annotationReducer` from `src/features/annotation/lib/annotationReducer.ts`.
  - Enforce the invariants in data-model.md §4.
  - Delete `src/app/appFlowReducer.ts` and `src/app/appFlowReducer.test.ts` once T004 passes.
- [X] T010 Implement `src/features/session/lib/photoProcessor.ts`, `createPhotoProcessor(deps)`, per contracts/photo-processing-and-strip.md: a FIFO queue with `prioritize`, `pause`/`resume`, `release`/`releaseAll` and an external store (`get`, `subscribe`). Export the default singleton `photoProcessor` wired with real dependencies from T011
- [X] T011 Refactor `src/features/quality/lib/measure.ts`:
  - Extract `analyzeSource(source, w, h)`, which returns `{ brightnessPct, sharpness }` using the existing 512 px high-quality downscale.
  - Add `renderThumbnail(source, w, h)` (`THUMBNAIL_LONG_SIDE` = 160 px, JPEG 0.8, via `toBlob`) and `decodeForProcessing(blob)` (`createImageBitmap` with orientation from the image, falling back to `<img>.decode()`, returning `{ source, width, height, close }`).
  - Keep `measureImage(image)` working by composing these, so feature 001 callers and tests still pass.
- [X] T012 Implement `src/features/session/hooks/usePhotoInfo.ts` (`useSyncExternalStore` over `photoProcessor`). Rewrite `src/features/quality/hooks/useQualityAssessment.ts` to read metrics from `photoProcessor.get(image.id)`: return pending while queued or processing, ready via `assessQuality`, and handle a decode error as missing metrics, matching feature 001. Remove its old module-level cache
- [X] T013 Implement `src/app/AppContext.tsx`, replacing `src/app/AppFlowContext.tsx`:
  - `AppProvider` (optional `initialState` for tests), `useApp()` and `useSession()`, per contracts/session-store.md.
  - `addPhotos` uses `admit()`, dispatches `PHOTOS_ADDED`, and calls `photoProcessor.enqueue(added)`.
  - `deletePhoto` dispatches `DELETE_PHOTO` with a `crypto.randomUUID()` token and calls `notify.undo(…, { durationMs: UNDO_WINDOW_MS })`. Undo dispatches `UNDO_DELETE_PHOTO`, or shows `notify.error('Session is full — delete a photo first')` if refused. Dismiss dispatches `FINALIZE_DELETE` and then revokes `photo.objectUrl` and calls `photoProcessor.release(id)`.
  - `startOver` dispatches `START_OVER`, then revokes every live and pending URL and calls `photoProcessor.releaseAll()`.
  - `go`.
  - On `selectedId` change, call `photoProcessor.prioritize`. On unmount, release everything.
  - Delete `AppFlowContext.tsx`.
- [X] T014 Rewrite `src/features/annotation/state/AnnotationProvider.tsx` as a no-prop adapter, per contracts/session-store.md. It reads `session.annotations[selectedId]` from `useApp()`. Its `dispatch(a)` becomes `appDispatch({ type: 'ANNOTATION', photoId: <selectedId captured at call time>, action: a })`. Remove the `imageId`, `onCountChange` and `initialState` props
- [X] T015 Update `src/features/annotation/hooks/useAnnotations.ts` so `deleteWithUndo` and `clearAllWithUndo` capture the current `photoId`, and their Undo and dismiss callbacks dispatch `{ type: 'ANNOTATION', photoId, action: UNDO_DELETE | DISMISS_UNDO }` to that photo (FR-025). Expose the same API as before
- [X] T016 Migrate every importer of the old flow (`src/app/StepIndicator.tsx`, `src/features/camera/components/CameraView.tsx`, `src/features/review/components/ReviewView.tsx`, `src/features/annotation/components/AnnotateView.tsx`, `src/features/upload/components/ChoosePhotoButton.tsx`), mapping the old actions:
  - `CAPTURED` / `UPLOADED` → `useSession().addPhotos([image])`
  - `ACCEPT` → `go('annotate')`
  - `BACK_TO_REVIEW` → `go('review')`
  - `RETAKE` of a single photo → `deletePhoto(selected.id)`
  - `RESET` → `startOver()`
  - The old `pendingConfirm` and `CONFIRM`/`CANCEL` are replaced by local `ConfirmDialog` state in the component that needs it.
- [X] T017 Update `src/app/App.tsx`:
  - `AppProvider` wraps **all** steps.
  - Review and annotate render inside `<AnnotationProvider>` (the T014 adapter, no key/props).
  - Each step keeps its own `ErrorBoundary` (`onReset` → `startOver`).
  - Step choice and the selected photo come from `useApp()`.
- [X] T018 Update `src/app/screens.tsx`: `ReviewScreen` and `AnnotateScreen` read `selectedPhoto` from `useSession()` instead of an `image` prop, and pass it to `ReviewView` / `AnnotateView` and to `useQualityAssessment`
- [X] T019 [P] Implement `src/features/session/components/PhotoThumb.tsx` (a thumbnail `<img>` from `usePhotoInfo(id).thumbnailUrl`, or a skeleton; a quality dot when ready; an annotation-count badge; a burst marker; at least 56×56 CSS px) and `src/features/session/components/PhotoStrip.tsx` (props per contract; horizontal or vertical; roving tabindex; hidden for fewer than 2 photos; `scrollIntoView({ block: 'nearest', inline: 'nearest' })` on the selected item). Icons come from `src/shared/ui/icons.ts`
- [X] T020 Update the feature 001 tests that assumed the old flow: `src/app/App.test.tsx`, `src/features/review/components/ReviewView.test.tsx`, `src/features/camera/components/CameraView.test.tsx`, `src/features/annotation/components/AnnotationCanvas.test.tsx` and `src/features/annotation/components/AnnotationList.test.tsx`. They should render under `AppProvider` with a one-photo `initialState` (helper `tests/fakes/appState.ts`, which builds a session from photos and optional annotations). Then run `npm run lint && npm run typecheck && npm test && npm run test:e2e`. **Everything from feature 001 must be green.**

**Checkpoint**: The app behaves exactly like feature 001, now backed by a session store. Single
captures work end to end.

---

## Phase 3: User Story 1 - Hold the shutter to take a burst (Priority: P1) 🎯 MVP

**Goal**: A tap still takes exactly one photo. Holding takes sequential full-stream-resolution
frames at about 3 fps, with a counter and progress ring, stopping on release, a time or frame
limit, hide, or interrupt, and keeping all frames.

**Independent Test**: Hold for about 2 s on a phone. Review shows about 5–7 photos, each with its
own resolution. A tap gives exactly 1 photo (quickstart B1–B5).

### Tests for User Story 1 ⚠️

- [X] T021 [P] [US1] Write `src/features/session/lib/burstScheduler.test.ts` using Vitest fake timers and a fake `BurstEnv`, covering guarantees 1–6 of contracts/burst.md:
  - `captureFrame` is never concurrent;
  - the next frame starts at `max(prevStart + 333, prevEnd)`;
  - a 600 ms capture yields fewer frames with no backlog;
  - `time-limit` at 3000 ms and `frame-limit` at 10 frames;
  - `session-full` when `sessionPhotos + frames` reaches 20;
  - `memory-limit` when `sessionBytes + framesBytes + estimate > 150_000_000`, using `FIRST_FRAME_ESTIMATE_BYTES` before the first frame and the last frame's size afterwards;
  - limit priority order: time, frames, session, memory;
  - an external stop keeps the in-flight frame;
  - a rejected capture gives `interrupted` and keeps earlier frames;
  - no frame when a limit is already hit at t = 0;
  - a 50-trial randomized loop (capture latency 50–900 ms, random session fill and frame sizes) asserting that no run ever exceeds 3000 ms, 10 frames, 20 session photos or 150 MB, and that captures never overlap (SC-004).
- [X] T022 [P] [US1] Write `src/features/camera/components/ShutterButton.test.tsx` with fake timers and a fake controller:
  - pointerdown then pointerup at 299 ms gives one tap (single capture, no burst);
  - at exactly 300 ms it is still a tap (FR-001: "≤ 0.3 seconds"; the hold timer is `TAP_THRESHOLD_MS + 1`);
  - holding 301 ms starts a burst;
  - `contextmenu` is `defaultPrevented`;
  - a second `pointerId` while held neither starts nor stops anything;
  - `pointercancel` and `lostpointercapture` stop with `released`;
  - moving the held pointer outside the button's bounds (with pointer capture) does **not** stop the burst; `pointerup` outside the button does (FR-003);
  - Enter or Space gives a single capture, never a burst.
- [X] T023 [P] [US1] Write `src/features/camera/hooks/useBurst.test.tsx` using `tests/fakes/fakeMediaDevices.ts` and a fake `captureFrame`:
  - a tap calls `camera.capture()` once;
  - a hold calls `captureFrame` sequentially and then `camera.stop()`, `photoProcessor.pause()` and `resume()`;
  - `onPhotos(frames, reason)` is called;
  - `visibilitychange` to hidden stops with `backgrounded`;
  - the track ending stops with `interrupted`;
  - `frameCount` updates per frame;
  - if the torch was on at burst start, `track.applyConstraints` is never called during the burst (the torch stays on, edge case).

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement `src/features/session/lib/burstScheduler.ts` (`runBurst(env, signal)` and `checkLimits(input)`) per contracts/burst.md and data-model.md §6, with no React imports and limits from `limits.ts`
- [X] T025 [US1] Add `captureFrame()` to `src/features/camera/hooks/useCamera.ts`:
  - It uses `captureVideoFrame(video)` from `src/features/camera/lib/capture.ts`, a canvas at `videoWidth × videoHeight` with JPEG 0.95.
  - It builds the photo via `createCapturedImage(blob, { source: 'camera', captureMethod: 'burst', size: { width: videoWidth, height: videoHeight } })`.
  - It does **not** stop the stream, and rejects when the status isn't `live`.
  - Add it to `UseCameraResult` (documented in this feature's contracts/burst.md; feature 001's contracts are not edited).
- [X] T026 [US1] Implement `src/features/camera/hooks/useBurst.ts` per contracts/burst.md: phases, the `TAP_THRESHOLD_MS + 1` hold timer (with release checked against `performance.now()`, so exactly 300 ms is a tap), first-`pointerId` locking with pointer capture, `shutterHandlers`, `toggleBurst()`, and stop signals (release, visibility, camera status). It assigns `burstId` and `burstIndex` to frames, pauses and resumes `photoProcessor`, and calls `camera.stop()` after a burst
- [X] T027 [US1] Update `src/features/camera/components/ShutterButton.tsx` to spread `shutterHandlers`, add `style={{ touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}`, keep the accessible name "Capture photo", and add `aria-describedby` hint text "Hold to take a burst"
- [X] T028 [P] [US1] Implement `src/features/camera/components/BurstProgress.tsx`: an SVG ring around the 72 px shutter whose stroke animates linearly over `BURST_MAX_MS` from `startedAt` (a CSS animation keyed by `startedAt`). With `prefers-reduced-motion`, show a static ring. Add a counter chip showing `frameCount`
- [X] T029 [US1] Wire up `src/features/camera/components/CameraView.tsx`:
  - `useBurst({ camera, onPhotos })` → `useSession().addPhotos(photos)`; the step becomes `review` through `PHOTOS_ADDED`.
  - Render `BurstProgress` while `phase === 'running'`.
  - Disable the switch-camera, torch and gallery controls while `phase !== 'idle'` (FR-009).
  - Replace the old `handleCapture` with the tap path from `useBurst`, keeping the shutter flash for both taps and frames.
- [X] T030 [US1] Add stop-reason feedback in `src/features/camera/hooks/useBurst.ts` and `CameraView.tsx`, using the exact copy table in contracts/burst.md: `notify.info` for non-user reasons, plus a visually hidden `role="status" aria-live="polite"` region announcing "Burst: {n} photos. {reason}" (FR-007, FR-029)
- [X] T031 [US1] Update `src/features/review/components/ReviewView.tsx` to show the selected photo with `PhotoStrip` (horizontal under the photo on phones, vertical beside it at ≥ 1024 px). Selecting a thumbnail calls `useSession().select(id)`. Keep `ReviewScreen`'s quality panel bound to the selected photo
- [X] T032 [US1] Write e2e `tests/e2e/burst.spec.ts` (part 1):
  - Hold the shutter about 1.3 s with the mouse (desktop project) and with CDP touch (pixel-7). Expect at least 3 thumbnails in Review, and that each photo's quality panel shows the stream resolution.
  - Tap once and expect exactly 1 photo, with no strip.
  - Hold for more than 3.5 s and expect at most 10 photos plus the "Burst limit reached" toast.
  - Hold on pixel-7 for about 1 s and assert no context menu or text selection (`window.getSelection().toString() === ''`).

**Checkpoint**: Burst capture works end to end. This is the MVP increment.

---

## Phase 4: User Story 2 - Review all photos and delete individual ones (Priority: P1)

**Goal**: Thumbnails with quality markers, per-photo delete with undo (and confirmation when the
photo is annotated), Add more, Start over, Continue, and single-photo compatibility.

**Independent Test**: With a 6-photo burst, select each photo, delete 2, undo 1, and confirm 5
remain and continue to Annotate (quickstart B6–B9, B16).

### Tests for User Story 2 ⚠️

- [X] T033 [P] [US2] Write `src/features/review/components/ReviewView.multi.test.tsx`, rendering under `AppProvider` with a 4-photo session:
  - selecting a thumbnail switches the large `<img>` src and the quality panel;
  - Delete photo on an unannotated photo removes it at once and offers an Undo toast that restores it at its index;
  - deleting an annotated photo first shows a `ConfirmDialog` ("{k} annotation(s) will be lost"), where cancel keeps it;
  - deleting the last photo selects the previous one;
  - deleting the only photo returns to the camera, with Undo still offered;
  - Add more sets the step to `camera` and keeps the photos;
  - Start over with 2 or more photos **always** asks for confirmation ("Discard all N photos…", adding the annotation count when there are any): cancel keeps everything, confirm clears it and opens the camera;
  - a one-photo session shows Retake and Use Photo, no strip, and an "Add more" link (FR-032).

### Implementation for User Story 2

- [X] T034 [US2] Implement the multi-photo actions in `src/features/review/components/ReviewView.tsx`:
  - **Several photos**: primary "Continue to annotate" → `go('annotate')`; secondary "Add more" → `go('camera')`; "Start over" (**always** a `ConfirmDialog`: "Discard all {n} photos{and k annotations}?"; FR-020, constitution V) → `startOver()`; "Delete photo" for the selected photo (a `ConfirmDialog` with the count if it's annotated) → `deletePhoto(id)`.
  - **One photo**: keep feature 001's "Retake" (→ `deletePhoto`) and "Use Photo" / "Use anyway", plus a ghost "Add more" link.
- [X] T035 [US2] Hook `PhotoStrip` `onDelete` in Review to the same confirm-then-`deletePhoto` flow, and pass the quality verdicts (`usePhotoInfo` + `assessQuality`) and `annotationCount` per photo to the thumbnails, via `src/features/session/hooks/useStripData.ts`
- [X] T036 [US2] Prevent a quality result from appearing for a deleted photo: when a deletion is finalized, `photoProcessor.release(id)` already discards its result. Additionally ensure `useQualityAssessment` returns null for an id that is no longer in the session. Add a case to `src/features/session/lib/photoProcessor.test.ts`
- [X] T037 [US2] Extend `tests/e2e/burst.spec.ts` (part 2): take a burst, delete 2 photos via the strip's keyboard Delete, click Undo on the last toast, assert the count, then Add more, take a single photo, and assert the count grew by 1

**Checkpoint**: Burst, then curate, works end to end.

---

## Phase 5: User Story 3 - Annotate each photo separately (Priority: P1)

**Goal**: Annotate shows the strip. Annotations, the list, Clear all and undo are scoped to the
current photo, and counts appear on the thumbnails.

**Independent Test**: Draw 2 boxes on photo 1 and 1 on photo 2, switch back and forth, and see
counts 2 and 1 with correct alignment (quickstart B10–B11).

### Tests for User Story 3 ⚠️

- [ ] T038 [P] [US3] Write `src/features/annotation/components/AnnotateView.multi.test.tsx`, under `AppProvider` with photos A (4000×3000) and B (1920×1080), with `getBoundingClientRect` stubbed as in `AnnotationCanvas.test.tsx`:
  - draw 2 boxes on A, select B in the strip, draw 1 box on B, select A again;
  - A shows exactly its 2 boxes with the same image-pixel rects, and B has 1;
  - the strip badges show 2 and 1;
  - Clear all on B leaves A untouched;
  - delete a box on A, switch to B, click Undo, and the box returns on A;
  - an in-progress drag is cancelled when switching photos (the canvas is keyed by photo);
  - deleting the annotated photo A from the Annotate strip shows the confirmation with its count, then shows B; Undo restores A together with its 2 boxes.

### Implementation for User Story 3

- [ ] T039 [US3] Update `src/features/annotation/components/AnnotateView.tsx`:
  - Render `PhotoStrip` (horizontal, under the toolbar) with `annotationCount`s, `select` and `onDelete`. Deleting uses the same confirm-if-annotated, then `deletePhoto`, flow as Review (T035; US3-7, FR-018). Afterwards the view moves to the neighbouring photo.
  - Key `<AnnotationCanvas key={selected.id} image={selected}>` and `LabelEditor`.
  - Retake becomes "Start over" when there are several photos (**always** confirmed, as in T034) and stays feature 001's Retake (→ `deletePhoto`) for one photo.
- [ ] T040 [US3] Make sure `src/features/annotation/components/AnnotationList.tsx` and `src/features/annotation/components/ExportMenu.tsx` read only the current photo's slice through `useAnnotations()`, and that the list header reads "{n} annotations on this photo" when the session has more than one photo. Export file names gain a `-photo{index}` suffix in multi-photo sessions, in `src/features/annotation/lib/exportAnnotations.ts` `exportFileName`
- [ ] T041 [US3] Extend `tests/e2e/burst.spec.ts` (part 3): from a burst, annotate photos 1 and 2 with different labels, switch between them, resize the viewport, and assert each photo shows only its own label, with boxes within 1% alignment (reuse `fractions()` from `tests/e2e/alignment.spec.ts`, moved into `tests/e2e/helpers.ts`)

**Checkpoint**: Per-photo annotation complete. All P1 behavior except the session-limit UX is done.

---

## Phase 6: User Story 4 - Stay within safe limits (Priority: P1)

**Goal**: The session-full and memory limits are visible and enforced everywhere photos are added.
Processing pauses during bursts. Memory is released.

**Independent Test**: Burst until 20 photos. The shutter is disabled with its message. Delete 3
and capture works again (quickstart B12–B13).

### Tests for User Story 4 ⚠️

- [ ] T042 [P] [US4] Write `src/features/camera/components/CameraView.limits.test.tsx`:
  - with a session of 20 photos, the shutter and Burst button are disabled, with the visible text "Session full (20 photos). Delete some photos to take more.";
  - with 18 photos, a burst stops after 2 frames with `session-full` and that toast;
  - with `heldBytes` near 150 MB, a burst stops with `memory-limit`;
  - after a deletion is finalized, the shutter is enabled again.
- [ ] T043 [P] [US4] Add cases to `src/app/appReducer.test.ts` and `src/features/session/lib/sessionSelectors.test.ts`: pending deletions count toward `heldBytes` until `FINALIZE_DELETE`, and an undo that would exceed 20 photos is refused

### Implementation for User Story 4

- [ ] T044 [US4] In `src/features/camera/components/CameraView.tsx`, read `isFull` and `fullReason` from `useSession()`. Disable the shutter and Burst button, and show the full-session message ("Session full (20 photos). Delete some photos to take more." for count, "Memory limit reached. Delete some photos to take more." for memory) in a visible banner above the controls, linked with `aria-describedby`. Add a "Review photos" button in the banner → `go('review')`
- [ ] T045 [US4] In `src/features/camera/hooks/useBurst.ts`, pass `session()` (photo count and `heldBytes` from `useApp()` state, read through a ref so it's fresh) into `BurstEnv`, so `session-full` and `memory-limit` stop mid-burst
- [ ] T046 [US4] Make sure `useSession().addPhotos` (in `src/app/AppContext.tsx`) applies `admit()`, and returns `{ added, skipped, reason }` that callers turn into a toast whenever photos are skipped
- [ ] T047 [US4] Profile a burst on the reference Android phone (Chrome DevTools remote debugging → Performance). Record the longest main-thread task during a 3 s burst (SC-003: ≤ 50 ms), the delay from release to the burst stopping (SC-003: ≤ 0.2 s, via `performance.mark` on `pointerup` and on stop), and the photo-switch latency in Review and Annotate (SC-006: ≤ 0.1 s, via `performance.mark` around `select`). If it's over 50 ms, move encoding to `OffscreenCanvas.convertToBlob` with `createImageBitmap(video)` in `src/features/camera/lib/capture.ts` (research R4 fallback). Write the measured numbers into `specs/002-burst-multi-image-capture/research.md` under R4 as "Outcome"
- [ ] T048 [US4] Extend `tests/e2e/burst.spec.ts` (part 4): run bursts until the session is full (desktop project, using repeated holds), assert the disabled shutter and banner text, delete 3 photos via the strip, and assert the shutter is enabled again

**Checkpoint**: All P1 stories complete.

---

## Phase 7: User Story 5 - Burst without holding (Priority: P2)

**Goal**: A keyboard-accessible Burst button with the same limits and feedback.

**Independent Test**: Tab to Burst and press Enter; it auto-stops at 3 s. Press Enter again
mid-burst and it stops early (quickstart B14).

- [ ] T049 [P] [US5] Write `src/features/camera/components/BurstButton.test.tsx`: the accessible name is "Take a burst of photos, up to 3 seconds"; activating it calls `toggleBurst()`; `aria-pressed` is true while running; it's disabled when the session is full; the live region announces "Burst: N photos" after it stops (FR-028, FR-029)
- [ ] T050 [US5] Implement `src/features/camera/components/BurstButton.tsx` (an `IconButton` with a burst icon added to `src/shared/ui/icons.ts`, e.g. `GalleryHorizontalEnd` or `Layers`). Place it in the `CameraView` control bar next to the shutter, in both the portrait bar and the landscape rail layouts
- [ ] T051 [US5] Ensure `toggleBurst()` in `src/features/camera/hooks/useBurst.ts` starts a burst without the tap threshold, stops with `toggled` on a second activation, and is ignored while a pointer press is active

**Checkpoint**: Burst is accessible without holding.

---

## Phase 8: User Story 6 - Choose several existing photos (Priority: P3)

**Goal**: Multi-file upload within the limits, with a summary of skipped files.

**Independent Test**: Choose 4 images and 1 PDF; 4 are added and the toast says "1 skipped: not an
image" (quickstart B15).

- [ ] T052 [P] [US6] Update `src/features/upload/lib/fileToCapturedImage.test.ts` and add `src/features/upload/components/ChoosePhotoButton.test.tsx`: several files are processed in order; non-images and undecodable files are skipped with reasons; files beyond the session or memory limits are skipped as "session full"; and a single summary toast is shown
- [ ] T053 [US6] Update `src/features/upload/components/ChoosePhotoButton.tsx`: `multiple` on the input; process files sequentially via `fileToCapturedImage`; check `admit()` before each; call `addPhotos` once with every accepted photo; show one `notify.info` / `notify.error` summary ("4 added · 1 skipped: not an image · 2 skipped: session full")

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T054 Responsive pass at 360×740, 740×360, 768×1024, 1024×768 and 1280×800 for Camera (burst ring, counter, Burst button, full banner), Review (strip on phone and desktop) and Annotate (strip plus side panel). No horizontal overflow; the strip scrolls; touch targets at least 44 px (constitution V)
- [ ] T055 [P] Extend `tests/e2e/a11y.spec.ts` with a multi-photo session (burst, then Review, then Annotate), with no serious or critical axe violations
- [ ] T056 [P] Run the full feature 001 e2e suite plus `burst.spec.ts` against a production build (`npm run build && npm run preview` with `E2E_BASE_URL`) and locally (SC-009)
- [ ] T057 Update `README.md`:
  - a Features row for **Burst & multi-photo sessions**;
  - a **Limits** table (3 s, 10 photos per burst, 20 photos per session, 150 MB, about 3 fps, 300 ms tap threshold) with the rationale from constitution VIII;
  - a note that burst photos are at stream resolution and can be lower than a single capture;
  - the single-photo "Add more" link as a deliberate small addition;
  - updated known limitations (export stays per photo; no reordering).
- [ ] T058 [P] Update `docs/TECHNICAL_NOTES.md` with a new section "4. Burst capture & multi-image sessions": the session store (per-photo `annotationReducer`), the sequential burst scheduler with the limit check, `takePhoto()` versus canvas frames, the one-decode photo processor (thumbnail plus metrics, paused during a burst), and memory accounting and release (including that a deleted photo's memory is released when its 5 s undo window closes, not instantly, and that its bytes stay counted until then; constitution VIII)
- [ ] T059 Run every quickstart.md scenario (B1–B16) on the reference Android phone and a desktop browser via the deployed URL. Record the results (burst frame counts at 3 s for SC-001, plus the longest task, release-to-stop delay and switch latency from T047 for SC-003 and SC-006) in the README's tested-devices section
- [ ] T060 Remove the Sync Impact Report comment from `.specify/memory/constitution.md` (Spec Kit asks for it to be removed before commit), and commit the constitution amendment, the 002 specs and the implementation as focused commits

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)**. Phase 2 BLOCKS every story and ends with the full feature 001 test suite green (T020).
- **US1 (Phase 3)** depends on Phase 2. It is the MVP.
- **US2 (Phase 4)** depends on Phase 2. Its e2e (T037) needs a multi-photo session, so it uses US1's burst (or US6 uploads). Its component tests use seeded sessions, so it can be built in parallel with US1.
- **US3 (Phase 5)** depends on Phase 2 (adapter T014/T015, strip T019). Component tests use seeded sessions; e2e T041 needs US1.
- **US4 (Phase 6)** depends on US1 (`useBurst`, `CameraView` wiring).
- **US5 (Phase 7)** depends on US1 (`useBurst.toggleBurst`).
- **US6 (Phase 8)** depends only on Phase 2 (`admit`, `addPhotos`).
- **Polish (Phase 9)** depends on all desired stories. T060 comes last.

### Story Completion Graph

```text
Setup → Foundational ─┬─► US1 ─┬─► US4
                      │        └─► US5
                      ├─► US2  (e2e needs US1)
                      ├─► US3  (e2e needs US1)
                      └─► US6
All ─► Polish (T054–T060)
```

### Within Each Story

Write the tests first and confirm they fail. Then build pure `lib/` code, then hooks, then
components, then wiring, then e2e. Keep lint, typecheck and tests green after every task.

### Parallel Opportunities

- **Phase 2**: tests T004–T007 run in parallel. T008, T010, T011 and T019 are in different files
  and can run in parallel once their tests exist. T009 → T013 → T014/T015 → T016 → T017/T018 →
  T020 run in sequence (shared app wiring).
- **After Phase 2**: US1, US2 (component level), US3 (component level) and US6 can proceed in
  parallel. They touch different files, except `CameraView.tsx` (US1, US4, US5), which must be
  serialized.
- **Within US1**: T021, T022, T023, T024 and T028 run in parallel.

---

## Parallel Example: Foundational

```bash
Task: "T004 appReducer.test.ts"   Task: "T005 sessionSelectors.test.ts"
Task: "T006 photoProcessor.test.ts"   Task: "T007 PhotoStrip.test.tsx"
Task: "T008 sessionSelectors.ts"  Task: "T010 photoProcessor.ts"  Task: "T011 measure.ts split"  Task: "T019 PhotoStrip + PhotoThumb"
# then sequential: T009 → T013 → T014 → T015 → T016 → T017 → T018 → T020
```

## Parallel Example: User Story 1

```bash
Task: "T021 burstScheduler.test.ts"  Task: "T022 ShutterButton.test.tsx"  Task: "T023 useBurst.test.tsx"
Task: "T024 burstScheduler.ts"       Task: "T028 BurstProgress.tsx"
# then: T025 captureFrame → T026 useBurst → T027 ShutterButton → T029 CameraView → T030 feedback → T031 Review strip → T032 e2e
```

---

## Implementation Strategy

### MVP First

1. Phases 1 and 2. **Stop and confirm feature 001 is fully intact (T020).**
2. Phase 3 (US1). Validate B1–B5 on the Android phone, and deploy a preview.

### Incremental Delivery

| Increment | Stories | Exit check |
|---|---|---|
| 1 | Foundation | Feature 001 suite green on the session store |
| 2 | US1 | Hold gives several photos; tap gives 1; limits respected |
| 3 | US2 + US3 | Curate and annotate per photo (B6–B11) |
| 4 | US4 | Session full and memory limit UX; profiling recorded (T047) |
| 5 | US5 + US6 | Keyboard burst; multi-upload |
| 6 | Polish | Docs, a11y, full e2e, device validation, commits |

### Scope-Cut Order (constitution I)

Cut in this order: US6, then the vertical strip layout (keep horizontal only). **US5 is not
cuttable**: constitution V requires a burst path that doesn't depend on holding, so the Burst
button ships with burst itself. Never cut US4, US5, the limits, the required tests, or T020.

---

## Notes

- **Limits** are quoted from data-model.md §1 and constitution VIII. Change them only by amending
  the constitution.
- **Feature 001 stays authoritative**: `annotationReducer` stays unchanged, and `useAnnotations`
  keeps its API.
- **Burst frames** use `captureMethod: 'burst'` and are at stream resolution. Single taps still use
  `takePhoto()`.
- **No pixel work during a burst**: the processor is paused and resumed by `useBurst`.
