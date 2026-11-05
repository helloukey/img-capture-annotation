# Phase 1 Data Model: Burst Capture & Multi-Image Sessions

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Extends**:
[001 data model](../001-image-capture-annotation/data-model.md)

All state stays in memory (FR-033). Types are written in TypeScript notation.

---

## 1. Limits (constants, constitution Principle VIII)

`src/features/session/lib/limits.ts` is the only place these values are defined:

| Constant | Value | Spec |
|---|---|---|
| `TAP_THRESHOLD_MS` | 300 | FR-001 and FR-002: a press of 300 ms or less is a tap |
| `BURST_INTERVAL_MS` | 333 | FR-002: about 3 photos per second (a target, not a guarantee) |
| `BURST_MAX_MS` | 3000 | FR-010 |
| `BURST_MAX_FRAMES` | 10 | FR-011 |
| `SESSION_MAX_PHOTOS` | 20 | FR-012 |
| `SESSION_MAX_BYTES` | 150_000_000 | FR-013 (decimal MB, matching the file sizes shown) |
| `FIRST_FRAME_ESTIMATE_BYTES` | 4_000_000 | R3: the size estimate before any frame exists |
| `THUMBNAIL_LONG_SIDE` | 160 | R5 |
| `UNDO_WINDOW_MS` | 5000 | Reuses feature 001's value |

## 2. Photo

A photo is feature 001's `CapturedImage` with optional burst metadata.

| Field | Type | Rules |
|---|---|---|
| *(all `CapturedImage` fields)* | | As defined in data model 001 §1. |
| `captureMethod` | `"image-capture" \| "canvas" \| "file" \| "burst"` | `"burst"` is new. These frames are at the stream's resolution (R4). |
| `burstId` | `string \| undefined` | Shared by every photo from one burst. |
| `burstIndex` | `number \| undefined` | 1-based position within the burst. |

## 3. SessionState (the `session` slice of `appReducer`)

| Field | Type | Notes |
|---|---|---|
| `photos` | `Photo[]` | Capture order. Length ≤ `SESSION_MAX_PHOTOS`. |
| `selectedId` | `string \| null` | Non-null whenever `photos.length > 0`. |
| `annotations` | `Record<photoId, AnnotationState>` | One entry per photo, driven by feature 001's `annotationReducer` (R2). |
| `pending` | `Record<token, PendingDeletion>` | Deleted photos still inside their undo window. |

**Derived values (selectors in `sessionSelectors.ts`):**
- `liveBytes` is the sum of `photos[].byteSize`.
- `heldBytes` is `liveBytes` plus the `byteSize` of every pending deletion. This is the value the
  memory limit checks (R6).
- `isFull` is true when the photo count reaches `SESSION_MAX_PHOTOS` or `heldBytes` reaches
  `SESSION_MAX_BYTES`. `fullReason` says which: `"count"` or `"memory"`.
- `annotationCount(photoId)` and `totalAnnotations`.
- `remainingSlots` is `SESSION_MAX_PHOTOS − photos.length`.

### PendingDeletion

| Field | Type | Notes |
|---|---|---|
| `token` | `string` | Unique per deletion. Used by the undo toast. |
| `photo` | `Photo` | Its object URL is still valid until the deletion is final. |
| `index` | `number` | Original position, used to restore it. |
| `annotations` | `AnnotationState` | Restored together with the photo (FR-026). |

## 4. AppState (root)

```ts
interface AppState {
  step: 'camera' | 'review' | 'annotate';
  session: SessionState;
}
```

**Invariants enforced by the reducer:**
- `step !== 'camera'` implies `photos.length > 0`. If the last photo is removed, the step becomes
  `camera`.
- `selectedId` always refers to a live photo, or is null when there are none.
- Adding photos never exceeds either limit. Any surplus is dropped, and its count is reported back
  through the action result (see the contract).

## 5. Actions (summary; the full contract is in [contracts/session-store.md](./contracts/session-store.md))

