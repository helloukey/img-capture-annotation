---

description: "Task list for Image Capture & Annotation implementation"
---

# Tasks: Image Capture & Annotation

**Input**: Design documents from `/specs/001-image-capture-annotation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Spec FR-039 and the constitution's Development Workflow call for unit tests
(geometry, quality, error classification, constraints), component tests (camera error states,
torch states, annotation flow), and Playwright e2e tests. Within each story, write the tests
first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story (US1–US8 from spec.md), in priority order.
All core stories (US1–US7) come before the enhancement (US8), per Constitution I.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1…US8)
- Paths are relative to the repository root, using the single-project layout from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the project, tooling and quality gates (research R1, R10–R12)

- [X] T001 Initialize git and scaffold a Vite React + TypeScript project at the repository root **without touching the existing `specs/`, `.specify/` or `.claude/`**. Scaffold into a temporary folder (`npm create vite@latest /tmp/vite-scaffold -- --template react-ts`), then copy its files into the repository root, never overwriting existing paths. Do NOT run create-vite in `.` (it offers to "remove existing files"). Add `.gitignore` entries for `node_modules`, `dist`, `coverage`, `playwright-report` and `test-results`
- [X] T002 Set TypeScript to strict mode in `tsconfig.json` / `tsconfig.app.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes: false`) and add the path alias `@/*` → `src/*`, mirrored in `vite.config.ts`
- [X] T003 Install runtime dependencies: `@radix-ui/react-dialog @radix-ui/react-toggle @radix-ui/react-tooltip @radix-ui/react-popover sonner lucide-react clsx`
- [X] T004 [P] Install and configure Tailwind CSS v4 (`tailwindcss @tailwindcss/vite`). Create `src/styles/index.css` with `@import "tailwindcss"`, `@theme` tokens (colors for good / fair / poor, surface and accent), a dark-mode default for the camera UI, and a `@media (prefers-reduced-motion: reduce)` rule that disables transitions and animations. Import it in `src/main.tsx`
- [X] T005 [P] Configure ESLint flat config in `eslint.config.js` (typescript-eslint strict, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, react-refresh), plus Prettier in `.prettierrc`. Add an import-restriction rule so that `src/features/*/lib/**` cannot import `react` (Constitution VI)
- [X] T006 [P] Configure Vitest in `vite.config.ts` (`environment: "jsdom"`, `setupFiles: ["tests/setup.ts"]`, coverage v8). Install `vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fast-check`
- [X] T007 [P] Configure Playwright in `playwright.config.ts` with projects `desktop-chrome` (1280×800) and `pixel-7` (touch, mobile), Chromium launch args `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. Add a third project, `chromium-denied`, that runs only `permission-denied.spec.ts` with `--use-fake-device-for-media-stream --deny-permission-prompts` and WITHOUT `--use-fake-ui-for-media-stream` (that flag would auto-grant permission). Exclude that spec from the other projects. and `webServer` running `npm run dev`. Install `@playwright/test`
- [X] T008 [P] Add `@vitejs/plugin-basic-ssl`, applied only when `process.env.HTTPS === "1"`, in `vite.config.ts`. Add npm scripts in `package.json`: `dev`, `dev:https` (`HTTPS=1 vite --host`), `build`, `preview`, `lint`, `typecheck` (`tsc -b --noEmit`), `test` (`vitest run`), `test:watch`, `test:e2e` (`playwright test`), `format`
- [X] T009 Create the empty directory skeleton from plan.md (`src/app`, `src/features/{camera,review,upload,quality,annotation}/…`, `src/shared/{ui,components,hooks}`, `tests/fakes`, `tests/e2e`, `docs/`), and run `npm run lint && npm run typecheck && npm test` to confirm the gates pass on the scaffold

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, the app flow, error boundaries, UI primitives and test fakes that
every story depends on

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T010 Define shared types in `src/shared/types.ts`. `CapturedImage` has `id`, `blob`, `objectUrl` ("MUST be revoked when the image is replaced or discarded"), `width`/`height` ("Intrinsic pixel width/height after EXIF orientation applied. Integer > 0"), `byteSize`, `mimeType` ("Starts with image/"), `source: "camera" | "upload"`, `captureMethod: "image-capture" | "canvas" | "file"`, `capturedAt`, and `cameraLabel?`. Also define `Size`, `Point` and `Rect`, per data-model.md §1
- [X] T011 [P] Implement `decodeImage(blob): Promise<{ width; height }>` in `src/features/camera/lib/decodeImage.ts`. Use `createImageBitmap(blob, { imageOrientation: "from-image" })`, fall back to an `HTMLImageElement` with `naturalWidth/naturalHeight`, and reject with a typed error when decoding fails (research R3, R9)
- [X] T012 [P] Implement `createCapturedImage(blob, meta)` in `src/shared/capturedImage.ts`. It decodes the blob via T011, then builds a `CapturedImage` with `crypto.randomUUID()`, `URL.createObjectURL`, `byteSize = blob.size`, and `capturedAt = Date.now()`. Also export `releaseCapturedImage(img)`, which revokes the URL
- [X] T013 [P] Write unit tests for the AppFlow reducer in `src/app/appFlowReducer.test.ts`, covering every transition in data-model.md §6: `CAPTURED`/`UPLOADED` → review, `RETAKE` from review → camera, `ACCEPT` → annotate, `BACK_TO_REVIEW`, `RETAKE` from annotate with annotations → `pendingConfirm = "retake"` then `CONFIRM`/`CANCEL`, **`RETAKE` from review when annotations exist (after `BACK_TO_REVIEW`) → `pendingConfirm = "retake"`**, `RETAKE` from review with no annotations → camera directly, and `RESET`
- [X] T014 Implement `appFlowReducer` and its action types in `src/app/appFlowReducer.ts`. The state is `{ step: "camera" | "review" | "annotate"; image: CapturedImage | null; pendingConfirm: "retake" | "replace" | null }`. The reducer stays pure, and side effects (URL revocation) are dispatched by the context in T015
- [X] T015 Implement `AppFlowProvider` and the `useAppFlow()` hook in `src/app/AppFlowContext.tsx`. It wraps the reducer and calls `releaseCapturedImage` on the previous image whenever `image` changes or is cleared. Expose an `annotationCount` setter so the annotate step can report whether a retake confirmation is needed
- [X] T016 [P] Implement `ErrorBoundary` (a class component) and `ErrorFallback` ("Something went wrong", a details disclosure, and a "Start over" button that dispatches `RESET`) in `src/shared/components/ErrorBoundary.tsx` and `src/shared/components/ErrorFallback.tsx` (FR-013, Constitution III)
- [X] T017 [P] Create Radix and Tailwind UI wrappers in `src/shared/ui/`:
  - `Button.tsx` (variants primary / secondary / ghost / danger, with an `emphasis` prop)
  - `IconButton.tsx` (minimum 44×44 px hit area, a required `aria-label`)
  - `ConfirmDialog.tsx` (Radix Dialog with title, description, confirm and cancel)
  - `Sheet.tsx` (Radix Dialog styled as a bottom sheet below 768 px)
  - `Popover.tsx`
  - `Toggle.tsx` (Radix Toggle with `pressed`, `disabled` and `pending` states)
  - `toast.ts`, the ONLY module that imports Sonner. It exports `notify.success(msg)`, `notify.error(msg)`, `notify.undo(msg, onUndo, { durationMs, onDismiss })`, and a `<Toaster />` re-export
  - `icons.ts`, the ONLY module that imports lucide-react. It re-exports the icons the app uses (Camera, SwitchCamera, Flashlight, FlashlightOff, Trash2, Undo2, List, ChevronLeft, Download, AlertTriangle, CheckCircle2, ImageUp)
  - Add an ESLint `no-restricted-imports` rule so that `sonner` and `lucide-react` can only be imported from `src/shared/ui/` (Constitution VI)
- [X] T018 [P] Implement shared hooks:
  - `useResizeObserver(ref)` returning a `DOMRectReadOnly` in `src/shared/hooks/useResizeObserver.ts`
  - `useMediaQuery(query)` in `src/shared/hooks/useMediaQuery.ts`
  - `usePageVisibility()` in `src/features/camera/hooks/usePageVisibility.ts`
- [X] T019 [P] Create the test fakes, `tests/fakes/fakeTrack.ts`, `tests/fakes/fakeMediaDevices.ts` and `tests/fakes/fakeImageCapture.ts`:
  - **Fake track**: a configurable `getCapabilities` / `getSettings` / `applyConstraints` (resolving or rejecting), `stop()`, and `ended` event dispatch.
  - **Fake devices**: `getUserMedia` resolving or rejecting with a named `DOMException` (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`), and `enumerateDevices`.
  - **Fake ImageCapture**: `takePhoto` and `getPhotoCapabilities`.

  Also create `tests/setup.ts`, which loads jest-dom, stubs `URL.createObjectURL/revokeObjectURL`, `ResizeObserver`, `HTMLMediaElement.prototype.play`, `SVGElement.prototype.getScreenCTM` and `createImageBitmap`, and resets fakes after each test
- [X] T020 Implement the `App` shell in `src/app/App.tsx` and `src/main.tsx`. It contains `AppFlowProvider`, a header with `StepIndicator` (`src/app/StepIndicator.tsx`, showing Capture → Review → Annotate with the current step marked via `aria-current="step"`, FR-033), a step switch that renders placeholder views wrapped in their own `ErrorBoundary`, and the `<Toaster />` from `src/shared/ui/toast.ts`. Leave a slot (filled in T040) where `AnnotationProvider key={image.id}` wraps the review and annotate steps, so annotation state survives moving between them. Set `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` in `index.html`

**Checkpoint**: `npm run dev` shows the shell with the step indicator, and the reducer tests pass

---

## Phase 3: User Story 1 - Capture and review a high-quality photo (Priority: P1) 🎯 MVP

**Goal**: Live preview from the rear camera at the highest negotiated resolution. Capture at the
maximum photo resolution, review the full frame, retake or accept, and switch cameras.

**Independent Test**: On a camera device, allow access, capture, check the review screen, retake,
capture again, and accept (quickstart V1, V2).

### Tests for User Story 1 ⚠️

- [X] T021 [P] [US1] Unit tests for `buildConstraintLadder` and `pickUpgradeConstraints` in `src/features/camera/lib/constraints.test.ts`. The ladder's first entry uses `facingMode: { ideal: "environment" }`, `width/height: { ideal: 4096 }`, and never `exact`/`min` for resolution. The fallbacks come in order (facingMode only → `{ video: true }`), and `deviceId: { exact }` is used when a device id is given. The upgrade returns `null` when settings already equal the capability max, and `{ width: { ideal: max }, height: { ideal: max } }` otherwise
- [X] T022 [P] [US1] Unit tests for `capturePhoto` in `src/features/camera/lib/capture.test.ts`. It uses `ImageCapture.takePhoto({ imageWidth: caps.imageWidth.max, imageHeight: caps.imageHeight.max })` when available. It falls back to the canvas path when `ImageCapture` is undefined or `takePhoto` rejects. The canvas is sized to `video.videoWidth × video.videoHeight` (not the CSS size), and `toBlob` is called with `"image/jpeg", 0.95`. The returned `captureMethod` matches the path taken
- [X] T023 [P] [US1] Component tests for `useCamera` (happy path) in `src/features/camera/hooks/useCamera.test.tsx`, using the fakes:
  - `status` goes `requesting` → `live`.
  - `resolution` comes from `track.getSettings()`.
  - `applyConstraints` upgrade is attempted when the capabilities exceed the settings.
  - Tracks are stopped on unmount and on visibility `hidden`.
  - `capture()` returns a `CapturedImage` whose `width/height` come from the decoded blob.
  - A second concurrent `capture()` call is ignored.
  - `switchCamera()` stops the old track and requests `deviceId: { exact: nextId }` with the same resolution preferences, cycles through the devices when called without an id, and updates `activeDeviceId` and `track`. `canSwitchCamera` is false with a single device.
- [X] T024 [P] [US1] Component test for the capture → review → retake → accept flow in `src/features/review/components/ReviewView.test.tsx` and `src/app/App.test.tsx` (mocked camera): the shutter shows the flash class, review shows `<img>` with the full frame, Retake returns to the camera, and Use Photo moves to `step === "annotate"`

### Implementation for User Story 1

- [X] T025 [P] [US1] Implement `buildConstraintLadder({ facingMode, deviceId? })` and `pickUpgradeConstraints(caps, settings)` in `src/features/camera/lib/constraints.ts`, per research R2 and contracts/camera.md
- [X] T026 [P] [US1] Implement `capturePhoto({ track, video }): Promise<{ blob; captureMethod }>` in `src/features/camera/lib/capture.ts`, per research R3, with the `ImageCapture` max-photo-capabilities path and the canvas fallback (JPEG 0.95, ≥ 0.92 per the constitution). Re-read `track.getSettings()` after `takePhoto`
- [X] T027 [US1] Implement the `useCamera(options)` hook in `src/features/camera/hooks/useCamera.ts`, per contracts/camera.md:
  - Covers `status`, `videoRef` (sets `srcObject`, `playsInline`, `muted`, `autoplay`), `track`, `resolution`, `devices`, `activeDeviceId`, `canSwitchCamera`, `start`, `stop`, `retry`, `switchCamera`, and `capture` (via T026 and T012, `source: "camera"`).
  - Walks the constraint ladder on `OverconstrainedError`.
  - Applies the capability upgrade.
  - Stops tracks on unmount, visibility `hidden` and after capture.
  - Auto-restarts on `visible` while mounted.
  - Re-enumerates devices after permission is granted.
  - Error handling is a minimal placeholder that sets `status: "error"`; full classification comes in US5.
- [X] T028 [P] [US1] Implement `CameraPreview` in `src/features/camera/components/CameraPreview.tsx`: a full-bleed `<video>` with `object-fit: cover`, mirrored only for `facingMode === "user"`, and a dark letterbox background
- [X] T029 [P] [US1] Implement `ShutterButton` in `src/features/camera/components/ShutterButton.tsx`: 72 px round, `aria-label="Capture photo"`, disabled unless the camera is `live`, a pressed animation, and a busy state while capturing
- [X] T030 [P] [US1] Implement `SwitchCameraButton` in `src/features/camera/components/SwitchCameraButton.tsx`: an `IconButton` that is rendered only when `canSwitchCamera`, calls `switchCamera()`, and has `aria-label="Switch camera"`
- [X] T031 [US1] Implement `CameraView` in `src/features/camera/components/CameraView.tsx`:
  - Composes the preview with a control bar (bottom in portrait, right rail in landscape, via `useMediaQuery("(orientation: landscape)")`).
  - Shows a full-screen white shutter-flash overlay (150 ms CSS animation) on capture.
  - Shows a live resolution chip, for example "3840 × 2160", from `resolution`.
  - Dispatches `CAPTURED(image)` on success.
  - Shows a simple error placeholder when `status === "error"`.
- [X] T032 [US1] Implement `ReviewView` in `src/features/review/components/ReviewView.tsx`:
  - Shows the full captured photo with `object-fit: contain` (not cropped, research R13).
  - Has a sticky action bar with **Retake** (dispatches `RETAKE`) and **Use Photo** (dispatches `ACCEPT`).
  - When `pendingConfirm === "retake"` (annotations exist because the user came back from Annotate), shows a `ConfirmDialog` reading "Discard {n} annotations and retake?". Confirm → `CONFIRM`, cancel → `CANCEL` (FR-028, Constitution V).
  - Has a side slot (≥ 1024 px) or bottom slot (phones) reserved for the quality indicator (US4).
  - Shows a processing indicator while the image decodes (more than 300 ms, FR-032).
- [X] T033 [US1] Wire `CameraView` and `ReviewView` into the step switch in `src/app/App.tsx`, each inside its own `ErrorBoundary`
- [X] T034 [US1] Write the e2e test `tests/e2e/capture-to-annotate.spec.ts` (part 1): load the app with the fake camera, assert the preview `<video>` is playing within 3 s, capture, assert the review `<img>` has `naturalWidth` ≥ the stream's `track.getSettings().width` (`takePhoto` may return a larger photo-capability size) and that it equals the resolution shown in the UI, retake, capture again, then Use Photo, and assert the annotate step is reached

**Checkpoint**: The capture → review → accept loop works on real devices, and the MVP is demonstrable

---

## Phase 4: User Story 2 - Draw and edit bounding-box annotations (Priority: P1)

**Goal**: Draw, select, move, resize (8 handles), label and delete boxes with mouse, touch or pen,
with undo for deletes.

**Independent Test**: Load a photo into Annotate, draw 3 boxes, label them, move one, resize one,
delete one, and undo (quickstart V12, V13). It can be tested with a fixture image via the
`AnnotateView` test harness, independently of the camera.

### Tests for User Story 2 ⚠️

- [X] T035 [P] [US2] Unit and property tests for geometry in `src/features/annotation/lib/geometry.test.ts`, using fast-check:
  - `rectFromPoints` always gives positive width and height.
  - `clampRect`, `moveRect` and `resizeRect` outputs stay within the bounds, with width and height ≥ `minSize` when the bounds allow it.
  - `moveRect` keeps the size.
  - `resizeRect` covers each of the 8 handles, including dragging past the opposite edge (flip and normalize).
  - `minBoxSize(natural, scale) = max(0.01 * min(w, h), 24 / scale)`.
  - `isBelowMin`.
  - `hitTest` prefers the selected box, then the smallest area.
- [X] T036 [P] [US2] Unit tests for `annotationReducer` in `src/features/annotation/lib/annotationReducer.test.ts`, covering every action in contracts/annotation-store.md:
  - `CREATE` selects the new item and assigns `ordinal` from `nextOrdinal` (never reused).
  - `RENAME` trims and slices to 50 characters.
  - An unknown id returns the identical state object.
  - `DELETE` of the selected item clears `selectedId` and sets `lastDeleted`.
  - `CLEAR_ALL` → `UNDO_DELETE` restores the items at their original indices.
  - `UNDO_DELETE` with no `lastDeleted` is a no-op.
  - `RESET` clears the state for the new `imageId`.
- [X] T037 [P] [US2] Component tests for `AnnotationCanvas` in `src/features/annotation/components/AnnotationCanvas.test.tsx`, with synthetic Pointer Events and a stubbed `getScreenCTM`/`getBoundingClientRect`:
  - A drag on an empty area creates a box with the expected image-pixel rect.
  - A tap creates nothing, and a tap on an empty area deselects the selected box.
  - A second box can be drawn right after the first one without any mode switch.
  - A box at the 24 px minimum can be moved by dragging its body (corner handles sit outside it).
  - Dragging a box moves it and clamps it to the bounds.
  - Dragging the `se` and `n` handles resizes the box.
  - A second pointer during a drag cancels it and restores the rect.
  - `Delete` removes the selected box, and the toast's Undo restores it.
  - `Escape` deselects.
  - Label editing renames the box (50-character limit).
  - Pressing Backspace or Delete while focus is in the label input edits the text and does NOT delete the box.

### Implementation for User Story 2

- [X] T038 [P] [US2] Implement the pure geometry module in `src/features/annotation/lib/geometry.ts`, per contracts/annotation-store.md: `clientToImage`, `imageToClient`, `displayScale`, `rectFromPoints`, `clampRect`, `moveRect`, `resizeRect` (8 handles), `minBoxSize`, `isBelowMin` and `hitTest`. No React imports
- [X] T039 [P] [US2] Implement `annotationReducer`, its `AnnotationAction` union and `initialAnnotationState(imageId)` in `src/features/annotation/lib/annotationReducer.ts`. The `Annotation` fields follow data-model.md §3: `label` "Trimmed, 0–50 chars", `x/y ≥ 0`, `x + width ≤ image.width`, `y + height ≤ image.height`, `createdAt`, and `ordinal` "1-based creation index… never reused within a session". The state includes `lastDeleted: { items; index[] } | null`. There is no draw/select mode (data-model.md §4)
- [X] T040 [US2] Implement `AnnotationProvider` (calls `RESET` when `imageId` changes) in `src/features/annotation/state/AnnotationProvider.tsx`, and mount it in `src/app/App.tsx` around the review and annotate steps as `<AnnotationProvider key={image.id} imageId={image.id}>`. It must NOT be inside `AnnotateView`, because annotations have to survive Back to review (data-model.md §4, §6). and `useAnnotations()` in `src/features/annotation/hooks/useAnnotations.ts`. The hook returns `{ state, dispatch, selected, displayName(a) }`, where `displayName` returns the label or `Untitled {ordinal}`. The provider reports `items.length` to `useAppFlow` (T015)
- [X] T041 [P] [US2] Implement `useDisplayScale(wrapperRef, natural)` in `src/features/annotation/hooks/useDisplayScale.ts`. It uses `useResizeObserver` to return `{ rect, scale }`, where `scale` is CSS px per image px (Constitution IV)
- [X] T042 [US2] Implement `usePointerGesture` in `src/features/annotation/hooks/usePointerGesture.ts`:
  - The gesture state is `idle | drawing | moving | resizing(handle)`.
  - It uses `setPointerCapture` and converts to image space via `svg.getScreenCTM().inverse()`, falling back to `clientToImage`.
  - It tracks active pointer ids, so a second pointer or `pointercancel` cancels the gesture and restores the original rect.
  - It holds the in-progress rect in local state and commits on `pointerup`: `CREATE` unless `isBelowMin`, or `UPDATE_RECT`.
  - A press on an unselected box selects it instead of drawing.
  - A press on an empty area always starts a draft, with no mode check. If it ends below `minSize`, it is a tap and dispatches `SELECT(null)`.
  - Hit priority: handle hit areas outside the box, then the box body, then handle hit areas inside the box, then empty area.
- [X] T043 [P] [US2] Implement `AnnotationBox` in `src/features/annotation/components/AnnotationBox.tsx`:
  - An SVG `<g role="button" tabIndex={0} aria-label="Annotation {name}" aria-pressed={selected}>` containing a `<rect vector-effect="non-scaling-stroke">`.
  - The selected box gets a distinct highlight.
  - The label is an SVG `<text fontSize={14/scale}>`, truncated with an ellipsis, and flipped inside the box when `y` is near 0.
- [X] T044 [P] [US2] Implement `ResizeHandles` in `src/features/annotation/components/ResizeHandles.tsx`: 8 handles with a 12 CSS px visual size and a transparent 44 CSS px hit area (both computed as `px / scale` in image units, FR-031), and per-handle cursors (`nwse-resize`, etc.). When the box is under 88 CSS px on either axis, render only the 4 corner handles, with their hit areas centred outside the box corners, so the body stays draggable (contracts/annotation-store.md, Small boxes)
- [X] T045 [P] [US2] Implement `DraftBox` (a dashed preview rect while drawing) in `src/features/annotation/components/DraftBox.tsx`
- [X] T046 [US2] Implement `AnnotationCanvas` in `src/features/annotation/components/AnnotationCanvas.tsx`:
  - A wrapper `div` with `style={{ aspectRatio: \`${w} / ${h}\` }}`, plus `max-width: 100%` and `max-height: 100%`.
  - An `<img src={image.objectUrl} draggable={false}>` and an `<svg viewBox="0 0 W H" preserveAspectRatio="none" style="touch-action:none">`, both absolutely filling the wrapper.
  - Renders the boxes in creation order, with the selected box last, plus the handles and the draft.
  - Keyboard handling: Delete/Backspace deletes, Escape deselects, Enter focuses the label editor. Shortcuts are ignored when `event.target` is an `input`, a `textarea` or `contenteditable`.
- [X] T047 [P] [US2] Implement `LabelEditor` in `src/features/annotation/components/LabelEditor.tsx`. It is an input bound to the selected annotation (`maxLength={50}`, with a character counter shown from 40 characters) that commits `RENAME` on Enter or blur and cancels on Escape. It appears near the selected box on desktop and in the toolbar area on mobile
- [X] T048 [US2] Implement `AnnotationToolbar` in `src/features/annotation/components/AnnotationToolbar.tsx`. It has a hint line ("Drag on the photo to add a box"), a Delete button (enabled when a box is selected), Back to review (`BACK_TO_REVIEW`), Retake (opens a `ConfirmDialog` when annotations exist, FR-028, dispatching `CONFIRM` on accept), and slots for the list toggle (US7) and the compact quality badge (US4)
- [X] T049 [US2] Implement delete with undo: on `DELETE`, call `notify.undo("Annotation deleted", onUndo, { durationMs: 5000, onDismiss })` from `src/shared/ui/toast.ts`. The **Undo** action that dispatches `UNDO_DELETE`, and dispatch `DISMISS_UNDO` when it closes. Put this in `src/features/annotation/hooks/useAnnotations.ts` (a `deleteWithUndo` helper) (FR-026)
- [X] T050 [US2] Implement `AnnotateView` in `src/features/annotation/components/AnnotateView.tsx`, which consumes the App-level `AnnotationProvider` from T040 and composes the toolbar, the canvas (centered and filling the remaining space) and the label editor, and wire it into the `annotate` step in `src/app/App.tsx` inside its `ErrorBoundary`
- [X] T051 [US2] Extend `tests/e2e/capture-to-annotate.spec.ts` (part 2): after accepting, draw a box by mouse (desktop) and by touch (`pixel-7`, using `page.touchscreen`/pointer events), label it "Bottle", move it, resize it from the `se` handle, delete it, click Undo, and assert that the box and its label are visible

**Checkpoint**: The full capture → annotate flow works with touch and mouse

---

## Phase 5: User Story 3 - Annotations stay aligned at any size (Priority: P1)

**Goal**: Boxes keep their position relative to the image content across window resizes,
orientation changes and panel toggles.

**Independent Test**: Draw a tight box, resize the viewport from 1440 to 360 px and rotate, and
confirm the box still outlines the object (quickstart V14).

### Tests for User Story 3 ⚠️

- [X] T052 [P] [US3] Unit test the round trip in `src/features/annotation/lib/geometry.test.ts` (add to it): `clientToImage(imageToClient(p, rect, natural), rect, natural) ≈ p` within 1e-6 across random display rects and natural sizes (fast-check). Also check that a rect drawn at display scale 0.25 maps to the same image region as at scale 1.0, within 1% of the image dimensions (SC-003)
- [X] T053 [P] [US3] E2E alignment test in `tests/e2e/alignment.spec.ts`:
  1. Capture and accept, then draw a box.
  2. Record the box's `getBoundingClientRect()` relative to the image's rect, as fractions.
  3. Resize the viewport to 1440×900 → 768×1024 → 360×740 → 740×360.
  4. Assert the fractional position and size stay within 1%.
  5. Toggle the side panel and assert again.

### Implementation for User Story 3

- [X] T054 [US3] Verify and harden the `AnnotationCanvas` layout in `src/features/annotation/components/AnnotationCanvas.tsx`. The wrapper is sized by `aspect-ratio` inside a flex container with `min-h-0 min-w-0`, so the image never overflows. The `<img>` uses `w-full h-full object-fill` (the wrapper already has the exact ratio). Strokes, handles and labels re-derive from `useDisplayScale` on every resize. There must be no stored screen-pixel values anywhere in annotation state
- [X] T055 [US3] Handle orientation and `visualViewport` changes in `src/features/annotation/hooks/useDisplayScale.ts`: listen to `orientationchange` and `visualViewport.resize` in addition to `ResizeObserver`, and cancel any in-progress gesture when the layout changes mid-drag (via a callback exposed by `usePointerGesture`)

**Checkpoint**: The P1 stories are complete (capture, annotate, alignment), giving a strong demo
baseline

---

## Phase 6: User Story 4 - See and act on image quality (Priority: P2)

**Goal**: A quality indicator showing resolution, file size, brightness and sharpness, with an
overall verdict (Good / Fair / Poor) and actionable tips. It is prominent on Review and compact on
Annotate.

**Independent Test**: A well-lit capture shows Good. A dark or blurred capture shows a lower
verdict with specific tips, and Retake is emphasized (quickstart V10, V11).

### Tests for User Story 4 ⚠️

- [X] T056 [P] [US4] Unit tests for the metrics in `src/features/quality/lib/metrics.test.ts`: `meanLuma` of all-black is 0, all-white is 100, and mid-gray (128) is about 50.2. `toGrayscale` uses Rec.709 weights. `laplacianVariance` of a flat buffer is 0, a checkerboard gives a high value, and a box-blurred checkerboard gives a much lower value
- [X] T057 [P] [US4] Unit tests for `assessQuality` in `src/features/quality/lib/assess.test.ts`:
  - Each threshold boundary is tested on both sides, per FR-020: 5.0 MP → good, 4.99 → fair, 2.0 → fair, 1.99 → poor. File size 150 KB / 500 KB / 15 MB. Brightness 15 / 25 / 80 / 90. Sharpness 40 / 100.
  - Verdict = worst rating.
  - Null brightness or sharpness → `fair` with "Couldn't analyze…" and no tip.
  - The torch tip appears only when `torchSupported`.
  - `formatBytes` and `formatResolution` output.

### Implementation for User Story 4

- [X] T058 [P] [US4] Create `QUALITY_THRESHOLDS` in `src/features/quality/lib/thresholds.ts`, the single source of truth for every threshold. The values come from FR-020 and research R8: `resolutionMP { good: 5, fair: 2 }`, `fileSizeBytes { goodMin: 500_000, goodMax: 15_000_000, fairMin: 150_000 }`, `brightnessPct { goodMin: 25, goodMax: 80, fairMin: 15, fairMax: 90 }`, and `sharpness { good: 100, fair: 40 }`. Also export a message and tip copy table for each check and rating
- [X] T059 [P] [US4] Implement the pure metric functions `toGrayscale(rgba)`, `meanLuma(rgba)` (Rec.709, 0–100) and `laplacianVariance(gray, w, h)` (3×3 kernel `[0,1,0;1,-4,1;0,1,0]`, ignoring the border) in `src/features/quality/lib/metrics.ts`
- [X] T060 [P] [US4] Implement `assessQuality(metrics, thresholds?, ctx?)`, `worstRating`, `formatBytes` and `formatResolution` in `src/features/quality/lib/assess.ts` and `src/features/quality/lib/format.ts`, per contracts/quality.md. Checks are always produced in the order resolution, fileSize, brightness, sharpness
- [X] T061 [US4] Implement `measureImage(image)` in `src/features/quality/lib/measure.ts`. It decodes `image.blob`, draws it to a canvas downscaled to a 512 px longest side, gets the `ImageData`, and computes `brightnessPct` and `sharpness`. On any failure it returns `null` for both, keeping `width`, `height` and `byteSize`. Log the timing with `performance.now()` in dev
- [X] T062 [US4] Implement `useQualityAssessment(image)` in `src/features/quality/hooks/useQualityAssessment.ts`. It returns `pending` immediately with resolution and size, then `ready`. Results are memoized per `image.id` in a module-level `Map`, so moving from Review to Annotate does not recompute them. It reads `torchSupported` through an optional context, and defaults to false
- [X] T063 [P] [US4] Implement `QualityCheckRow` in `src/features/quality/components/QualityCheckRow.tsx`, showing an icon and color plus a text rating (never color alone), the value, and the message and tip when the rating is not good
- [X] T064 [US4] Implement `QualityIndicator` with `variant: "full" | "compact"` in `src/features/quality/components/QualityIndicator.tsx`. The full variant shows the verdict badge, the "12.2 MP (4032 × 3024) · 3.4 MB" line and the 4 rows. The compact variant shows a badge with MP and size and opens the full variant in a `Popover` (desktop) or `Sheet` (mobile). The container has `role="status" aria-live="polite"`. A skeleton shows while pending
- [X] T065 [US4] Integrate the indicator into `src/features/review/components/ReviewView.tsx` (full variant, visible without scrolling at 360×740: a bottom card on phones, a side panel at ≥ 1024 px). When the verdict is `poor`, give **Retake** primary emphasis and show "Use anyway" as secondary (FR-019). Add the compact variant to the `AnnotationToolbar` slot in `src/features/annotation/components/AnnotationToolbar.tsx` (FR-014)
- [X] T066 [US4] Component test in `src/features/quality/components/QualityIndicator.test.tsx`: given a stubbed assessment it renders the verdict, resolution, size and failed-check tips. Retake is emphasized when poor. The compact variant expands to the full one
- [X] T067 [US4] Add a hidden "technical details" disclosure in the full indicator showing the raw values (luma %, Laplacian variance and `captureMethod`), used for the sharpness calibration in quickstart, in `src/features/quality/components/QualityIndicator.tsx`

**Checkpoint**: Quality feedback is visible on Review and Annotate

---

## Phase 7: User Story 5 - Clear guidance when the camera is unavailable (Priority: P2)

**Goal**: A specific message and recovery action for each camera failure, plus the "Choose a
photo" upload fallback into the same flow.

**Independent Test**: Denied, no camera, busy, insecure, and interrupted each show their own view
with a working action (quickstart V3–V7).

### Tests for User Story 5 ⚠️

- [X] T068 [P] [US5] Unit tests for `classifyCameraError` in `src/features/camera/lib/cameraErrors.test.ts`, covering every row of research R4: insecure context, missing API, `NotAllowedError` with `permissionState` `denied` vs `prompt`, `SecurityError`, `NotFoundError`, `OverconstrainedError` (after the ladder is exhausted), `NotReadableError`, `AbortError`, and unknown errors
- [X] T069 [P] [US5] Component tests for the camera error states in `src/features/camera/components/CameraView.test.tsx`, using `fakeMediaDevices`. For each `CameraErrorKind`, assert the specific heading and that the primary and secondary actions match the UI states table in contracts/camera.md. "Try again" calls `getUserMedia` again. A track `ended` event while live shows "Camera disconnected" with Reconnect
- [X] T070 [P] [US5] Unit test for `fileToCapturedImage` in `src/features/upload/lib/fileToCapturedImage.test.ts`: a valid image gives `source: "upload"` and `captureMethod: "file"`. A non-image type or a decode failure rejects with a user-friendly error

### Implementation for User Story 5

- [X] T071 [P] [US5] Implement the `CameraErrorKind` union, the `CameraError` type, `classifyCameraError(err, env)` and a per-kind message map in `src/features/camera/lib/cameraErrors.ts`, per research R4 and contracts/camera.md
- [X] T072 [US5] Integrate error handling into `src/features/camera/hooks/useCamera.ts`:
  - Pre-flight checks for `isSecureContext` and `navigator.mediaDevices?.getUserMedia` before any prompt.
  - Classify failures via T071, with a best-effort `navigator.permissions.query({ name: "camera" })` hint wrapped in try/catch.
  - Listen for the track's `ended` event → `stream-interrupted`.
  - Expose `error`, and make `retry()` safe to call from any error state.
- [X] T073 [P] [US5] Implement `PermissionPrimer` in `src/features/camera/components/PermissionPrimer.tsx`, shown while `requesting` on first use: "Allow camera access to take a photo", a spinner, and a secondary "Choose a photo instead"
- [X] T074 [P] [US5] Implement `fileToCapturedImage(file)` in `src/features/upload/lib/fileToCapturedImage.ts`. It validates `file.type.startsWith("image/")` and creates the image via `createCapturedImage` (T012) with `source: "upload"` and `captureMethod: "file"` (FR-012)
- [X] T075 [P] [US5] Implement `ChoosePhotoButton` in `src/features/upload/components/ChoosePhotoButton.tsx`. It uses a hidden `<input type="file" accept="image/*">` and on success dispatches `UPLOADED(image)`. On failure it calls `notify.error("That file couldn't be opened as an image")` and leaves the state unchanged
- [X] T076 [US5] Implement `CameraErrorState` in `src/features/camera/components/CameraErrorState.tsx`, rendering the heading, an explanation, browser-specific re-enable hints (Chrome / Safari / Firefox, for `permission-denied`), and primary and secondary actions per kind, exactly as in the contracts/camera.md UI states table. For `unknown`, the details go in a `<details>` element. Focus moves to the heading when the state is shown, and it is announced via `role="alert"`
- [X] T077 [US5] Integrate `PermissionPrimer`, `CameraErrorState` and `ChoosePhotoButton` into `src/features/camera/components/CameraView.tsx`, replacing the US1 error placeholder. Also add a small "Choose a photo" link in the live control bar for desktop users
- [X] T078 [US5] Write the e2e test `tests/e2e/permission-denied.spec.ts`, run only by the `chromium-denied` Playwright project from T007 (which has `--deny-permission-prompts` and no fake-UI flag), assert the "Camera access blocked" view, then use the upload fallback with a fixture image `tests/e2e/fixtures/sample.jpg` and assert Review shows its resolution

**Checkpoint**: No camera failure is a dead end, and desktops without cameras can still annotate

---

## Phase 8: User Story 6 - Control the torch on supported devices (Priority: P2)

**Goal**: A torch toggle shown only when supported, reflecting the confirmed hardware state, with
a pending state, failure revert and a reset when the track changes.

**Independent Test**: Android Chrome: 10 toggles match the light. iOS or desktop: the toggle is
disabled with an explanation (quickstart V8, V9).

### Tests for User Story 6 ⚠️

- [X] T079 [P] [US6] Component tests for `useTorch` in `src/features/camera/hooks/useTorch.test.tsx`, using `fakeTrack`:
  - No `torch` capability → `supported: false`, and `toggle` is a no-op.
  - With the capability, `toggle()` → `pending: true` → after `applyConstraints` resolves, `on` equals `getSettings().torch`. A fake that resolves but reports `torch: false` must yield `on: false`, proving the state is not optimistic.
  - A rejection keeps `on` at its previous value and sets `error`.
  - Changing the track resets the state, and an `ended` track gives `on: false`.
- [X] T080 [P] [US6] Component test for `TorchToggle` in `src/features/camera/components/TorchToggle.test.tsx`: unsupported → disabled with the explanation tooltip text present. `aria-pressed` reflects the confirmed state. There is a busy indicator while pending. A failure shows a toast

### Implementation for User Story 6

- [X] T081 [US6] Implement `useTorch(track)` in `src/features/camera/hooks/useTorch.ts`, per research R5 and contracts/camera.md: `supported` comes from `"torch" in track.getCapabilities()`, `toggle` and `setTorch` use `applyConstraints({ advanced: [{ torch }] })`, `on` is read back only from `track.getSettings().torch`, and there are `pending` and `error` states plus a reset when the track changes or ends
- [X] T082 [US6] Implement `TorchToggle` in `src/features/camera/components/TorchToggle.tsx`. It uses the `Toggle` wrapper with a 48 px target, a flashlight / flashlight-off icon, `aria-pressed={on}`, and `aria-label="Torch"`. While pending it shows a spinner and stays disabled. When unsupported it is disabled with the tooltip and visible caption "Flash isn't supported on this device or browser". On error it calls `notify.error("Couldn't turn on the flash")`. Icons come from `src/shared/ui/icons.ts`
- [X] T083 [US6] Integrate `TorchToggle` into the `CameraView` control bar in `src/features/camera/components/CameraView.tsx`, passing `useCamera().track`. Provide `torchSupported` to the quality context (T062), so the brightness tip can suggest the torch. Confirm the torch reads off after capture, after a camera switch and on leaving the screen

**Checkpoint**: All camera requirements are met

---

## Phase 9: User Story 7 - View and manage all annotations (Priority: P2)

**Goal**: An annotation list with synchronized selection, rename, delete, count, confirmed Clear
all, and an empty state. It is a bottom sheet on phones and a side panel on tablet and desktop.

**Independent Test**: Create 5 boxes, then select, rename and delete from the list, and Clear all
with confirmation (quickstart V15).

### Tests for User Story 7 ⚠️

- [X] T084 [P] [US7] Component tests for `AnnotationList` in `src/features/annotation/components/AnnotationList.test.tsx`:
  - Rows render in creation order with `Untitled {n}` defaults and a count header.
  - Selecting a row selects the box, and selecting a box highlights its row.
  - Inline rename dispatches `RENAME` (50-character limit).
  - The row delete button removes the box (with the undo toast).
  - Clear all opens the confirmation, and cancel keeps the items.
  - An empty list shows "Drag on the photo to draw your first box".

### Implementation for User Story 7

- [X] T085 [P] [US7] Implement `AnnotationListItem` in `src/features/annotation/components/AnnotationListItem.tsx`. It shows a selectable row (`aria-selected`), the display name, an inline rename input (`maxLength={50}`, committing on Enter or blur), and a delete `IconButton`. The selected row scrolls into view (`scrollIntoView({ block: "nearest" })`)
- [X] T086 [US7] Implement `AnnotationList` in `src/features/annotation/components/AnnotationList.tsx`, with a header showing the "{n} annotations" count and a "Clear all" button (`ConfirmDialog` → `CLEAR_ALL`, undo toast), rows from `useAnnotations()`, and the empty state
- [X] T087 [US7] Integrate the list into `src/features/annotation/components/AnnotateView.tsx`. At ≥ 768 px (`useMediaQuery`) it is a persistent, collapsible side panel. Below 768 px it is a `Sheet` (bottom sheet) opened from the toolbar's list toggle, showing the count badge, in `src/features/annotation/components/AnnotationToolbar.tsx`. Confirm the canvas re-fits when the panel toggles (covered by T053)

**Checkpoint**: All core stories (US1–US7) are complete. Run the full quickstart validation before
starting US8

---

## Phase 10: User Story 8 - Export the annotated result (Priority: P3, enhancement)

**Goal**: Download the annotation JSON and a full-resolution image with the boxes drawn on it.

**Independent Test**: Export data validates against contracts/export-format.schema.json, with
full-resolution pixel coordinates (quickstart V18).

⚠️ Start only after Phase 11 tasks T090–T097 are done and all core checkpoints are green
(Constitution I). Phase 10 is numbered before Phase 11 for task-ID stability only; in practice it
**runs after** T090–T097 (see the Story Completion Graph).

- [X] T088 [P] [US8] Unit test `buildExport(image, annotations, assessment)` in `src/features/annotation/lib/exportAnnotations.test.ts`: the output validates against `specs/001-image-capture-annotation/contracts/export-format.schema.json` (use `ajv` as a devDependency), coordinates are rounded to integers, and labels are ≤ 50 characters
- [X] T089 [US8] Implement `buildExport`, `downloadJson` and `renderAnnotatedImage` (an offscreen canvas at the full natural size that draws the image, the boxes and labels scaled to the image, and outputs JPEG 0.95) in `src/features/annotation/lib/exportAnnotations.ts`. Add an "Export" menu (Data / Image) to `src/features/annotation/components/AnnotationToolbar.tsx`

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Responsiveness, accessibility, documentation, deployment and final validation.
Documentation and deployment are required deliverables (FR-037–FR-040).

- [X] T090 Responsive pass at 360×740, 768×1024 and 1280×800, in portrait and landscape, across all three views. Fix clipping, overlap and horizontal scroll, and handle safe-area insets (`env(safe-area-inset-*)`) for the camera controls on notched phones, in `src/styles/index.css` and the view components (FR-030, SC-009)
- [X] T091 [P] Accessibility pass. Every control is keyboard-reachable with a visible focus ring and has an accessible name. Status changes are announced (quality verdict, torch state, errors). Run `@axe-core/playwright` in `tests/e2e/a11y.spec.ts` on each step, with no serious or critical violations (FR-034)
- [X] T092 [P] Feedback audit: every action shows visible feedback within 100 ms, operations over 300 ms show a progress indicator, and all animations respect `prefers-reduced-motion` (FR-032). Check the shutter, retake, torch, delete and label save in each view component
- [ ] T093 Run sharpness threshold calibration per quickstart.md: 10 sharp and 10 blurred captures per reference device. Update `src/features/quality/lib/thresholds.ts` if needed so that SC-007 holds (≥ 9 of 10 correct per class), and record the measured values for the README
- [X] T094 [P] Write `README.md`, covering:
  - Overview and live URL.
  - Setup (Node 22, `npm install`, `npm run dev`, and `npm run dev:https` for phones, including the certificate warning and the `cloudflared` alternative).
  - Scripts and how to run the tests.
  - Architecture overview (feature folders, hooks vs. pure lib).
  - Library choices with reasons (research R6, R10).
  - The quality thresholds table with justification and calibration results.
  - A browser and device support matrix, including the torch behavior observed on the test devices.
  - Implementation decisions.
  - Known limitations and trade-offs: single image, no persistence, rectangles only, the cropped live preview vs. the full capture, and iOS torch.

  (FR-037)
- [X] T095 [P] Write `docs/TECHNICAL_NOTES.md`, a brief explanation of the image capture strategy (the constraint ladder, capability upgrade, `takePhoto` vs. canvas fallback, reporting the actual resolution), the quality assessment (the metrics, why these checks, the thresholds, performance), and the annotation approach (the SVG viewBox in image space, Pointer Events, 44 px handles, reducer and undo), each with a short diagram or code reference (FR-038)
- [X] T096 Deploy (done on Netlify: https://img-capture-annotation.netlify.app/; originally planned for Vercel): connect the repository or run `npx vercel --prod`, with framework preset Vite and output `dist`. Add a `vercel.json` only if needed. Verify HTTPS camera access on a real phone, and add the public URL to `README.md` (FR-040)
- [ ] T097 Run the full quickstart.md validation (V1–V17) on the reference devices (Android Chrome, iPhone Safari, laptop) against the deployed URL, plus `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`. Also do the following and record the results:
  - Measure the time from capture until the quality rating appears for a 12 MP photo on a mid-range phone, using the dev timing from T061. It must be ≤ 1 s (SC-008).
  - Time the first-use flow, from opening the app to one labeled box, on a phone and a desktop (≤ 60 s, SC-001).
  - Run a 5-person hallway test of draw, move, resize, label and delete on touch (at least 4 of 5 succeed unaided, SC-006).
  - Add a Playwright assertion in `tests/e2e/capture-to-annotate.spec.ts` that no request goes to another origin during the flow (FR-035).

  Fix any failures, and record everything in the README's tested-devices section
- [X] T098 Code cleanup. Remove dead code and dev-only logs (keep the measure timing behind `import.meta.env.DEV`), make sure no `src/features/*/lib` module imports React (the lint rule from T005 passes), and confirm the initial JS bundle is under 200 KB gzipped (`npm run build` output)
- [ ] T099 Record the demo video (manual): capture → quality feedback → torch (Android) → annotate (draw, move, resize, label, delete, undo) → list → resize alignment → an error state → upload fallback. Link it in `README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and BLOCKS all stories.
- **US1 (Phase 3)**: Depends on Foundational. It is the MVP.
- **US2 (Phase 4)**: Depends on Foundational. End-to-end use needs an image from US1 (or from the
  US5 upload). Component tests use a fixture `CapturedImage`, so it can be built in parallel with
  US1.
