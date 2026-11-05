import { cn } from '@/shared/ui/cn';
import type { AppStep } from './appReducer';

const STEPS: { id: AppStep; label: string }[] = [
  { id: 'camera', label: 'Capture' },
  { id: 'review', label: 'Review' },
  { id: 'annotate', label: 'Annotate' },
];

/** Shows where the user is in Capture → Review → Annotate (FR-033). */
export function StepIndicator({ current }: { current: AppStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-1 text-xs sm:gap-1.5 sm:text-sm">
        {STEPS.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          return (
            <li key={step.id} className="flex items-center gap-1.5">
              <span
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors',
                  state === 'current' && 'bg-accent text-slate-950 font-semibold',
                  state === 'done' && 'text-slate-200',
                  state === 'todo' && 'text-muted',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                    state === 'current' ? 'bg-slate-950/20' : 'bg-white/10',
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                {/* On narrow phones only the current step shows its name. */}
                <span className={state === 'current' ? undefined : 'sr-only sm:not-sr-only'}>
                  {step.label}
                </span>
              </span>
              {i < STEPS.length - 1 && <span className="h-px w-2 bg-border sm:w-6" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
