import { cn } from '@/shared/ui/cn';
import type { QualityCheck } from '../lib/types';
import { RATING_TEXT } from '../lib/format';
import { RatingIcon } from './rating';

export function QualityCheckRow({ check, pending }: { check: QualityCheck; pending: boolean }) {
  const analyzing = pending && check.value === null;
  return (
    <li className="flex gap-3 py-2.5">
      <span className="mt-0.5">
        {analyzing ? (
          <span className="block h-5 w-5 animate-pulse rounded-full bg-border" aria-hidden />
        ) : (
          <RatingIcon rating={check.rating} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{check.label}</span>
          <span className="truncate text-sm tabular-nums text-muted">
            {analyzing ? 'Analyzing…' : check.display}
            {!analyzing && <span className="sr-only">, {RATING_TEXT[check.rating]}</span>}
          </span>
        </div>
        {!analyzing && check.message && (
          <p className={cn('mt-0.5 text-sm', check.rating === 'poor' ? 'text-red-300' : 'text-amber-200')}>
            {check.message}
          </p>
        )}
        {!analyzing && check.tip && <p className="mt-0.5 text-xs text-muted">💡 {check.tip}</p>}
      </div>
    </li>
  );
}