- **US3 (Phase 5)**: Depends on US2 (it hardens the canvas).
- **US4 (Phase 6)**: Depends on Foundational plus the ReviewView from US1 (T032). The toolbar
  integration (T065, second half) needs the US2 toolbar (T048).
- **US5 (Phase 7)**: Depends on US1 (it extends `useCamera` and `CameraView`).
- **US6 (Phase 8)**: Depends on US1 (it needs `useCamera().track` and the `CameraView` control
  bar). T083's quality-context hook-up needs T062.
- **US7 (Phase 9)**: Depends on US2 (the annotation store and toolbar).
- **US8 (Phase 10)**: Depends on US2 and US4, and on the core Polish deliverables
  (T090–T097) per Constitution I.
- **Polish (Phase 11)**: Depends on US1–US7. T099 runs last.

### Story Completion Graph

```text
Setup → Foundational ─┬─► US1 ─┬─► US5
                      │        ├─► US6
                      │        └─► US4 (review part)
                      └─► US2 ─┬─► US3
                               ├─► US7
                               └─► US4 (toolbar badge)
US1..US7 ─► Polish (T090–T098) ─► US8 (enhancement) ─► T099 demo
```

### Within Each User Story

- Write the tests first and confirm they fail.
- Build pure `lib/` modules before hooks, and hooks before components.
- Integrate into views before the e2e test.
- Commit after each task or logical group, and keep the lint, type and test gates green.

