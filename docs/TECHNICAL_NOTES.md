# Technical Notes

These notes explain three parts of the app: the image capture strategy, the quality assessment, and the annotation approach. The full decision log, with the alternatives considered, is in [`specs/001-image-capture-annotation/research.md`](../specs/001-image-capture-annotation/research.md).

## 1. Image capture strategy

**Goal:** capture the highest practical resolution, and report the resolution actually obtained, not the one requested.

### Getting the stream

The code is in [`constraints.ts`](../src/features/camera/lib/constraints.ts) and [`useCamera.ts`](../src/features/camera/hooks/useCamera.ts).

1. **Ask for a lot, without forcing it.** The first request is `getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 4096 } } })`.
   - The constraints use `ideal` and never `exact` or `min`. The browser then picks the closest mode it supports instead of failing with `OverconstrainedError`.
   - A *square* ideal lets it choose the sensor's native aspect ratio in either orientation.
2. **Fall back step by step.** If the request is still over-constrained, the app retries with the facing mode only, and then with `{ video: true }`.
3. **Upgrade to the maximum.** Many devices start at 720p or 1080p even when they can do more. After the stream opens, the app compares `track.getCapabilities()` with `getSettings()`. If the capability maximum has more pixels, it calls `applyConstraints({ width: { ideal: max }, height: { ideal: max } })`.
   - It compares pixel counts rather than width and height, so a rotated portrait stream counts as already at maximum.
   - If the upgrade fails, the app keeps the original stream.

### Taking the photo

The code is in [`capture.ts`](../src/features/camera/lib/capture.ts).

```text
ImageCapture available?
 ├─ yes → getPhotoCapabilities() → takePhoto({ imageWidth: max, imageHeight: max })
 │          decode → fewer pixels than the live stream? ──yes──┐
 │                                                       no → use it ("image-capture")
 └─ no (Safari, Firefox) ───────────────────────────────────────┤
                                                                ▼
            canvas sized to video.videoWidth × video.videoHeight (never the CSS size)
            → drawImage → toBlob('image/jpeg', 0.95) ("canvas")
```

- On Android, `takePhoto()` uses the camera's still-photo pipeline, which often produces *more* pixels than any video mode. For example, a 12 MP photo from a stream that tops out at 4K.
- The "fewer pixels than the stream" check guards against desktop drivers whose photo path is worse than their video path.
- JPEG quality is 0.95, above the constitution's 0.92 floor: visually lossless at about 1/5 the size of PNG.
- Width and height always come from **decoding the resulting blob**, with EXIF orientation applied. That decoded size is what the UI shows.

### Lifecycle and errors

- **The camera is released whenever it's not needed:** after a capture, when the view unmounts, and on `visibilitychange → hidden`. It restarts when you return.
- **A stale request can't leak a camera.** Each request gets an id, so a slow request that resolves after a newer one, or after unmount, stops its tracks immediately.
- **Failures map to a closed set of error kinds.** `classifyCameraError` ([`cameraErrors.ts`](../src/features/camera/lib/cameraErrors.ts)) produces one of: `insecure-context`, `unsupported`, `permission-denied`, `permission-dismissed`, `no-camera`, `camera-busy`, `stream-interrupted`, or `unknown`.
  - The Permissions API is used only as a hint. It separates a dismissed prompt from a hard block.
  - Each kind has its own message and recovery action, and a **Choose a photo** fallback is always offered. Uploaded photos then go through the same Review and Annotate steps.

### Torch

The code is in [`useTorch.ts`](../src/features/camera/hooks/useTorch.ts).

- **Support** is detected with `'torch' in track.getCapabilities()`, re-checked whenever the track changes.
- **Toggling** sets a *pending* state, calls `applyConstraints({ advanced: [{ torch: next }] })`, and then reads `getSettings().torch`. The UI shows only that read-back value. A test proves this: a device that accepts the request but leaves the light off still displays "off".
- **On failure**, the control keeps its last confirmed state and shows a toast.
- **When the track stops or changes**, the state resets to off.

## 2. Quality assessment

The code is in [`src/features/quality/lib/`](../src/features/quality/lib/), and all thresholds are in [`thresholds.ts`](../src/features/quality/lib/thresholds.ts).

There are four checks, each rated Good, Fair, or Poor. The verdict is the worst of the four.

| Check | Measurement | Why it matters |
|---|---|---|
| Resolution | Decoded width × height, in MP | The brief requires it. It sets how much detail survives. |
| File size | `blob.size` | The brief requires it. At a given resolution, a tiny JPEG means little detail, usually a dark or covered frame. |
| Brightness | Mean Rec. 709 luma (0.2126R + 0.7152G + 0.0722B), as a percentage | The most common capture failure, and it has a direct fix (torch or more light). |
| Sharpness | **Variance of the Laplacian** (3×3 kernel) on grayscale | The second most common failure (motion or focus blur). The classic, explainable blur metric. |

