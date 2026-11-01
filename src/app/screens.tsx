import { AnnotateView } from '@/features/annotation/components/AnnotateView';
import { ExportMenu } from '@/features/annotation/components/ExportMenu';
import { QualityIndicator } from '@/features/quality/components/QualityIndicator';
import { useQualityAssessment } from '@/features/quality/hooks/useQualityAssessment';
import { ReviewView } from '@/features/review/components/ReviewView';
import type { CapturedImage } from '@/shared/types';

export function ReviewScreen({ image }: { image: CapturedImage }) {
  const assessment = useQualityAssessment(image);
  return (
    <ReviewView
      image={image}
      quality={assessment && <QualityIndicator variant="full" assessment={assessment} image={image} />}
      poorQuality={assessment?.status === 'ready' && assessment.verdict === 'poor'}
    />
  );
}

export function AnnotateScreen({ image }: { image: CapturedImage }) {
  const assessment = useQualityAssessment(image);
  return (
    <AnnotateView
      image={image}
      quality={assessment && <QualityIndicator variant="compact" assessment={assessment} image={image} />}
      toolbarActions={<ExportMenu image={image} quality={assessment} />}
    />
  );
}