### Parallel Opportunities

- **Setup**: T004–T008 run in parallel after T001–T003.
- **Foundational**: T011, T012, T013, T016, T017, T018 and T019 run in parallel. T014 → T015 →
  T020 run in sequence.
- **After Foundational**: US1 and US2 can proceed in parallel (camera files and annotation files
  do not overlap).
- **After US1**: US5, US6 and the US4 review integration can proceed in parallel. US5 and US6
  both touch `CameraView.tsx` (T077, T083), so serialize those two tasks.
- **Within each story**: All tasks marked [P] (tests and pure modules) run in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests first (parallel):
Task: "T021 constraints.test.ts"   Task: "T022 capture.test.ts"
Task: "T023 useCamera.test.tsx"    Task: "T024 ReviewView/App flow test"

# Pure modules + leaf components (parallel):
Task: "T025 constraints.ts"  Task: "T026 capture.ts"
Task: "T028 CameraPreview"   Task: "T029 ShutterButton"   Task: "T030 SwitchCameraButton"

# Then sequential: T027 useCamera → T031 CameraView → T032 ReviewView → T033 wire → T034 e2e
```

## Parallel Example: User Story 2

```bash
Task: "T035 geometry.test.ts"  Task: "T036 annotationReducer.test.ts"  Task: "T037 AnnotationCanvas.test.tsx"
Task: "T038 geometry.ts"       Task: "T039 annotationReducer.ts"       Task: "T041 useDisplayScale.ts"
Task: "T043 AnnotationBox"     Task: "T044 ResizeHandles"              Task: "T045 DraftBox"  Task: "T047 LabelEditor"
# Then: T040 provider → T042 usePointerGesture → T046 canvas → T048 toolbar → T049 undo → T050 view → T051 e2e
```

## Parallel Example: User Story 4

```bash
Task: "T056 metrics.test.ts"  Task: "T057 assess.test.ts"
Task: "T058 thresholds.ts"    Task: "T059 metrics.ts"    Task: "T060 assess.ts + format.ts"  Task: "T063 QualityCheckRow"
# Then: T061 measure → T062 hook → T064 indicator → T065 integrate → T066 test → T067 details
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 US1 → **STOP and validate** on a real phone and a laptop (quickstart V1, V2).
3. Deploy a preview to Vercel early (part of T096) to surface HTTPS and device issues on day 1–2.

