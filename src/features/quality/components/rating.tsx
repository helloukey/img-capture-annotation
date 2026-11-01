import { cn } from '@/shared/ui/cn';
import { CircleAlert, CircleCheck, CircleX } from '@/shared/ui/icons';
import { RATING_TEXT } from '../lib/format';
import type { QualityRating } from '../lib/types';

/** Icon + color, never color alone (FR-034). */
export function RatingIcon({ rating, size = 20 }: { rating: QualityRating; size?: number }) {
  const Icon = rating === 'good' ? CircleCheck : rating === 'fair' ? CircleAlert : CircleX;
  return (
    <Icon
      size={size}
      aria-hidden
      className={cn(
        rating === 'good' && 'text-good',
        rating === 'fair' && 'text-fair',
        rating === 'poor' && 'text-poor',
      )}
    />
  );
}

export function VerdictBadge({
  rating,
  pending,
  className,
}: {
  rating: QualityRating;
  pending: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold',
        rating === 'good' && 'bg-good/15 text-good',
        rating === 'fair' && 'bg-fair/15 text-fair',
        rating === 'poor' && 'bg-poor/15 text-red-400',
        pending && 'opacity-70',
        className,
      )}
    >
      <RatingIcon rating={rating} size={16} />
      {RATING_TEXT[rating]}
      {pending && <span className="font-normal text-muted">· checking</span>}
    </span>
  );
}
