import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { QualityRating } from '@/features/quality/lib/types';
import type { Photo } from '@/shared/types';
import { cn } from '@/shared/ui/cn';
import { PhotoThumb } from './PhotoThumb';

export interface PhotoStripProps {
  photos: readonly Photo[];
  selectedId: string | null;
  onSelect(id: string): void;
  onDelete(id: string): void;
  annotationCounts?: Record<string, number>;
  verdicts?: Record<string, QualityRating | undefined>;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Thumbnails of every photo in the session, shared by Review and Annotate (research R9).
 * Hidden for a single photo (FR-032); roving tabindex with arrow keys; Delete/Backspace deletes.
 */
export function PhotoStrip({
  photos,
  selectedId,
  onSelect,
  onDelete,
  annotationCounts = {},
  verdicts = {},
  orientation = 'horizontal',
  className,
}: PhotoStripProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    photos.findIndex((p) => p.id === selectedId),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const roving = Math.min(focusIndex, photos.length - 1);

  useEffect(() => {
    refs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedIndex, selectedId]);

  if (photos.length < 2) return null;

  const [prevKey, nextKey] =
    orientation === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
  const onKeyDown = (index: number, id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    let next: number | null = null;
    if (e.key === prevKey) next = Math.max(0, index - 1);
    else if (e.key === nextKey) next = Math.min(photos.length - 1, index + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = photos.length - 1;
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation(); // don't also delete the selected annotation
      onDelete(id);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setFocusIndex(next);
      refs.current[next]?.focus();
    }
  };

  return (
    <div
      role="toolbar"
      aria-label={`Photos (${photos.length})`}
      aria-orientation={orientation}
      className={cn(
        'flex gap-2 overflow-auto p-2 [scrollbar-width:thin]',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className,
      )}
    >
      {photos.map((p, i) => (
        <PhotoThumb
          key={p.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          photo={p}
          index={i}
          total={photos.length}
          selected={p.id === selectedId}
          focusable={i === roving}
          annotations={annotationCounts[p.id] ?? 0}
          verdict={verdicts[p.id]}
          onSelect={() => {
            setFocusIndex(i);
            onSelect(p.id);
          }}
          onKeyDown={onKeyDown(i, p.id)}
        />
      ))}
    </div>
  );
}