### Incremental Delivery (suggested one-week schedule)

| Day | Scope | Exit check |
|-----|-------|------------|
| 1 | Setup + Foundational + US1 | Capture → review on a phone via HTTPS |
| 2 | US2 | Draw, edit, label and delete on touch and mouse |
| 3 | US3 + US4 | Alignment e2e green; quality verdicts are sensible |
| 4 | US5 + US6 | All error states and the torch verified on devices |
| 5 | US7 + Polish T090–T093 | Responsive and a11y pass; thresholds calibrated |
| 6 | T094–T098 | README, technical notes, deployed URL, full validation |
| 7 | Buffer → US8 (only if all green) → T099 demo | Submission |

### Scope-cut Order (if behind schedule, per Constitution I)

Cut in this order, recording each cut in the README's known limitations:
1. US8.
2. T067 (technical details panel).
3. `visualViewport` hardening in T055 (keep `ResizeObserver`).
4. The a11y e2e automation in T091 (keep the manual checks).

Never cut T090, T094–T097, or any core story's tests.

---

## Notes

- [P] = different files with no incomplete dependencies. [USn] maps the task to a spec user
  story for traceability.
- Constraint values quoted from data-model.md and spec FR-020/FR-023/FR-025 are authoritative.
  Change them only by amending the spec.
- `src/features/*/lib/**` stays React-free and fully unit-tested. Only `camera/hooks` calls media
  APIs (Constitution VI).
- Annotation state never holds screen-pixel values (Constitution IV).
- The torch UI state is never set from the requested value (Constitution III).
