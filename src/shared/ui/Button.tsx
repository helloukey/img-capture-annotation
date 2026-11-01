import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Visually emphasize this action (e.g. Retake when quality is Poor). */
  emphasis?: boolean;
  size?: 'md' | 'lg';
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-slate-950 hover:bg-accent-strong',
  secondary: 'bg-surface-overlay text-slate-100 border border-border hover:bg-[#252c3b]',
  ghost: 'bg-transparent text-slate-200 hover:bg-white/10',
  danger: 'bg-poor text-white hover:bg-red-600',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', emphasis = false, size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-2 rounded-xl font-medium',
        'transition-[background-color,transform,box-shadow] duration-100 active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm',
        variants[variant],
        emphasis && 'ring-2 ring-offset-2 ring-offset-surface ring-current shadow-lg',
        className,
      )}
      {...props}
    />
  );
});
