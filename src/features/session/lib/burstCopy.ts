import type { BurstStopReason } from './burstScheduler';

/** User-facing stop reasons (contracts/burst.md, FR-007). Null = the user ended it; no toast. */
export const BURST_STOP_COPY: Record<BurstStopReason, string | null> = {
  released: null,
  toggled: null,
  'time-limit': 'Burst limit reached (3 seconds)',
  'frame-limit': 'Burst limit reached (10 photos)',
  'session-full': 'Session full (20 photos). Delete some photos to take more.',
  'memory-limit': 'Memory limit reached. Delete some photos to take more.',
  backgrounded: 'Burst stopped because the app was hidden',
  interrupted: 'Burst stopped: the camera was interrupted',
};

/** Screen-reader announcement after a burst (FR-029). */
export function burstAnnouncement(frames: number, reason: BurstStopReason): string {
  const base = `Burst: ${frames} photo${frames === 1 ? '' : 's'}.`;
  const why = BURST_STOP_COPY[reason];
  return why ? `${base} ${why}` : base;
}
