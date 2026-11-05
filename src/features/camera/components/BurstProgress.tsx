import { BURST_MAX_MS } from '@/features/session/lib/limits';

const SIZE = 92;
const RADIUS = 43;
const LENGTH = 2 * Math.PI * RADIUS;

/**
 * Ring around the shutter filling up over the burst time limit, plus a live frame counter (FR-006).
 * With reduced motion the global rule skips the animation, leaving a full ring and the counter.
 */
export function BurstProgress({ startedAt, frames }: { startedAt: number; frames: number }) {
  return (
    <>
      <svg
        key={startedAt}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90"
        aria-hidden
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={4}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          className="stroke-annotation-selected"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          style={{
            ['--ring-length' as string]: `${LENGTH}`,
            strokeDashoffset: LENGTH,
            animation: `burst-ring ${BURST_MAX_MS}ms linear forwards`,
          }}
        />
      </svg>
      <span
        data-testid="burst-counter"
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-annotation-selected px-2.5 py-0.5 text-sm font-bold tabular-nums text-slate-950 shadow"
        aria-hidden
      >
        {frames}
      </span>
    </>
  );
}
