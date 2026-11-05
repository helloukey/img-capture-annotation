import { useState, type ReactNode } from 'react';
import { useSession } from '@/app/AppContext';
import { PhotoStrip } from '@/features/session/components/PhotoStrip';
import { DELETE_COPY, useDeletePhoto } from '@/features/session/hooks/useDeletePhoto';
import { useStartOver } from '@/features/session/hooks/useStartOver';
import { useStripData } from '@/features/session/hooks/useStripData';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { CapturedImage } from '@/shared/types';
import { Button } from '@/shared/ui/Button';
import { Check, LoaderCircle, Plus, RotateCcw, Trash2 } from '@/shared/ui/icons';

export interface ReviewViewProps {
  image: CapturedImage;
  /** Quality indicator slot (US4). */
  quality?: ReactNode;
  /** When true, Retake is emphasized and continue reads "Use anyway" (FR-019). */
  poorQuality?: boolean;
}

export function ReviewView({ image, quality, poorQuality = false }: ReviewViewProps) {
  const { go, photos, selectedId, select } = useSession();
  const retake = useDeletePhoto();
  const remove = useDeletePhoto(DELETE_COPY);
  const restart = useStartOver();
  const multi = photos.length > 1;
  const strip = useStripData();
  const wide = useMediaQuery('(min-width: 1024px)');
  // Tracked per photo, so switching photos shows the spinner until the new one has loaded.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loaded = loadedId === image.id;

  return (
    <section aria-label="Review photo" className="flex h-full flex-col landscape:flex-row lg:flex-row">
      <div className={`flex min-h-0 min-w-0 flex-1 bg-black ${wide ? 'flex-row' : 'flex-col'}`}>
        <PhotoStrip
          photos={photos}
          selectedId={selectedId}
          onSelect={select}
          onDelete={remove.request}
          annotationCounts={strip.annotationCounts}
          verdicts={strip.verdicts}
          orientation={wide ? 'vertical' : 'horizontal'}
          className={
            wide
              ? 'order-first w-24 shrink-0 border-r border-border'
              : 'order-last shrink-0 border-t border-border'
          }
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-2">
          <img
            key={image.id}
            src={image.objectUrl}
            alt="Your capture"
            onLoad={() => setLoadedId(image.id)}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
          {!loaded && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              role="status"
              aria-label="Preparing photo"
            >
              <LoaderCircle className="animate-spin text-muted" size={32} aria-hidden />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col border-t border-border bg-surface-raised landscape:w-80 landscape:border-l landscape:border-t-0 lg:w-96 lg:border-l lg:border-t-0">
        {quality && (
          <div className="max-h-[38dvh] overflow-y-auto p-3 landscape:max-h-none landscape:min-h-0 landscape:flex-1 lg:max-h-none lg:flex-1 lg:p-4">
            {quality}
          </div>
        )}
        {multi ? (
          <div className="safe-bottom safe-x flex flex-col gap-2 border-t border-border pt-3 lg:mt-auto">
            <div className="grid grid-cols-3 gap-1">
              <Button
                variant="ghost"
                className="px-1 text-xs sm:text-sm"
                onClick={() => remove.request(image.id)}
              >
                <Trash2 size={16} aria-hidden /> Delete photo
              </Button>
              <Button variant="ghost" className="px-1 text-xs sm:text-sm" onClick={() => go('camera')}>
                <Plus size={16} aria-hidden /> Add more
              </Button>
              <Button variant="ghost" className="px-1 text-xs sm:text-sm" onClick={restart.request}>
                <RotateCcw size={16} aria-hidden /> Start over
              </Button>
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={() => go('annotate')}>
              <Check size={18} aria-hidden /> Continue to annotate
            </Button>
          </div>
        ) : (
          <div className="safe-bottom safe-x flex flex-col gap-1 border-t border-border pt-3 lg:mt-auto">
            <div className="flex gap-3">
              <Button
                className="flex-1 whitespace-nowrap px-3"
                size="lg"
                variant={poorQuality ? 'primary' : 'secondary'}
                emphasis={poorQuality}
                onClick={() => retake.request(image.id)}
              >
                <RotateCcw size={18} aria-hidden /> Retake
              </Button>
              <Button
                className="flex-1 whitespace-nowrap px-3"
                size="lg"
                variant={poorQuality ? 'secondary' : 'primary'}
                onClick={() => go('annotate')}
              >
                <Check size={18} aria-hidden /> {poorQuality ? 'Use anyway' : 'Use Photo'}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => go('camera')}
              className="mx-auto flex min-h-11 items-center gap-1 px-3 text-sm text-accent hover:underline"
            >
              <Plus size={14} aria-hidden /> Add more photos
            </button>
          </div>
        )}
      </div>

      {retake.dialog}
      {remove.dialog}
      {restart.dialog}
    </section>
  );
}
