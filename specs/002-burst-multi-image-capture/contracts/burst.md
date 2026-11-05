# Contract: Burst Capture

**Module**: `src/features/session/lib/burstScheduler.ts` (pure), `src/features/camera/hooks/useBurst.ts`,
`src/features/camera/components/{ShutterButton,BurstButton,BurstProgress}.tsx` · **Implements**:
FR-001 to FR-011, FR-014, FR-028, FR-029 · **Research**: R3, R4, R7, R8

## Scheduler (pure; injectable clock and capture)

```ts
type BurstStopReason =
  | 'released' | 'toggled' | 'time-limit' | 'frame-limit'
  | 'session-full' | 'memory-limit' | 'backgrounded' | 'interrupted';

interface BurstEnv {
  now(): number;
  sleep(ms: number): Promise<void>;
  captureFrame(): Promise<Photo>;                 // one frame; must not be called concurrently
  session(): { photos: number; heldBytes: number }; // read at each limit check
}

interface BurstResult { frames: Photo[]; stopReason: BurstStopReason; durationMs: number }

function runBurst(env: BurstEnv, signal: { stopped: BurstStopReason | null }): Promise<BurstResult>;
function checkLimits(input: { elapsedMs: number; frames: number; framesBytes: number;
  estimateBytes: number; sessionPhotos: number; sessionBytes: number }): BurstStopReason | null;
```

**Guarantees** (each is a unit test, using fake timers or a fake env):

1. **Never concurrent**: `captureFrame` is never called while a previous call is still pending.
2. **Cadence**: the next frame starts at `max(prevStart + BURST_INTERVAL_MS, prevEnd)`. A capture
   slower than the interval simply produces fewer frames, with no backlog.
3. **Limits checked first**: `checkLimits` runs before every frame. The first matching reason, in
   the order time, frames, session-full, memory, stops the burst.
4. **External stops**: setting `signal.stopped` (released, toggled, backgrounded or interrupted)
   means no new frame starts. A frame already in flight finishes and is **kept**.
5. **Failed frames**: if `captureFrame` rejects, the burst stops with reason `interrupted` and keeps
   the frames already captured.
6. **First-frame floor**: a burst that is started always takes at least one frame unless a limit is
   already hit at t = 0 (for example, the session is full).

## Tap and hold controller (`useBurst`)

```ts
interface UseBurstResult {
  phase: 'idle' | 'pressing' | 'running' | 'stopping';
  frameCount: number;            // live counter (FR-006)
  startedAt: number | null;      // drives the progress ring
  lastStop: { reason: BurstStopReason; frames: number } | null;
  shutterHandlers: {             // spread onto ShutterButton
    onPointerDown; onPointerUp; onPointerCancel; onLostPointerCapture; onContextMenu; onKeyDown;
  };
  toggleBurst(): void;           // BurstButton (R8)
}
function useBurst(opts: {
  camera: UseCameraResult;       // capture() for a tap; captureFrame() for burst frames; stop() afterwards
  onPhotos(photos: Photo[], stop: BurstStopReason | null): void; // → useSession().addPhotos
}): UseBurstResult;
```

**Behavior:**
- **Press**: `pointerdown` (primary button or touch; only the first `pointerId` counts) sets pointer
  capture and starts a timer of `TAP_THRESHOLD_MS + 1` ms. The phase becomes `pressing`. A press
  of **exactly** 300 ms is still a tap (FR-001: "≤ 0.3 s"). Release timing is checked against
  `performance.now()`, so timer jitter can't turn a 300 ms press into a burst.
- **Sliding off**: pointer capture means sliding off the shutter while still pressing **does not**
  stop the burst. Releasing anywhere ends it (FR-003).
- **Tap**: releasing before the timer fires runs `camera.capture()` (feature 001's single-capture
  path), and its result goes through `onPhotos([photo], null)`.
- **Hold**: when the timer fires the phase becomes `running`, `photoProcessor.pause()` is called,
  and `runBurst` starts.
- **Stops**:
  - `pointerup` (anywhere, thanks to pointer capture), `pointercancel` (a system cancel, such as an incoming call) and `lostpointercapture` stop with `released`. There is no `pointerleave` handling.
  - `visibilitychange` to hidden stops with `backgrounded`.
  - A camera `status` other than `live` (stream ended) stops with `interrupted`.
- **After the burst**: once it settles, `camera.stop()` releases the stream (and torch),
  `photoProcessor.resume()` is called, and `onPhotos(frames, reason)` follows. The live region
  announces `"{n} photos. {reasonText}"`. Reasons other than `released` and `toggled` also get a
  toast with the same text.
- **Context menu**: `onContextMenu` always calls `preventDefault`.
- **Keyboard**: Enter or Space on the shutter makes one single capture, never a burst.

## Stop-reason copy (user-facing, FR-007)

| Reason | Toast | Announced |
|---|---|---|
| released / toggled | none | "Burst: N photos" |
| time-limit | "Burst limit reached (3 seconds)" | same |
| frame-limit | "Burst limit reached (10 photos)" | same |
| session-full | "Session full (20 photos). Delete some photos to take more." | same |
| memory-limit | "Memory limit reached. Delete some photos to take more." | same |
| backgrounded | "Burst stopped because the app was hidden" | same |
| interrupted | "Burst stopped: the camera was interrupted" | same |

## UI

- **`ShutterButton`**:
  - Spreads `shutterHandlers` and keeps the existing look.
  - Adds `touch-action: none; user-select: none; -webkit-touch-callout: none`.
  - Is disabled, with `aria-describedby` pointing at the full message, when `isFull`.
  - Its accessible name stays "Capture photo", with the hint "Hold to take a burst".
- **`BurstProgress`**:
  - An SVG ring around the shutter, whose stroke animates linearly over `BURST_MAX_MS` from
    `startedAt`. It respects `prefers-reduced-motion` by showing a static ring plus the counter.
  - A counter chip shows "N" above the shutter.
- **`BurstButton`**:
  - An `IconButton` labelled "Take a burst of photos, up to 3 seconds", with
    `aria-pressed={phase === 'running'}`. It calls `toggleBurst()`.
  - It is disabled when the session is full.
- **Disabled during a burst**: the camera-switch, torch and gallery controls are disabled while
  `phase !== 'idle'` (FR-009).
