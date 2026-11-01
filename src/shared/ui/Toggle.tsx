import * as RadixToggle from '@radix-ui/react-toggle';
import type { ReactNode } from 'react';
import { LoaderCircle } from './icons';
import { cn } from './cn';

export interface ToggleProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  'aria-label': string;
  disabled?: boolean;
  /** Shows a spinner and blocks input while the change is being confirmed. */
  pending?: boolean;
  children: ReactNode;
  className?: string;
}

export function Toggle({
  pressed,
  onPressedChange,
  disabled,
  pending,
  children,
  className,
  ...rest
}: ToggleProps) {
  return (
    <RadixToggle.Root
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      aria-label={rest['aria-label']}
      className={cn(
        'relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
        'bg-black/45 text-white backdrop-blur transition-[background-color,transform] duration-100 active:scale-95',
        'data-[state=on]:bg-annotation-selected data-[state=on]:text-slate-950',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      {pending ? <LoaderCircle className="animate-spin" size={20} aria-hidden /> : children}
    </RadixToggle.Root>
  );
}
