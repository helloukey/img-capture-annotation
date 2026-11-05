import { useEffect } from 'react';
import { usePhotoInfo } from '@/features/session/hooks/usePhotoInfo';
import { photoProcessor } from '@/features/session/lib/defaultPhotoProcessor';
import type { CapturedImage } from '@/shared/types';
import { assessQuality } from '../lib/assess';
import { QUALITY_THRESHOLDS } from '../lib/thresholds';
import type { QualityAssessment } from '../lib/types';

/**
 * Quality for one photo, backed by the shared background processor (feature 002, research R5):
 * computed once per photo, cached by id, and never during a burst.
 */
export function useQualityAssessment(image: CapturedImage | null): QualityAssessment | null {
  const info = usePhotoInfo(image?.id);

  // Photos normally arrive through the session (already queued); this covers any other caller.
  useEffect(() => {
    if (image && !photoProcessor.get(image.id)) photoProcessor.enqueue([image]);
    if (image) photoProcessor.prioritize(image.id);
  }, [image]);

  if (!image) return null;
  const ctx = { torchSupported: image.torchAvailable ?? false };
  if (info?.status === 'ready' && info.metrics) return assessQuality(info.metrics, QUALITY_THRESHOLDS, ctx);
  const known = {
    width: image.width,
    height: image.height,
    byteSize: image.byteSize,
    brightnessPct: null,
    sharpness: null,
  };
  if (info?.status === 'error') return assessQuality(known, QUALITY_THRESHOLDS, ctx);
  return { ...assessQuality(known, QUALITY_THRESHOLDS, ctx), status: 'pending' };
}
