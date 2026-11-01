import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { ChevronLeft, RotateCcw } from '@/shared/ui/icons';

export interface AnnotationToolbarProps {
  onBack(): void;
  onRetake(): void;
  /** Compact quality badge (US4). */
  quality?: ReactNode;
  /** Annotation list toggle (US7) and export menu (US8). */
  actions?: ReactNode;
}

export function AnnotationToolbar({ onBack, onRetake, quality, actions }: AnnotationToolbarProps) {
  return (
    <div className="safe-x flex shrink-0 items-center gap-2 border-b border-border bg-surface-raised py-2">
      <Button variant="ghost" onClick={onBack} aria-label="Back to review">
        <ChevronLeft size={18} aria-hidden /> <span className="hidden sm:inline">Review</span>
      </Button>
      <Button variant="ghost" onClick={onRetake} aria-label="Retake">
        <RotateCcw size={16} aria-hidden /> <span className="hidden sm:inline">Retake</span>
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {quality}
        {actions}
      </div>
    </div>
  );
}
