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

export interface UseBurstOptions {
  camera: UseCameraResult;
  /** Receives the photos of a tap (reason null) or a burst (with its stop reason). */
  onPhotos(photos: Photo[], reason: BurstStopReason | null): void;
  /** Current session size, read before every burst frame. */
  session(): { photos: number; heldBytes: number };
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
    signal.current = null;
    // Release the camera (and torch) once the photos are taken; stay live if nothing was taken.
    if (result.frames.length) opts.current.camera.stop();
    photoProcessor.resume();
    setLastStop({ reason: result.stopReason, frames: result.frames.length });
    setStartedAt(null);
    setPhase('idle');
    opts.current.onPhotos(result.frames, result.stopReason);
  }, [setPhase]);

  const endPress = useCallback(
    (e: PointerEvent<HTMLButtonElement>, kind: 'up' | 'cancel') => {
      if (e.pointerId !== pointerId.current) return; // only the pointer that started the press counts
      pointerId.current = null;
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
