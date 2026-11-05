import type { Photo } from '@/shared/types';
import {
  BURST_INTERVAL_MS,
  BURST_MAX_FRAMES,
  BURST_MAX_MS,
  FIRST_FRAME_ESTIMATE_BYTES,
  SESSION_MAX_BYTES,
  SESSION_MAX_PHOTOS,
} from './limits';

export type BurstStopReason =
  | 'released'
  | 'toggled'
  | 'time-limit'
  | 'frame-limit'
  | 'session-full'
  | 'memory-limit'
  | 'backgrounded'
  | 'interrupted';

export interface BurstEnv {
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Captures one frame. Never called while a previous call is pending. */
  captureFrame(): Promise<Photo>;
  /** Read before every frame, so concurrent session changes are respected. */
  session(): { photos: number; heldBytes: number };
}

export interface BurstResult {
  frames: Photo[];
  stopReason: BurstStopReason;
  durationMs: number;
}

/** An external stop request that also cuts short any wait between frames. */
export interface StopSignal {
  readonly stopped: BurstStopReason | null;
  stop(reason: BurstStopReason): void;
  /** Resolves when stop() is called. */
  readonly whenStopped: Promise<void>;
}

export function createStopSignal(): StopSignal {
  let resolve!: () => void;
  const whenStopped = new Promise<void>((r) => (resolve = r));
  const signal = {
    stopped: null as BurstStopReason | null,
    whenStopped,
    stop(reason: BurstStopReason) {
      if (signal.stopped) return;
      signal.stopped = reason;
      resolve();
    },
  };
  return signal;
}

export interface LimitInput {
  elapsedMs: number;
  frames: number;
  framesBytes: number;
  estimateBytes: number;
  sessionPhotos: number;
  sessionBytes: number;
}

/** Checked before every frame; the first matching limit wins (constitution VIII). */
export function checkLimits(i: LimitInput): BurstStopReason | null {
  if (i.elapsedMs >= BURST_MAX_MS) return 'time-limit';
  if (i.frames >= BURST_MAX_FRAMES) return 'frame-limit';
  if (i.sessionPhotos + i.frames >= SESSION_MAX_PHOTOS) return 'session-full';
  if (i.sessionBytes + i.framesBytes + i.estimateBytes > SESSION_MAX_BYTES) return 'memory-limit';
  return null;
}

/**
 * Sequential burst loop (research R3, contracts/burst.md): check limits → capture one frame and
 * await it → wait out the rest of the interval → repeat. Slow captures yield fewer frames; a
 * frame that finishes after a stop request is kept; nothing ever runs concurrently.
 */
export async function runBurst(env: BurstEnv, signal: StopSignal): Promise<BurstResult> {
  const start = env.now();
  const frames: Photo[] = [];
  let framesBytes = 0;
  let estimate = FIRST_FRAME_ESTIMATE_BYTES;
  let stopReason: BurstStopReason;

  for (;;) {
    if (signal.stopped) {
      stopReason = signal.stopped;
      break;
    }
    const session = env.session();
    const limit = checkLimits({
      elapsedMs: env.now() - start,
      frames: frames.length,
      framesBytes,
      estimateBytes: estimate,
      sessionPhotos: session.photos,
      sessionBytes: session.heldBytes,
    });
    if (limit) {
      stopReason = limit;
      break;
    }

    const frameStart = env.now();
    let frame: Photo;
    try {
      frame = await env.captureFrame();
    } catch {
      stopReason = 'interrupted';
      break;
    }
    // The estimate can be wrong: never keep a frame that would exceed the budget.
    if (session.heldBytes + framesBytes + frame.byteSize > SESSION_MAX_BYTES) {
      URL.revokeObjectURL(frame.objectUrl);
      stopReason = 'memory-limit';
      break;
    }
    frames.push(frame);
    framesBytes += frame.byteSize;
    estimate = frame.byteSize;

    if (signal.stopped) {
      stopReason = signal.stopped;
      break;
    }
    const wait = frameStart + BURST_INTERVAL_MS - env.now();
    if (wait > 0) await Promise.race([env.sleep(wait), signal.whenStopped]);
  }

  return { frames, stopReason, durationMs: env.now() - start };
}