| Action | Effect |
|---|---|
| `PHOTOS_ADDED { photos, select: 'first-new' }` | Appends photos, selects the first new one, step becomes `review`. Each photo gets an empty annotation entry. |
| `SELECT { photoId }` | Changes the selection (also used by Annotate). |
| `DELETE_PHOTO { photoId, token }` | Moves the photo and its annotations into `pending`, then reselects (next photo, or previous if it was last). Zero photos left sends the step to `camera`. |
| `UNDO_DELETE_PHOTO { token }` | Restores the photo and its annotations at the original index, unless the session would exceed `SESSION_MAX_PHOTOS`, in which case nothing changes. |
| `FINALIZE_DELETE { token }` | Removes the pending entry. The caller releases its URLs. |
| `START_OVER` | Clears the photos, annotations and pending deletions; step becomes `camera`. The caller releases every URL. It is not undoable, so the UI MUST confirm it first when there are 2 or more photos (FR-020, constitution V). |
| `GO { step }` | `review` or `annotate` only when there are photos; `camera` is always allowed (Add more). |
| `ANNOTATION { photoId, action }` | Routes to `annotationReducer` for that photo. Unknown ids are a no-op. |
| `RESET` | Same as `START_OVER` (used by the error boundary). |

## 6. Burst (runtime, `burstScheduler`)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Becomes `burstId` on its photos. |
| `phase` | `"idle" \| "pressing" \| "running" \| "stopping" \| "done"` | |
| `startedAt` | `number` | Clock time when the hold threshold passed (or the Burst button was activated). |
| `frames` | `Photo[]` | Completed frames, kept even when the burst stops early. |
| `inFlight` | `boolean` | True while a frame is capturing or encoding. Never more than one at a time. |
| `lastFrameBytes` | `number` | The size estimate for the next memory check. |
| `stopReason` | `BurstStopReason \| null` | See below. |

```text
BurstStopReason = released | toggled | time-limit | frame-limit | session-full | memory-limit
                | backgrounded | interrupted
```

**State machine:**

```text
idle ─pointerdown─► pressing ─(release ≤ 300 ms)─► idle   [single capture via capture()]
                        │
                        └─(held > 300 ms)──► running ─┬─ frame done & limits ok ─► wait(interval) ─► running
   BurstButton ────────────────────────────► running  │
                                                      └─ stop signal or limit ─► stopping
   stopping ─(in-flight frame settles; it is kept)─► done ─► PHOTOS_ADDED(frames) ─► idle
```

**Limit check, before each frame** (the first matching reason wins):

```text
elapsed ≥ BURST_MAX_MS                                   → time-limit
frames.length ≥ BURST_MAX_FRAMES                         → frame-limit
session.photos + frames.length ≥ SESSION_MAX_PHOTOS      → session-full
session.heldBytes + framesBytes + estimate > MAX_BYTES   → memory-limit
```

## 7. PhotoProcessing (external store, `photoProcessor`)

| Field | Type | Notes |
|---|---|---|
| `status` | `"queued" \| "processing" \| "ready" \| "error"` | Per photo id. |
| `thumbnailUrl` | `string \| null` | A 160 px JPEG object URL, revoked on `release(id)`. |
| `metrics` | `ImageMetrics \| null` | Feature 001's metrics type, used by `assessQuality`. |

The processor keeps a FIFO queue with a priority bump for the selected photo, and a `paused` flag
that is true while a burst runs. Its operations are `enqueue(photos)`, `prioritize(id)`,
`pause()`, `resume()`, `release(id)` and `releaseAll()`.

## Relationships

```text
AppState 1 ── 1 SessionState
SessionState 1 ── 0..20 Photo   (ordered)
Photo 1 ── 1 AnnotationState    (feature 001 shape, 0..* Annotation)
Photo 1 ── 0..1 PhotoProcessing result
Burst 1 ── 1..10 Photo          (via burstId)
PendingDeletion 1 ── 1 Photo + its AnnotationState
```
