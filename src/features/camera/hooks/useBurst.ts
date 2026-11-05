import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import {
  createStopSignal,
  runBurst,
  type BurstEnv,
  type BurstStopReason,
  type StopSignal,
} from '@/features/session/lib/burstScheduler';
import { photoProcessor } from '@/features/session/lib/defaultPhotoProcessor';
import { TAP_THRESHOLD_MS } from '@/features/session/lib/limits';
import type { Photo } from '@/shared/types';
import type { UseCameraResult } from './useCamera';
import { usePageVisibility } from './usePageVisibility';

export type BurstPhase = 'idle' | 'pressing' | 'running';

/**
 * After a held press ends, the browser still dispatches a synthetic click at the release point
 * (touch: after touchend). By then the app may already show Review, so that click would hit a
 * Review button under the finger. Swallow one click near the release point, briefly.
 */
function suppressGhostClick(x: number, y: number, windowMs = 600, radius = 40) {
  const onClick = (e: globalThis.MouseEvent) => {
    if (Math.hypot(e.clientX - x, e.clientY - y) > radius) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup();
  };
  const timer = setTimeout(() => cleanup(), windowMs);
  function cleanup() {
    clearTimeout(timer);
    window.removeEventListener('click', onClick, true);
  }
  window.addEventListener('click', onClick, true);
}

const LIMIT_REASONS: ReadonlySet<BurstStopReason> = new Set([
  'time-limit',
  'frame-limit',
  'session-full',
  'memory-limit',
]);

export interface UseBurstOptions {
  camera: UseCameraResult;
  /** Receives the photos of a tap (reason null) or a burst (with its stop reason). */
  onPhotos(photos: Photo[], reason: BurstStopReason | null): void;
  /** Current session size, read before every burst frame. */
  session(): { photos: number; heldBytes: number };
  /** Called as soon as a burst stops, even if the finger is still down (toast/announcement). */
  onStopped?(reason: BurstStopReason, frames: number): void;
  /** Called as each photo starts, for the shutter flash (feedback within 100 ms). */
  onFrame?(): void;
  onError?(error: unknown): void;
}

export interface UseBurstResult {
  phase: BurstPhase;
  frameCount: number;
  startedAt: number | null;
  lastStop: { reason: BurstStopReason; frames: number } | null;
  shutterHandlers: {
    onPointerDown(e: PointerEvent<HTMLButtonElement>): void;
    onPointerUp(e: PointerEvent<HTMLButtonElement>): void;
    onPointerCancel(e: PointerEvent<HTMLButtonElement>): void;
    onLostPointerCapture(e: PointerEvent<HTMLButtonElement>): void;
    onContextMenu(e: MouseEvent<HTMLButtonElement>): void;
    onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void;
  };
  toggleBurst(): void;
}

/**
 * Tap vs hold controller over the pure burst scheduler (contracts/burst.md):
 * a press of ≤ 300 ms is one takePhoto() capture; holding longer runs a sequential burst.
 */
