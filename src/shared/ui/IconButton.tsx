import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name (FR-034). */
  'aria-label': string;
  size?: 'md' | 'lg';
  tone?: 'default' | 'overlay' | 'danger';
}

const tones = {
  default: 'bg-surface-overlay text-slate-100 hover:bg-[#252c3b] border border-border',
  overlay: 'bg-black/45 text-white backdrop-blur hover:bg-black/60',
  danger: 'bg-surface-overlay text-poor hover:bg-poor/15 border border-border',
};

/** Icon button with a hit area of at least 44×44 CSS px (FR-031). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', tone = 'default', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full',
        'transition-[background-color,transform] duration-100 active:scale-95',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'lg' ? 'h-12 w-12' : 'h-11 w-11',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
});
