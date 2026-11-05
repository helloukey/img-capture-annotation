# Phase 0 Research: Burst Capture & Multi-Image Sessions

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-11-05

This feature extends feature 001 ([../001-image-capture-annotation/research.md](../001-image-capture-annotation/research.md)).
Decisions there still apply unless one below replaces them. Each entry gives the decision, the
reason, and the alternatives considered.

---

## R1. Where session state lives

- **Decision**: Replace feature 001's `appFlowReducer` with a root `appReducer` that composes two
  slices:
  - `flow`: the current step.
  - `session`: the photos, the selected photo, the per-photo annotations, and pending deletions.

  A single `AppProvider` is mounted **above all three steps**, so going to the camera ("Add more")
  never unmounts the session. Destructive guards (start over or delete a photo while it has
  annotations) are expressed as reducer actions that UI confirmation dialogs dispatch.
- **Rationale**: In feature 001, `AnnotationProvider` is mounted only on the Review and Annotate
  steps and is keyed to one image. A multi-photo session must survive Camera → Review → Annotate →
  Camera ("Add more"). A single pure reducer keeps the cross-cutting invariants testable without
  React:
  - Deleting a photo also deletes its annotations, and undo restores both.
  - Zero photos means the app returns to the camera.
  - The limits are respected.
- **Alternatives considered**:
  - Keeping `appFlowReducer` and adding a separate `SessionProvider` was rejected. The two would have
    to coordinate through effects (for example, "the last photo was deleted, so go to camera"),
    which is race-prone.
  - Zustand would work, but adds a dependency where `useReducer` and context are enough for about 20
    photos.

## R2. Per-photo annotations

- **Decision**: `session.annotations` is a `Record<photoId, AnnotationState>`. Each entry is driven
  by feature 001's **unchanged** `annotationReducer`. The root reducer routes
  `{ type: 'ANNOTATION', photoId, action }` to the right entry.
  - `AnnotationProvider` becomes a thin adapter that exposes the selected photo's slice and binds
    `photoId` into `dispatch`. `useAnnotations()`, the canvas, the list, the shortcuts and the export
    keep their current API.
  - Undo tokens are captured together with the `photoId` at delete time, so an undo toast restores
    the annotation to the correct photo even after the user switches photos (FR-025).
- **Rationale**: This reuses 29 passing reducer and geometry tests and the whole annotation UI
  as-is. Isolation per photo is structural, so annotations can't leak between photos (SC-007,
  constitution IV).
- **Alternatives considered**: A flat list of annotations with a `photoId` field was rejected. Every
  selector and reducer action would need filtering, and leaks between photos would become possible.

## R3. Tap versus hold, and the burst scheduler

- **Decision**: A pure state machine `burstScheduler` (in `session/lib`), driven by a thin
  `useBurst` hook.
  - **Press handling**: `pointerdown` starts a 300 ms hold timer. Releasing before it fires is a tap
    and calls feature 001's single `capture()` path, which uses `takePhoto()`. When the timer fires,
    a burst starts.
  - **Loop**: capture one frame and **await** its encoding, then evaluate the limits, then wait
    `max(0, INTERVAL − elapsed)` before the next frame. The loop is sequential by construction
    (FR-004, constitution VIII), so a slow device takes fewer frames rather than falling behind.
  - **Stop reasons**: `released`, `time-limit`, `frame-limit`, `session-full`, `memory-limit`,
    `backgrounded`, `interrupted`, `toggled` (Burst button).
  - **Limit check**: runs *before* each frame, using the size of the last frame (or 4 MB before the
    first) as the size estimate for the next frame.
- **Rationale**: Every limit and stop reason can be unit-tested with fake timers and a fake capture
  function, as required by the constitution workflow gates. The hook only maps pointer, visibility
  and stream events onto scheduler inputs.
- **Alternatives considered**:
  - `setInterval` at 333 ms was rejected, because it queues captures on slow devices and violates
    sequential capture.
  - A `requestAnimationFrame` loop was rejected, because it is paused in background tabs and adds no
    benefit over awaited timeouts.

## R4. Burst frame capture path

- **Decision**: Add `captureFrame()` to `useCamera`. It reuses feature 001's
  `captureVideoFrame(video)`: a canvas at the stream's `videoWidth × videoHeight`, encoded with
  `toBlob('image/jpeg', 0.95)`. It keeps the stream running, records the known size (no decode
  needed), and tags the frame `captureMethod: 'burst'`. After the burst, the hook stops the stream
  just as `capture()` does.
