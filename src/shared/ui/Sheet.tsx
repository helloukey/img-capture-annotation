import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from './icons';
import { IconButton } from './IconButton';
import { cn } from './cn';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Bottom sheet for phone-sized screens (dismissible, focus-trapped). */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col rounded-t-2xl border-t border-border',
            'bg-surface-raised shadow-2xl animate-sheet-up safe-bottom',
            className,
          )}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" aria-hidden />
          <div className="flex items-center justify-between px-4 pb-1 pt-2">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close" tone="overlay">
                <X size={18} />
              </IconButton>
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="px-4 text-sm text-muted">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
