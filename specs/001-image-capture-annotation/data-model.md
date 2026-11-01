# Phase 1 Data Model: Image Capture & Annotation

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

All state lives on the client and in memory (spec Assumptions, FR-035). Types are written in
TypeScript notation because that is the implementation language. Field semantics are what
matter here; exact type names may change slightly during implementation.

---

## 1. CapturedImage

The single photo being worked on. It is immutable once created, and replacing the photo
creates a new instance.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `string` | A unique id (`crypto.randomUUID()`). Annotations are scoped to it. |
| `blob` | `Blob` | The full-resolution encoded image. It is never downscaled (FR-007). |
| `objectUrl` | `string` | Created from `blob`. It MUST be revoked when the image is replaced or discarded. |
| `width` | `number` | Intrinsic pixel width after EXIF orientation is applied. Integer, > 0. |
| `height` | `number` | Intrinsic pixel height after orientation. Integer, > 0. |
| `byteSize` | `number` | `blob.size`. |
| `mimeType` | `string` | For example `image/jpeg`. Must start with `image/`. |
| `source` | `"camera" \| "upload"` | |
| `captureMethod` | `"image-capture" \| "canvas" \| "file"` | Which strategy from research R3 or R9 produced it. Shown in the technical details. |
| `capturedAt` | `number` | Epoch ms. |
| `cameraLabel` | `string \| undefined` | Present when known (after permission is granted). |

**Derived**: `megapixels = width * height / 1e6`; `aspectRatio = width / height`.

## 2. QualityAssessment

The result of evaluating a `CapturedImage` against `QUALITY_THRESHOLDS`.

| Field | Type | Rules |
|-------|------|-------|
| `imageId` | `string` | References `CapturedImage.id`. |
| `checks` | `QualityCheck[]` | Always exactly 4: `resolution`, `fileSize`, `brightness`, `sharpness`, in that order. |
| `verdict` | `QualityRating` | `= worst(checks[].rating)` (FR-018). |
| `status` | `"pending" \| "ready" \| "error"` | `pending` while the metrics are computed. On `error` (a decode failure), only resolution and size are shown and an "analysis unavailable" note appears. |

**QualityCheck**

| Field | Type | Rules |
|-------|------|-------|
| `id` | `"resolution" \| "fileSize" \| "brightness" \| "sharpness"` | |
| `rating` | `"good" \| "fair" \| "poor"` | Ordered good < fair < poor for the `worst()` comparison. |
| `value` | `number` | Raw measurement: MP, bytes, luma % (0–100), or Laplacian variance. |
| `display` | `string` | A formatted value, for example `"12.2 MP (4032 × 3024)"` or `"3.4 MB"`. |
| `message` | `string \| undefined` | Present when the rating is not `good` (FR-017). |
| `tip` | `string \| undefined` | An actionable fix, present when the rating is not `good`. |

**QualityThresholds**: a constants object in `src/features/quality/lib/thresholds.ts`. Values come
from spec FR-020 and research R8. Example shape:
`{ resolutionMP: { good: 5, fair: 2 }, fileSizeBytes: { goodMin: 500_000, fairMin: 150_000,
goodMax: 15_000_000 }, brightnessPct: { goodMin: 25, goodMax: 80, fairMin: 15, fairMax: 90 },
sharpness: { good: 100, fair: 40 } }`.

## 3. Annotation

A labeled rectangle on a `CapturedImage`. Its geometry is in **intrinsic image pixels**
(Constitution IV).

| Field | Type | Rules |
|-------|------|-------|
| `id` | `string` | Unique and stable. Used as the React key and the list key. |
| `label` | `string` | Trimmed, 0–50 characters (FR-025). If empty, it is displayed as `Untitled {n}`. |
| `x` | `number` | ≥ 0. Left edge, in image px. |
| `y` | `number` | ≥ 0. Top edge, in image px. |
| `width` | `number` | ≥ `minSize`, and `x + width ≤ image.width`. |
| `height` | `number` | ≥ `minSize`, and `y + height ≤ image.height`. |
| `createdAt` | `number` | Sets the creation order of the list (spec US7-1). |
| `ordinal` | `number` | 1-based creation index, used for `Untitled {n}`. It is never reused within a session. |

**Validation and normalization**, enforced by the pure functions in `geometry.ts`:

- **Normalize**: After a draw or resize in any direction, `width` and `height` are positive and
  `x, y` is the top-left corner.