- **Rationale**:
  - Constitution II (v1.1.0) allows the canvas path for burst frames, because `takePhoto()` takes
    300–1000 ms and can refocus or fire the flash per shot, which breaks a 3 fps cadence.
  - `drawImage` of a 4K frame takes a few milliseconds and `toBlob` encodes off the main thread,
    which fits the 50 ms main-thread budget.
  - The size is known from the canvas, so no decode is needed.
- **Alternatives considered**:
  - `takePhoto()` per frame was rejected as too slow, with side effects.
  - `ImageCapture.grabFrame()` would give an `ImageBitmap`, but it is Chromium-only and still needs
    encoding.
  - `OffscreenCanvas.convertToBlob` in a worker is a possible later optimization. It would need the
    frame transferred as an `ImageBitmap` (`createImageBitmap(video)`), which adds complexity for
    little gain at 3 fps. It is recorded as a fallback if profiling shows main-thread jank.

- **Outcome (T047, 2026-11-06)**: Measured with `PERF=1 npm run test:e2e -- perf` (desktop
  Chromium, Playwright fake camera at 3840 × 2160, 2 s burst, 3 runs):
  - Longest main-thread task during the burst: **under 50 ms** (no long tasks in 3 runs; one 53 ms
    task in an earlier run that included opening Review, not the burst itself).
  - Release to burst stopped: **under 1 ms**.
  - Photo switch to new image shown: **14–38 ms**.

  The `OffscreenCanvas` worker fallback is therefore **not** needed on desktop. The same
  measurement on the reference Android phone is still to do (T059), and the fallback stays
  recorded here in case the phone shows long tasks.

## R5. Background photo processing (thumbnails and quality)

- **Decision**: A `photoProcessor` service with an external store, read through
  `useSyncExternalStore`.
  - **One decode per photo**: each photo is decoded once (`createImageBitmap`, orientation from the
    image). That single bitmap is drawn twice: into the 512 px analysis canvas (feature 001's
    brightness and sharpness metrics, high-quality smoothing) and into a **160 px thumbnail**
    (`toBlob` JPEG 0.8 → object URL). The bitmap is then closed.
  - **One job at a time**: the selected photo goes first, then the rest in capture order. Each job
    is scheduled with `requestIdleCallback` (falling back to `setTimeout(0)`).
  - **Paused during a burst**: processing stops while a burst runs (FR-014, constitution VIII).
  - **Results** (`{ thumbnailUrl, metrics, status }`) are cached by photo id. Thumbnail URLs are
    revoked when a deletion becomes final or the session is cleared.
  - **Indicator**: `useQualityAssessment(image)` reads from this store, so the existing quality
    indicator keeps working unchanged.
- **Rationale**:
  - Rendering 20 full-resolution `<img>` thumbnails would make the browser decode about 20 × 48 MB
    bitmaps, which is exactly the memory risk Principle VIII exists to prevent.
  - Decoding once for both outputs halves the decode cost.
  - Processing one photo at a time keeps each idle task short.
- **Alternatives considered**:
  - `createImageBitmap` with `resizeWidth` per thumbnail was rejected: it needs a second decode, and
    its resize quality is inconsistent in Safari.
  - CSS-scaled full images were rejected as a memory blow-up.
  - Generating thumbnails during the burst was rejected, because it violates "no pixel work during a
    burst".

## R6. Memory accounting

- **Decision**: Session bytes = the sum of `byteSize` over live photos **plus photos waiting out
  their undo window**, since their blobs are still held. Thumbnails (about 10 KB each) aren't
  counted. The 150 MB cap applies to adding photos (bursts, single captures and uploads).
  - **Undo blocked when full**: undoing a deletion is refused (with a toast) if it would exceed 20
    photos or 150 MB. The undo window keeps the bytes counted, so the memory check can only fail on
    the photo count.
  - **Release**: when a deletion becomes final, its object URL and thumbnail URL are revoked. When
    the session is cleared, everything is revoked.
- **Rationale**: Encoded bytes are the only memory the app controls deterministically. Decoded
  bitmaps exist only briefly, inside the processor, one at a time.

## R7. Shutter gesture and long-press suppression

- **Decision**: The `ShutterButton` handles Pointer Events itself.
  - Pointer capture is set on press.
  - `touch-action: none`, `user-select: none` and `-webkit-touch-callout: none` are applied, and
    `onContextMenu` calls `preventDefault`.
  - Only the first `pointerId` counts. Extra pointers are ignored (edge case: second finger).
  - `pointerup` (anywhere, because of pointer capture), `pointercancel` and `lostpointercapture`
    stop the burst. Sliding off the shutter while pressing does not stop it, as in common camera
    apps (FR-003).
  - **Keyboard**: Enter or Space on the shutter makes one single capture (the activation semantics
    of a native button). Bursts from the keyboard go through the separate `BurstButton` (R8).
  - **Visual**: a ring drawn around the shutter fills over 3 s while a burst runs (an SVG stroke,
    animated with CSS over `BURST_MAX_MS`), with a live frame counter chip.
