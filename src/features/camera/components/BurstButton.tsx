import { cn } from '@/shared/ui/cn';
import { IconButton } from '@/shared/ui/IconButton';
import { Layers } from '@/shared/ui/icons';

export interface BurstButtonProps {
  running: boolean;
  disabled: boolean;
  onToggle(): void;
}

/**
 * A burst that doesn't depend on holding (constitution V, FR-028): activate to start, activate again
 * to stop; otherwise it stops by itself at the burst limits.
 */
export function BurstButton({ running, disabled, onToggle }: BurstButtonProps) {
  return (
    <IconButton
      aria-label="Take a burst of photos, up to 3 seconds"
      aria-pressed={running}
      tone="overlay"
      size="lg"
      disabled={disabled}
      onClick={onToggle}
      className={cn(running && 'bg-annotation-selected text-slate-950 hover:bg-annotation-selected')}
    >
      <Layers size={22} aria-hidden />
    </IconButton>
  );
}
