import { cn } from '@/shared/ui/cn';
import { LoaderCircle } from '@/shared/ui/icons';
import type { UseBurstResult } from '../hooks/useBurst';

export interface ShutterButtonProps {
  handlers: UseBurstResult['shutterHandlers'];
  disabled: boolean;
  busy: boolean;
  /** Id of an element explaining why the shutter is disabled (session full). */
  describedBy?: string | undefined;
}

/** Tap for one photo, hold for a burst (FR-001/FR-002). */
export function ShutterButton({ handlers, disabled, busy, describedBy }: ShutterButtonProps) {
  return (
    <button
      type="button"
      aria-label="Capture photo"
      aria-describedby={describedBy ?? 'shutter-hint'}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      {...handlers}
      style={{
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      className={cn(
        'group relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full',
        'border-4 border-white/90 bg-white/10 shadow-lg backdrop-blur transition-transform duration-100',
        'active:scale-90 disabled:opacity-40',
      )}
    >
      <span
        className={cn(
          'flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white transition-transform duration-100',
          'group-active:scale-90',
        )}
      >
        {busy && <LoaderCircle className="animate-spin text-slate-900" size={26} aria-hidden />}
      </span>
      <span id="shutter-hint" className="sr-only">
        Hold to take a burst
      </span>
    </button>
  );
}