- **Clamp**: The box is clamped to `[0, image.width] × [0, image.height]`. A move translates the
  box without changing its size. A resize clamps only the edge being dragged.
- **minSize**: `max(0.01 * min(image.width, image.height), 24 / displayScale)`. The minimum is
  1% of the image's shorter side, but never below 24 CSS px on screen (FR-023). Drags that end
  below `minSize` on either axis do not create an annotation (US2-7).
- Coordinates are kept as floats in state and rounded to integers only on export.

## 4. AnnotationState (reducer)

| Field | Type | Notes |
|-------|------|-------|
| `imageId` | `string \| null` | The state is reset when the image changes. |
| `items` | `Annotation[]` | Kept in creation order. Render order is creation order, with the selected item rendered last (on top). |
| `selectedId` | `string \| null` | |
| `lastDeleted` | `{ items: Annotation[]; index: number[] } \| null` | Supports undo of a single delete or of "Clear all" (FR-026). |
| `nextOrdinal` | `number` | |

The actions are defined in [contracts/annotation-store.md](./contracts/annotation-store.md).

There is no draw/select mode. Pressing on an empty image area always starts a new box, pressing
on a box selects it, and a tap on an empty area deselects (spec US2-1, US2-7).

**Lifetime**: `AnnotationProvider` is mounted at the `App` level, keyed by `image.id`, and NOT
inside `AnnotateView`. Annotations therefore survive Annotate → Review → Annotate, and are cleared
only when the image changes or a confirmed retake happens.

## 5. CameraSession

This is runtime state owned by `useCamera`. It is not serialized.

| Field | Type | Notes |
|-------|------|-------|
| `status` | `CameraStatus` | See the state machine below. |
| `stream` | `MediaStream \| null` | |
| `track` | `MediaStreamTrack \| null` | The active video track. |
| `devices` | `{ deviceId: string; label: string }[]` | Video inputs. Labels are empty until permission is granted. |
| `activeDeviceId` | `string \| null` | |
| `resolution` | `{ width: number; height: number } \| null` | Taken from `track.getSettings()`, which is what the camera actually delivers. |
| `error` | `CameraError \| null` | `{ kind: CameraErrorKind; message: string; cause?: unknown }` |

**TorchState** is owned by `useTorch(track)`:
`{ supported: boolean; on: boolean; pending: boolean; error: string | null }`.
`on` is only ever set from `track.getSettings().torch` (research R5).

### CameraStatus state machine

```text
             start()
   idle ───────────────► requesting ──success──► live ──capture()──► capturing ──► (stream stopped) idle
    ▲                        │                    │  │                    │
    │                        │ failure            │  └─track ended──► error(stream-interrupted)
    │                        ▼                    │
    └──retry()/stop()──── error(kind) ◄───────────┘ (switchCamera failure)

   unsupported / insecure-context are detected before requesting → error(kind), no retry action
```

Torch: `unsupported` ◄─(track changes, no capability)─ `off` ⇄ `pending` ⇄ `on`. Any track
stop moves it to `off`. A failure in `pending` reverts to the previously confirmed state.

## 6. AppFlow (top-level reducer)

| Field | Type | Notes |
|-------|------|-------|
| `step` | `"camera" \| "review" \| "annotate"` | |
| `image` | `CapturedImage \| null` | Non-null in `review` and `annotate`. |
| `pendingConfirm` | `"retake" \| "replace" \| null` | Set when leaving the photo would discard annotations (FR-028). |

**Transitions**

| From | Event | To | Guard / side effect |
|------|-------|----|---------------------|
| camera | `CAPTURED(image)` / `UPLOADED(image)` | review | Stop the stream (FR-006). |
| review | `RETAKE` | camera | If there are annotations (the user came back from Annotate), set `pendingConfirm = "retake"` first. On confirm, clear them and revoke the URL. With no annotations, revoke the URL directly. |
| review | `ACCEPT` | annotate | Initialize the annotation state for `image.id`. |
| annotate | `BACK_TO_REVIEW` | review | Annotations are kept. |
| annotate | `RETAKE` | camera | If there are annotations, set `pendingConfirm = "retake"` first. On confirm, clear them and revoke the URL. |
| any | `RESET` (from an error boundary) | camera | Clear everything. |

## Relationships

```text
CapturedImage 1 ── 1 QualityAssessment
CapturedImage 1 ── 0..* Annotation
CameraSession 1 ── 0..1 TorchState (per active track)
CameraSession ──produces──► CapturedImage (source = camera)
```
