import { RATING_TEXT } from '@/features/quality/lib/format';
import type { QualityRating } from '@/features/quality/lib/types';

/** Accessible name for a strip thumbnail (FR-030). */
export function thumbLabel(p: {
  index: number;
  total: number;
  verdict?: QualityRating | undefined;
  annotations: number;
  burst: boolean;
}) {
  const quality = p.verdict ? `${RATING_TEXT[p.verdict]} quality` : 'quality pending';
  const notes = `${p.annotations} annotation${p.annotations === 1 ? '' : 's'}`;
  return `Photo ${p.index + 1} of ${p.total}, ${quality}, ${notes}${p.burst ? ', burst photo' : ''}`;
}