**How it runs:**

- The photo is decoded once and drawn to a canvas scaled so its long side is **512 px**, about 200K pixels, using `imageSmoothingQuality: 'high'`. The default low-quality downscale aliases when shrinking about 8×, which inflated sharpness scores about 4× and made them noise-dependent.
- Brightness and sharpness are computed from that copy. This takes tens of milliseconds even for 12 MP or larger photos, and the original photo is never modified.
- Resolution and file size appear immediately. The pixel checks show "Analyzing…" until they're done.
- Results are cached per image, so moving between Review and Annotate never re-runs the analysis.

**Feedback:**

- Every non-Good check shows a plain-language message plus a fix. For example: "The image is too dark. Turn on the torch or move to better light." The torch is suggested only when the capturing camera supported it.
- A Poor verdict makes **Retake** the primary action and relabels continue as "Use anyway". You're never blocked.
- If pixel analysis fails, those checks rate Fair with "Couldn't analyze…". A missing measurement never produces a false Poor.

**Calibration.** The cut-offs are **good ≥ 300, poor < 100**. They were measured by scoring a real 12.5 MP phone photo and Gaussian-blurred copies with the app's exact pipeline: sharp ≈ 590, σ 2 px ≈ 400, σ 4 px ≈ 200, σ 8 px ≈ 55 ([`scripts/calibrate-sharpness.mjs`](../scripts/calibrate-sharpness.mjs)). The textbook starting values (100 / 40) never fired on real photos. The **Technical details** disclosure shows the raw luma and Laplacian values for further on-device checks.

## 3. Annotation approach

The code is in [`src/features/annotation/`](../src/features/annotation/).

### Alignment by construction

```text
<div style="aspect-ratio: W / H; width: min(100cqw, 100cqh · W/H)">   ← sized by container-query units
  <img  class="absolute inset-0 w-full h-full">                       ← the photo
  <svg  class="absolute inset-0 w-full h-full" viewBox="0 0 W H" preserveAspectRatio="none">
        <rect x=… y=… width=… height=…/>                              ← stored in IMAGE pixels
  </svg>
</div>
```

- The wrapper always has the photo's exact aspect ratio, and the `<img>` and `<svg>` both fill it, so they share the same box.
- Annotation geometry is stored in **intrinsic image pixels** (W × H of the photo) and rendered unchanged. The browser's `viewBox` transform does all the scaling.
- **There is no resize code to get wrong.** Window resizes, rotation, and opening the side panel all keep boxes aligned. The e2e test sweeps five viewports and toggles the panel, asserting every box stays within 1% of its position relative to the image.
- Stroke widths use `vector-effect="non-scaling-stroke"`. Labels and handles are sized as `px / scale`, so they keep a constant on-screen size. `scale` is measured with a `ResizeObserver`.

### Input

The code is in [`usePointerGesture.ts`](../src/features/annotation/hooks/usePointerGesture.ts).

- **Pointer Events** give a single code path for mouse, touch, and pen.
  - `touch-action: none` is set only on the canvas.
  - `setPointerCapture` keeps drags working when the pointer leaves the box.
- **Coordinates** are converted from screen to image space with one pure function: `clientToImage(client, svgRect, natural)`. This is the same mapping the renderer uses, and a property test checks the round trip.
- **Gestures:**
  - Pressing on empty space draws a new box. There's no mode toggle, so boxes can be drawn one after another.
  - Pressing on a box selects it and moves it once dragged more than 4 px.
  - Pressing on a handle resizes. Dragging past the opposite edge flips and normalizes the box.
  - A press shorter than the minimum size counts as a tap. A tap on empty space deselects.
- **A second finger cancels the gesture** and restores the original box, so pinching or scrolling never creates or changes annotations.
- **Live updates stay local.** During a drag, the rectangle is held in local state and committed to the reducer on `pointerup`, which keeps drags smooth.

### Geometry rules

The code is in [`geometry.ts`](../src/features/annotation/lib/geometry.ts) and is property-tested with fast-check.

- Boxes are clamped to the image. Moving preserves size, and resizing clamps only the dragged edge.
- The minimum size is `max(1% of the shorter side, 24 CSS px)`.
- **Handles:** 8 per box, each drawn at 12 px with a **44 px** hit area. Boxes smaller than 88 px on screen get only corner handles, placed *outside* the box, so the body can still be dragged.

### State and editing

