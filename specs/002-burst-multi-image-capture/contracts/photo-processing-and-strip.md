# Contract: Photo Processing & Photo Strip

**Module**: `src/features/session/lib/photoProcessor.ts`, `src/features/session/components/PhotoStrip.tsx`
· **Implements**: FR-014, FR-016, FR-017, FR-019, FR-023, FR-024, FR-030, FR-032 · **Research**:
R5, R9

## Photo processor (a service with an external store)

```ts
interface PhotoInfo { status: 'queued' | 'processing' | 'ready' | 'error';
                      thumbnailUrl: string | null; metrics: ImageMetrics | null }

interface PhotoProcessor {
  enqueue(photos: Photo[]): void;
  prioritize(photoId: string): void;   // move to the front if it is still queued
  pause(): void;                       // no new job starts; the running job may finish
  resume(): void;
  release(photoId: string): void;      // cancel or ignore its job, revoke thumbnailUrl, drop the entry
  releaseAll(): void;
  get(photoId: string): PhotoInfo | undefined;
  subscribe(listener: () => void): () => void;
}
function createPhotoProcessor(deps: {
  decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }>;
  analyze(source: CanvasImageSource, w: number, h: number):
    { brightnessPct: number; sharpness: number };     // feature 001's metrics on a 512 px copy
  thumbnail(source: CanvasImageSource, w: number, h: number): Promise<Blob>; // 160 px long side, JPEG 0.8
  schedule(task: () => void): void;                // requestIdleCallback, falling back to setTimeout(0)
}): PhotoProcessor;
```

**Guarantees** (unit-tested with fake dependencies):

1. **One job at a time**: at most one photo is processing at any moment.
2. **Order**: the prioritized (selected) photo goes first, then the rest in capture order.
3. **Paused during bursts**: after `pause()`, no new job starts until `resume()`.
4. **Single decode**: each photo is decoded exactly once, and that one decoded source feeds both
   the analysis and the thumbnail. `close()` is always called, even when a step fails.
5. **Release**: `release(id)` revokes the thumbnail URL. If the photo's job is running at that
   moment, its result is discarded and no URL leaks. `releaseAll()` does the same for every photo.
6. **Errors**: a failed decode sets `status: 'error'` with no thumbnail. The strip then shows a
   placeholder, and `assessQuality` handles the missing metrics as in feature 001.

**Hooks:**

```ts
usePhotoInfo(photoId): PhotoInfo | undefined                  // useSyncExternalStore
useQualityAssessment(image): QualityAssessment | null         // feature 001 hook, now backed by the processor
```

## Photo strip

```ts
<PhotoStrip
  photos={Photo[]} selectedId={string}
  onSelect(id) onDelete(id)            // onDelete → useSession().deletePhoto, after a confirmation if annotated
  annotationCounts={Record<id, number>}
  orientation="horizontal" | "vertical" />
```

- **Hidden for one photo**: it renders nothing when `photos.length < 2` (FR-032).
- **Items**: each item is a `<button aria-pressed>`. Its accessible name is
  `Photo {i} of {n}, {verdict ?? 'quality pending'}, {k} annotation(s)`. It shows the thumbnail (or
  a skeleton), a quality dot, the annotation-count badge, and a burst marker for burst photos.
- **Keyboard**: roving tabindex. ←/→ (or ↑/↓ when vertical) move focus, and Enter or Space
  selects.
- **Deleting a focused item**: Delete or Backspace calls `onDelete`. Any confirmation for annotated
  photos is shown by the parent.
- **Scrolling**: the selected item scrolls into view.
- **Size**: items are at least 56×56 CSS px, larger than the 44 px minimum.
