import { describe, expect, it } from 'vitest';
import type { Photo } from '@/shared/types';
import { makePhoto } from '../../../../tests/fakes/appState';
import { checkLimits, createStopSignal, runBurst, type BurstEnv } from './burstScheduler';
import {
  BURST_INTERVAL_MS,
  BURST_MAX_FRAMES,
  BURST_MAX_MS,
  FIRST_FRAME_ESTIMATE_BYTES,
  SESSION_MAX_BYTES,
  SESSION_MAX_PHOTOS,
} from './limits';

/** A deterministic virtual clock: sleeps and captures advance time instantly. */
function virtualEnv(
  opts: {
    captureMs?: number | (() => number);
    frameBytes?: number | (() => number);
    session?: { photos: number; heldBytes: number };
    failAt?: number;
    onCapture?: (t: number, i: number) => void;
  } = {},
) {
  let t = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const starts: number[] = [];
  const env: BurstEnv = {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    captureFrame: async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      starts.push(t);
      opts.onCapture?.(t, starts.length);
      const ms = typeof opts.captureMs === 'function' ? opts.captureMs() : (opts.captureMs ?? 50);
      t += ms;
      inFlight--;
      if (opts.failAt === starts.length) throw new Error('camera gone');
      const bytes =
        typeof opts.frameBytes === 'function' ? opts.frameBytes() : (opts.frameBytes ?? 2_000_000);
      return makePhoto({ byteSize: bytes }) as Photo;
    },
    session: () => opts.session ?? { photos: 0, heldBytes: 0 },
  };
  return {
    env,
    starts,
    get maxInFlight() {
      return maxInFlight;
    },
    get t() {
      return t;
    },
  };
}

describe('checkLimits', () => {
  const base = {
    elapsedMs: 0,
    frames: 0,
    framesBytes: 0,
    estimateBytes: FIRST_FRAME_ESTIMATE_BYTES,
    sessionPhotos: 0,
    sessionBytes: 0,
  };
  it('reports each limit, in priority order time → frames → session → memory', () => {
    expect(checkLimits(base)).toBeNull();
    expect(checkLimits({ ...base, elapsedMs: BURST_MAX_MS })).toBe('time-limit');
    expect(checkLimits({ ...base, frames: BURST_MAX_FRAMES })).toBe('frame-limit');
    expect(checkLimits({ ...base, sessionPhotos: SESSION_MAX_PHOTOS - 3, frames: 3 })).toBe('session-full');
    expect(checkLimits({ ...base, sessionBytes: SESSION_MAX_BYTES - FIRST_FRAME_ESTIMATE_BYTES + 1 })).toBe(
      'memory-limit',
    );
    expect(
      checkLimits({
        ...base,
        elapsedMs: BURST_MAX_MS,
        frames: BURST_MAX_FRAMES,
        sessionPhotos: SESSION_MAX_PHOTOS,
      }),
    ).toBe('time-limit');
    expect(checkLimits({ ...base, frames: BURST_MAX_FRAMES, sessionPhotos: SESSION_MAX_PHOTOS })).toBe(
      'frame-limit',
    );
  });
});