- **The reducer is pure** ([`annotationReducer.ts`](../src/features/annotation/lib/annotationReducer.ts)). Labels are trimmed and capped at 50 characters, and ordinals are never reused within a session, so "Untitled 3" stays "Untitled 3".
- **Deletes are undoable.** Delete and Clear all store a token-tagged snapshot that the undo toast can restore for 5 seconds. A newer delete invalidates older Undo buttons, so an old toast can't restore the wrong box.
- **The canvas and the list read from the same store**, so selection, renaming, and deletion stay in sync in both directions.
- **Keyboard support:** Tab moves between boxes, Delete or Backspace removes one, Escape deselects, and Enter edits the label. Shortcuts are ignored while you're typing in an input.

## 4. Burst capture & multi-image sessions

This section covers feature 002. The full decision log is in
[`specs/002-burst-multi-image-capture/research.md`](../specs/002-burst-multi-image-capture/research.md),
and the limits come from constitution Principle VIII.

### Session store

The code is in [`appReducer.ts`](../src/app/appReducer.ts) and [`AppContext.tsx`](../src/app/AppContext.tsx).

- **One root reducer** holds the step and the session: the photos in capture order, the selected
  photo, one annotation slice per photo, and deleted photos still inside their undo window.
- **Per-photo annotations reuse feature 001 unchanged.** Each photo's slice is driven by the same
  `annotationReducer`; `{ type: 'ANNOTATION', photoId, action }` routes an action to one photo.
  Because the slices are separate, annotations can't leak between photos.
- **Undo targets the right photo.** Deleting an annotation captures its `photoId`, so the undo toast
  restores it to that photo even after the user has switched to another.
- **The store sits above every screen.** "Add more" goes back to the camera without unmounting the
  session.

### Tap or hold, and the burst loop

The code is in [`burstScheduler.ts`](../src/features/session/lib/burstScheduler.ts) and
[`useBurst.ts`](../src/features/camera/hooks/useBurst.ts).

- **Tap or hold.** A press of 300 ms or less is a tap and uses feature 001's single
  `takePhoto()` capture. Holding longer starts a burst.
- **The loop is sequential:** check the limits, capture one frame and **await** its encoding, then
  wait out the rest of the 333 ms interval. A slow device therefore takes fewer frames rather than
  queueing work. Unit tests check that captures never overlap, using 50 randomized runs.
- **Limits are checked before every frame:** 3 s, 10 frames, 20 photos in the session, and 150 MB.
  The memory check uses the last frame's size as the estimate. A frame that turns out larger than
  the remaining budget is **discarded and released**, so the budget is never exceeded.
- **Burst frames come from the live stream.** `takePhoto()` takes 300–1000 ms per shot and can
  refocus or fire the flash, which rules it out at about 3 fps. Burst frames are drawn from the
  live video onto a canvas at the stream's full `videoWidth × videoHeight` and encoded as JPEG 0.95
  (`captureMethod: 'burst'`). Each photo reports its own resolution.
- **Release anywhere ends the burst.** The shutter takes pointer capture, so sliding off it doesn't
  stop the burst; lifting the finger anywhere does. Only the first pointer counts, and the
  long-press context menu is prevented.
- **No ghost taps.** If a limit stops the burst while the finger is still down, the app reports it
  immediately but hands over the photos only when the finger lifts. On top of that, one synthetic
  click near the release point is swallowed for 600 ms. Without these, lifting the finger would tap
  whichever Review button had appeared under it. The Pixel 7 e2e run caught this.

### Background photo processing

The code is in [`photoProcessor.ts`](../src/features/session/lib/photoProcessor.ts).

- **One decode per photo, one photo at a time**, scheduled with `requestIdleCallback`. The
  selected photo goes first. The single decode feeds both the quality metrics (512 px analysis
  copy) and a 160 px thumbnail.
- **Paused during a burst**, so no pixel work competes with capture.
- **Thumbnails only in the strip.** It never renders full-resolution images; 20 of them at 12 MP
  would mean about 1 GB of decoded bitmaps.

### Memory accounting and release

- **Bytes held** are the live photos plus the photos inside their undo window, because their blobs
  are still in memory.
- **Release is deferred to the end of the undo window.** A deleted photo's memory is not freed
  instantly: its object URL and thumbnail are revoked when the 5 s window closes, and its bytes keep
  counting toward the limit until then.
- **Start over, reset and unmount** release everything at once.

### Measured performance

Run with `PERF=1 npm run test:e2e -- perf` (desktop Chromium, fake camera at 3840 × 2160):

- no main-thread task over 50 ms during a burst;
- under 1 ms from release to the burst stopping;
- 14–38 ms to switch photos.

The same measurement on the reference Android phone is still to be done. If the phone shows long
tasks, the documented fallback is to encode in a worker with `OffscreenCanvas` (research R4).