export function useBurst(options: UseBurstOptions): UseBurstResult {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  const [phase, setPhaseState] = useState<BurstPhase>('idle');
  const [frameCount, setFrameCount] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastStop, setLastStop] = useState<UseBurstResult['lastStop']>(null);
  const phaseRef = useRef<BurstPhase>('idle');
  const pointerId = useRef<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signal = useRef<StopSignal | null>(null);
  /** A finished burst waiting for the finger to lift (see startBurst). */
  const pendingDelivery = useRef<(() => void) | null>(null);

  const setPhase = useCallback((p: BurstPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const singleCapture = useCallback(async () => {
    if (phaseRef.current === 'running') return;
    setPhase('idle');
    opts.current.onFrame?.();
    try {
      const photo = await opts.current.camera.capture();
      opts.current.onPhotos([photo], null);
    } catch (err) {
      opts.current.onError?.(err);
    }
  }, [setPhase]);

  const startBurst = useCallback(async () => {
    if (phaseRef.current === 'running') return;
    setPhase('running');
    setFrameCount(0);
    setStartedAt(performance.now());
    photoProcessor.pause(); // no pixel work during a burst (constitution VIII)
    const sig = createStopSignal();
    signal.current = sig;
    const burstId = crypto.randomUUID();
    let index = 0;
    const env: BurstEnv = {
      now: () => performance.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      captureFrame: async () => {
        opts.current.onFrame?.();
        const photo = await opts.current.camera.captureFrame();
        index += 1;
        setFrameCount(index);
        return { ...photo, burstId, burstIndex: index };
      },
      session: () => opts.current.session(),
    };
    const result = await runBurst(env, sig);
    performance.mark('burst-stopped'); // with 'burst-release': release → stop delay (SC-003)
    signal.current = null;
    photoProcessor.resume();
    setLastStop({ reason: result.stopReason, frames: result.frames.length });
    setStartedAt(null);
    setPhase('idle');
    opts.current.onStopped?.(result.stopReason, result.frames.length);

    const deliver = () => {
      pendingDelivery.current = null;
      // Release the camera (and torch) once the photos are taken; stay live if nothing was taken.
      if (result.frames.length) opts.current.camera.stop();
      opts.current.onPhotos(result.frames, result.stopReason);
    };
    // A limit can stop the burst while the finger is still down. Moving to Review now would make
    // the eventual lift tap whatever Review shows under the finger, so wait for the release.
    // Only limits can end a burst while the shutter is still pressed and on screen; an interruption
    // or backgrounding replaces the camera UI, so those deliver immediately.
    const limitStop = LIMIT_REASONS.has(result.stopReason);
    if (limitStop && pointerId.current !== null) pendingDelivery.current = deliver;
    else {
      pointerId.current = null;
      deliver();
    }
  }, [setPhase]);

  const endPress = useCallback(
    (e: PointerEvent<HTMLButtonElement>, kind: 'up' | 'cancel') => {
      if (e.pointerId !== pointerId.current) return; // only the pointer that started the press counts
      pointerId.current = null;
      performance.mark('burst-release');
      const wasHold = holdTimer.current === null; // the press became a burst
      if (wasHold) suppressGhostClick(e.clientX, e.clientY);
      if (pendingDelivery.current) {
        pendingDelivery.current();
        return;
      }
      if (holdTimer.current !== null) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
        if (kind === 'up') void singleCapture();
        else setPhase('idle');
        return;
      }
      signal.current?.stop('released');
    },
    [setPhase, singleCapture],
  );

  const shutterHandlers: UseBurstResult['shutterHandlers'] = {
    onPointerDown(e) {
      if (pointerId.current !== null || phaseRef.current !== 'idle') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerId.current = e.pointerId;
      e.currentTarget.setPointerCapture?.(e.pointerId); // release anywhere ends the burst (FR-003)
      setPhase('pressing');
      // +1 so a press of exactly TAP_THRESHOLD_MS is still a tap (FR-001: "≤ 0.3 s").
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        if (phaseRef.current === 'pressing') void startBurst();
      }, TAP_THRESHOLD_MS + 1);
    },
    onPointerUp: (e) => endPress(e, 'up'),
    onPointerCancel: (e) => endPress(e, 'cancel'),
    onLostPointerCapture: (e) => endPress(e, 'cancel'),
    onContextMenu(e) {
      e.preventDefault(); // no long-press menu (FR-008)
    },
    onKeyDown(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!e.repeat && phaseRef.current === 'idle') void singleCapture();
    },
  };

  const toggleBurst = useCallback(() => {
    if (phaseRef.current === 'running') signal.current?.stop('toggled');
    else if (phaseRef.current === 'idle' && pointerId.current === null) void startBurst();
  }, [startBurst]);

  const visible = usePageVisibility();
  useEffect(() => {
    if (visible) return;
    signal.current?.stop('backgrounded');
    if (pendingDelivery.current) {
      pointerId.current = null;
      pendingDelivery.current();
    }
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      pointerId.current = null;
      phaseRef.current = 'idle';
    }
  }, [visible]);

  const status = options.camera.status;
  useEffect(() => {
    if (status !== 'live' && status !== 'capturing') signal.current?.stop('interrupted');
  }, [status]);

  useEffect(
    () => () => {
      signal.current?.stop('interrupted');
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    },
    [],
  );

  return { phase, frameCount, startedAt, lastStop, shutterHandlers, toggleBurst };
}
