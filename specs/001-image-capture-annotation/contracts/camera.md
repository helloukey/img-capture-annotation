# Contract: Camera & Torch Hooks

**Module**: `src/features/camera/` · **Implements**: FR-001–FR-013 · **Research**: R2–R5, R9

Components MUST use these hooks and MUST NOT call `getUserMedia`, `applyConstraints`, or
`ImageCapture` directly (Constitution VI).

## `useCamera(options?)`

```ts
type CameraErrorKind =
  | "insecure-context" | "unsupported" | "permission-denied" | "permission-dismissed"
  | "no-camera" | "camera-busy" | "stream-interrupted" | "unknown";

interface CameraError { kind: CameraErrorKind; message: string; cause?: unknown }

type CameraStatus = "idle" | "requesting" | "live" | "capturing" | "error";

interface UseCameraOptions {
  preferredFacingMode?: "environment" | "user"; // default "environment"
  autoStart?: boolean;                          // default true
}

interface UseCameraResult {
  status: CameraStatus;
  error: CameraError | null;
  videoRef: React.RefCallback<HTMLVideoElement>; // attaches stream; sets playsInline, muted
  track: MediaStreamTrack | null;
  resolution: { width: number; height: number } | null; // actual, from getSettings()
  devices: { deviceId: string; label: string }[];
  activeDeviceId: string | null;
  canSwitchCamera: boolean;                     // devices.length > 1
  start(): Promise<void>;
  stop(): void;
  retry(): Promise<void>;                       // = stop() + start()
  switchCamera(deviceId?: string): Promise<void>; // cycles when id omitted
  capture(): Promise<CapturedImage>;            // rejects with CameraError
}
```

**Behavioral guarantees**

1. `start()` checks `isSecureContext` and API presence *before* prompting. If either fails, it
   goes to `error` with `insecure-context` or `unsupported`.
2. Resolution negotiation follows research R2. A fallback resolution is never surfaced as an
   error.
3. `capture()` follows research R3: `ImageCapture.takePhoto` at the maximum photo capabilities,
   falling back to a canvas at `videoWidth × videoHeight` with JPEG 0.95. The returned
   `CapturedImage.width/height` are read from the decoded blob.
4. Tracks are stopped on unmount, on `stop()`, after a successful capture (the caller moves to
   Review), and on `document.visibilitychange → hidden`. On becoming visible again, `start()` is
   called automatically only if the camera screen is still mounted.
5. A track `ended` event while in `live` → `error("stream-interrupted")`.
6. `capture()` while not `live` rejects immediately. It is safe to call twice: the second call
   is ignored while one is in flight.

## `useTorch(track: MediaStreamTrack | null)`

```ts
interface UseTorchResult {
  supported: boolean;   // "torch" in track.getCapabilities()
  on: boolean;          // ALWAYS from track.getSettings().torch after apply
  pending: boolean;
  error: string | null; // last failure message; cleared on next toggle
  toggle(): Promise<void>;
  setTorch(on: boolean): Promise<void>;
}
```

**Behavioral guarantees**

1. `supported` and `on` are re-evaluated whenever the `track` identity changes, and reset to
   `false` when `track` is null or ended.
2. `toggle()` is a no-op when `!supported` or `pending`.
3. On an `applyConstraints` rejection, `on` keeps the last confirmed value and `error` is set.
4. The hook never sets `on` from the requested value (research R5).

## Pure helpers (unit-tested)

```ts
classifyCameraError(err: unknown, env: { isSecureContext: boolean; hasGetUserMedia: boolean;
  permissionState?: PermissionState }): CameraError;

buildConstraintLadder(opts: { facingMode: "environment" | "user"; deviceId?: string })
  : MediaStreamConstraints[];   // ordered fallbacks per research R2

pickUpgradeConstraints(caps: MediaTrackCapabilities, settings: MediaTrackSettings)
  : MediaTrackConstraints | null; // null when already at max
```

## UI states (`CameraView`)

| Status / error kind | Shown | Primary action | Secondary |
|---------------------|-------|----------------|-----------|
| `requesting` (first visit) | "Allow camera access to take a photo" + spinner | — | Choose a photo |
| `live` | Preview, shutter, torch toggle (per `useTorch`), switch camera | Capture | — |
| `permission-denied` | How to re-enable it in the browser's site settings | Try again | Choose a photo |
| `permission-dismissed` | "Camera access is needed…" | Allow camera | Choose a photo |
| `no-camera` | "No camera found" | Choose a photo | Try again |
| `camera-busy` | "Camera is in use by another app" | Try again | Choose a photo |
| `stream-interrupted` | "Camera disconnected" | Reconnect | Choose a photo |
| `unsupported` / `insecure-context` | What's missing, plus an HTTPS hint | Choose a photo | — |
| `unknown` | Generic message plus the details in a disclosure | Try again | Choose a photo |
