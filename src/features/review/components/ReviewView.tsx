import { useState, type ReactNode } from 'react';
import { useSession } from '@/app/AppContext';
import { useDeletePhoto } from '@/features/session/hooks/useDeletePhoto';
import type { CapturedImage } from '@/shared/types';
import { Button } from '@/shared/ui/Button';
import { Check, LoaderCircle, RotateCcw } from '@/shared/ui/icons';

export interface ReviewViewProps {
  image: CapturedImage;
  /** Quality indicator slot (US4). */
  quality?: ReactNode;
  /** When true, Retake is emphasized and continue reads "Use anyway" (FR-019). */
  poorQuality?: boolean;
}

export function ReviewView({ image, quality, poorQuality = false }: ReviewViewProps) {
  const { go } = useSession();
  const retake = useDeletePhoto();
  const [loaded, setLoaded] = useState(false);

  return (
    <section aria-label="Review photo" className="flex h-full flex-col landscape:flex-row lg:flex-row">
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-2">
        <img
          src={image.objectUrl}
          alt="Your capture"
          onLoad={() => setLoaded(true)}
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

      <div className="flex shrink-0 flex-col border-t border-border bg-surface-raised landscape:w-80 landscape:border-l landscape:border-t-0 lg:w-96 lg:border-l lg:border-t-0">
        {quality && (
          <div className="max-h-[38dvh] overflow-y-auto p-3 landscape:max-h-none landscape:min-h-0 landscape:flex-1 lg:max-h-none lg:flex-1 lg:p-4">
            {quality}
          </div>
        )}
        <div className="safe-bottom safe-x flex gap-3 border-t border-border pt-3 lg:mt-auto">
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
      </div>

      {retake.dialog}
    </section>
  );
}
