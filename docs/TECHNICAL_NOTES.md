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

- The photo is decoded once and drawn to a canvas scaled so its long side is **512 px**, about 200K pixels.
- Brightness and sharpness are computed from that copy. This takes tens of milliseconds even for 12 MP or larger photos, and the original photo is never modified.
- Resolution and file size appear immediately. The pixel checks show "Analyzing…" until they're done.
- Results are cached per image, so moving between Review and Annotate never re-runs the analysis.

**Feedback:**

- Every non-Good check shows a plain-language message plus a fix. For example: "The image is too dark. Turn on the torch or move to better light." The torch is suggested only when the capturing camera supported it.
- A Poor verdict makes **Retake** the primary action and relabels continue as "Use anyway". You're never blocked.
- If pixel analysis fails, those checks rate Fair with "Couldn't analyze…". A missing measurement never produces a false Poor.

**Calibration.** The sharpness cut-offs (good ≥ 100, poor < 40) are provisional values from the literature for images around 500 px. The **Technical details** disclosure shows the raw luma and Laplacian values so they can be calibrated on real devices. [`quickstart.md`](../specs/001-image-capture-annotation/quickstart.md) describes the procedure.

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