- **Rationale**: This meets constitution V (one Pointer Events path, a 300 ms threshold, long-press
  side effects suppressed) and FR-006 and FR-008.
- **Alternatives considered**: Repurposing `onClick` alone was rejected, because it can't see hold
  duration.

## R8. Burst without holding (accessibility)

- **Decision**: Add a `BurstButton` next to the shutter, using the same `IconButton` look. Its
  accessible name is "Take a burst of photos, up to 3 seconds". Activating it starts a burst through
  the same `useBurst` controller. Activating it again stops the burst (reason `toggled`).
  - While running it has `aria-pressed="true"`.
  - A polite live region announces "Burst: N photos. Stopped: <reason>" when the burst ends
    (FR-029).
- **Rationale**: Constitution V requires a burst path that doesn't depend on holding. Reusing the
  controller guarantees identical limits and feedback.

## R9. The photo strip

- **Decision**: One `PhotoStrip` component, shared by Review and Annotate.
  - **Layout**: horizontal and scrollable on phones. At 1024 px and wider it is a vertical column
    in Review and stays horizontal under the toolbar in Annotate.
  - **Items**: each item is a `button` with `aria-pressed` for selection and the accessible name
    "Photo 3 of 8, Fair quality, 2 annotations". It shows the thumbnail (or a skeleton), a quality
    dot, an annotation-count badge, and a burst marker.
  - **Keyboard**: arrow keys move between items (roving tabindex). Delete or Backspace deletes the
    focused photo, using the same confirm or undo rules (FR-030).
  - **Single photo**: hidden when the session has one photo (FR-032).
- **Rationale**: One component keeps selection identical between the two steps, and the session
  store owns `selectedId`, so the selection persists between them.

## R10. Review actions and single-photo compatibility

- **Decision**:
  - **One photo**: Review keeps feature 001's **Retake** and **Use Photo** / **Use anyway**
    actions. Retake removes that one photo (undoable) and returns to the camera. A small
    tertiary **Add more** link is the only visible addition.
  - **Several photos**:
    - Primary: **Continue to annotate**.
    - Secondary: **Add more**, **Start over** (with confirmation if any annotations exist), and
      **Delete photo** (for the selected photo).
- **Rationale**: FR-032 asks for a one-photo session to look and behave like feature 001. "Add more"
  is the minimum addition that lets a single-capture user grow the session without having to know
  about bursts. This is noted in the README as a deliberate, minor visual change.

## R11. Multiple uploads

- **Decision**: `ChoosePhotoButton` gets `multiple`. Files are processed in order, one at a time,
  through `fileToCapturedImage`, and each is checked against the limits before it's added. A
  summary toast lists anything skipped ("2 skipped: session full", "1 skipped: not an image").
- **Rationale**: This is a small change to the existing upload fallback, and it reuses the same
  limit checks as bursts (FR-031).

## R12. Testing strategy (additions)

- **Unit (Vitest)**:
  - `burstScheduler`, with fake timers and a fake capture. Covers:
    - the 300 ms tap/hold boundary on both sides;
    - the cadence;
    - every limit and stop reason;
    - that captures never overlap;
    - that a slow capture yields fewer frames.
  - `appReducer`'s session slice. Covers:
    - adding photos up to the limits;
    - selection after deletion;
    - delete plus undo restoring both the photo and its annotations;
    - undo refused when the session is full;
    - final deletion reporting the URLs to release;
    - start over;
    - zero photos sending the user to the camera;
    - annotation routing per photo.
  - The limits helpers.
- **Component (RTL)**:
  - `ShutterButton`: tap versus hold, the long-press `contextmenu` being prevented, and only the
    first pointer counting.
  - `PhotoStrip`: selection, keyboard navigation, delete with confirm or undo, and accessible
    names.
  - Per-photo annotation isolation across a switch: draw on A, switch to B, draw, switch back.
  - `photoProcessor`: queue order, pause and resume, and revocation on release.
- **E2E (Playwright, fake camera)**:
  - Hold the shutter for about 1.2 s with mouse and with touch (CDP), and expect at least 3 photos
    in Review.
  - Tap and expect exactly 1 photo.
  - Delete with undo.
  - Annotate 2 photos and check isolation.
  - Run bursts until the session is full and check that the shutter is disabled with its message.
- **Rationale**: This covers every testing item that constitution v1.1.0 adds, and SC-002, SC-004
  and SC-007.
