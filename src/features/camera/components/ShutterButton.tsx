import { cn } from '@/shared/ui/cn';
import { LoaderCircle } from '@/shared/ui/icons';

export interface ShutterButtonProps {
  onCapture: () => void;
  disabled: boolean;
  busy: boolean;
}

export function ShutterButton({ onCapture, disabled, busy }: ShutterButtonProps) {
  return (
    <button
      type="button"
      aria-label="Capture photo"
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={onCapture}
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
    </button>
  );
}