describe('runBurst', () => {
  it('captures at the target cadence until the time or frame limit', async () => {
    const v = virtualEnv({ captureMs: 50 });
    const result = await runBurst(v.env, createStopSignal());
    expect(v.starts.slice(0, 3)).toEqual([0, BURST_INTERVAL_MS, 2 * BURST_INTERVAL_MS]);
    expect(result.frames.length).toBeLessThanOrEqual(BURST_MAX_FRAMES);
    expect(['time-limit', 'frame-limit']).toContain(result.stopReason);
    expect(v.starts.every((s) => s < BURST_MAX_MS)).toBe(true);
  });

  it('stops at the frame limit when captures are fast', async () => {
    const result = await runBurst(virtualEnv({ captureMs: 1 }).env, createStopSignal());
    // 10 frames × 333 ms = 3000 ms: the frame limit is reached exactly as time runs out
    expect(result.frames).toHaveLength(BURST_MAX_FRAMES);
  });

  it('never runs captures concurrently, and slow captures just yield fewer frames', async () => {
    const v = virtualEnv({ captureMs: 600 });
    const result = await runBurst(v.env, createStopSignal());
    expect(v.maxInFlight).toBe(1);
    expect(v.starts).toEqual([0, 600, 1200, 1800, 2400]); // next start = max(prev + 333, prevEnd)
    expect(result.frames).toHaveLength(5);
    expect(result.stopReason).toBe('time-limit');
  });

  it('stops when the session becomes full mid-burst', async () => {
    const result = await runBurst(
      virtualEnv({ session: { photos: SESSION_MAX_PHOTOS - 2, heldBytes: 0 } }).env,
      createStopSignal(),
    );
    expect(result.frames).toHaveLength(2);
    expect(result.stopReason).toBe('session-full');
  });

  it('stops before a frame would exceed the memory budget, using the last frame size as the estimate', async () => {
    const result = await runBurst(
      virtualEnv({ frameBytes: 3_000_000, session: { photos: 0, heldBytes: SESSION_MAX_BYTES - 10_000_000 } })
        .env,
      createStopSignal(),
    );
    // FIRST estimate 4 MB fits; then 3 MB frames: 3 + 3 + 3 = 9 MB taken, a 4th (12 MB) would exceed 10 MB
    expect(result.frames).toHaveLength(3);
    expect(result.stopReason).toBe('memory-limit');
  });

  it('discards and releases a captured frame that turns out larger than the remaining budget', async () => {
    const result = await runBurst(
      virtualEnv({ frameBytes: 6_000_000, session: { photos: 0, heldBytes: SESSION_MAX_BYTES - 5_000_000 } })
        .env,
      createStopSignal(),
    );
    // the 4 MB first-frame estimate fit, but the real frame was 6 MB: it must not be kept
    expect(result.frames).toHaveLength(0);
    expect(result.stopReason).toBe('memory-limit');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('takes no frame when a limit is already hit at t = 0', async () => {
    const v = virtualEnv({ session: { photos: SESSION_MAX_PHOTOS, heldBytes: 0 } });
    const result = await runBurst(v.env, createStopSignal());
    expect(result.frames).toHaveLength(0);
    expect(v.starts).toHaveLength(0);
    expect(result.stopReason).toBe('session-full');
  });

  it('an external stop keeps the in-flight frame and starts no new one', async () => {
    const signal = createStopSignal();
    const v = virtualEnv({ onCapture: (_t, i) => i === 2 && signal.stop('released') });
    const result = await runBurst(v.env, signal);
    expect(result.frames).toHaveLength(2);
    expect(result.stopReason).toBe('released');
  });

  it('a stop during the wait between frames ends the burst promptly', async () => {
    const signal = createStopSignal();
    let t = 0;
    const env: BurstEnv = {
      now: () => t,
      sleep: (ms) =>
        new Promise((r) =>
          setTimeout(() => {
            t += ms;
            r();
          }, 1000),
        ), // a "long" wait
      captureFrame: async () => makePhoto(),
      session: () => ({ photos: 0, heldBytes: 0 }),
    };
    const p = runBurst(env, signal);
    await new Promise((r) => setTimeout(r, 5));
    signal.stop('toggled');
    const result = await p;
    expect(result.frames).toHaveLength(1);
    expect(result.stopReason).toBe('toggled');
  });

  it('a failed capture stops with "interrupted" and keeps earlier frames', async () => {
    const result = await runBurst(virtualEnv({ failAt: 3 }).env, createStopSignal());
    expect(result.frames).toHaveLength(2);
    expect(result.stopReason).toBe('interrupted');
  });

  it('50 randomized runs never exceed any limit and never overlap captures (SC-004)', async () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let run = 0; run < 50; run++) {
      const session = {
        photos: Math.floor(rand() * SESSION_MAX_PHOTOS),
        heldBytes: Math.floor(rand() * SESSION_MAX_BYTES),
      };
      const v = virtualEnv({
        captureMs: () => 50 + rand() * 850,
        frameBytes: () => 500_000 + rand() * 6_000_000,
        session,
      });
      const result = await runBurst(v.env, createStopSignal());
      const bytes = result.frames.reduce((n, f) => n + f.byteSize, 0);
      expect(v.maxInFlight).toBeLessThanOrEqual(1);
      expect(result.frames.length).toBeLessThanOrEqual(BURST_MAX_FRAMES);
      expect(v.starts.every((s) => s < BURST_MAX_MS)).toBe(true);
      expect(session.photos + result.frames.length).toBeLessThanOrEqual(SESSION_MAX_PHOTOS);
      expect(session.heldBytes + bytes).toBeLessThanOrEqual(SESSION_MAX_BYTES); // strict: an over-budget frame is discarded
    }
  });
});
