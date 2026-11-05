import { forwardRef, type KeyboardEvent } from 'react';
import type { QualityRating } from '@/features/quality/lib/types';
import type { Photo } from '@/shared/types';
import { cn } from '@/shared/ui/cn';
import { Layers } from '@/shared/ui/icons';
import { usePhotoInfo } from '../hooks/usePhotoInfo';
import { thumbLabel } from '../lib/thumbLabel';

export interface PhotoThumbProps {
  photo: Photo;
  index: number;
  total: number;
  selected: boolean;
  focusable: boolean;
  annotations: number;
  verdict?: QualityRating | undefined;
  onSelect(): void;
  onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void;
}

const DOT: Record<QualityRating, string> = { good: 'bg-good', fair: 'bg-fair', poor: 'bg-poor' };

/** A small preview (never the full-resolution photo; constitution VIII). */
export const PhotoThumb = forwardRef<HTMLButtonElement, PhotoThumbProps>(function PhotoThumb(
  { photo, index, total, selected, focusable, annotations, verdict, onSelect, onKeyDown },
  ref,
) {
  const info = usePhotoInfo(photo.id);
  const burst = photo.captureMethod === 'burst';
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      aria-label={thumbLabel({ index, total, verdict, annotations, burst })}
      tabIndex={focusable ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-surface-overlay transition-[border-color,transform] active:scale-95 sm:h-16 sm:w-16',
        selected ? 'border-annotation-selected' : 'border-transparent hover:border-border',
      )}
    >
      {info?.thumbnailUrl ? (
        <img src={info.thumbnailUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="block h-full w-full animate-pulse bg-border/60" aria-hidden />
      )}
      {verdict && (
        <span
          className={cn('absolute left-1 top-1 h-2.5 w-2.5 rounded-full ring-1 ring-black/40', DOT[verdict])}
          aria-hidden
        />
      )}
      {burst && (
        <span className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white" aria-hidden>
          <Layers size={10} />
        </span>
      )}
      {annotations > 0 && (
        <span
          className="absolute bottom-1 right-1 min-w-4 rounded-full bg-annotation px-1 text-[10px] font-bold leading-4 text-slate-950"
          aria-hidden
        >
          {annotations}
        </span>
      )}
    </button>
  );
});
