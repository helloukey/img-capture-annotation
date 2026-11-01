import { useEffect, useState } from 'react';
import type { CapturedImage } from '@/shared/types';
import { assessQuality } from '../lib/assess';
import { measureImage } from '../lib/measure';
import { QUALITY_THRESHOLDS } from '../lib/thresholds';
import type { ImageMetrics, QualityAssessment } from '../lib/types';

/** Metrics per image id, so moving Review ↔ Annotate never re-analyzes. */
const metricsCache = new Map<string, ImageMetrics>();

export function useQualityAssessment(image: CapturedImage | null): QualityAssessment | null {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!image || metricsCache.has(image.id)) return;
    let cancelled = false;
    void measureImage(image).then((m) => {
      metricsCache.set(image.id, m);
      const oldest = metricsCache.keys().next().value;
      if (metricsCache.size > 8 && oldest !== undefined) metricsCache.delete(oldest);
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  if (!image) return null;
  const ctx = { torchSupported: image.torchAvailable ?? false };
  const cached = metricsCache.get(image.id);
  if (cached) return assessQuality(cached, QUALITY_THRESHOLDS, ctx);
  // Resolution and size are known immediately; pixel checks follow.
  const pending = assessQuality(
    {
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
      brightnessPct: null,
      sharpness: null,
    },
    QUALITY_THRESHOLDS,
    ctx,
  );
  return { ...pending, status: 'pending' };
}

/** Test hook: clears cached metrics. */
export function clearQualityCache() {
  metricsCache.clear();
}
