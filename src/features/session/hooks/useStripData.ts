import { useApp } from '@/app/AppContext';
import { assessQuality } from '@/features/quality/lib/assess';
import type { QualityRating } from '@/features/quality/lib/types';
import { annotationCount } from '../lib/sessionSelectors';
import { usePhotoInfos } from './usePhotoInfo';

/** Quality verdicts (once analyzed) and annotation counts for every photo in the session. */
export function useStripData() {
  const { state } = useApp();
  const { photos } = state.session;
  const infos = usePhotoInfos(photos.map((p) => p.id));
  const verdicts: Record<string, QualityRating | undefined> = {};
  const annotationCounts: Record<string, number> = {};
  for (const p of photos) {
    const info = infos[p.id];
    if (info?.status === 'ready' && info.metrics) {
      verdicts[p.id] = assessQuality(info.metrics, undefined, {
        torchSupported: p.torchAvailable ?? false,
      }).verdict;
    }
    annotationCounts[p.id] = annotationCount(state.session, p.id);
  }
  return { verdicts, annotationCounts };
}
