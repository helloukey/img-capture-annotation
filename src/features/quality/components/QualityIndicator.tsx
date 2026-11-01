import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { CapturedImage } from '@/shared/types';
import { Popover } from '@/shared/ui/Popover';
import { Sheet } from '@/shared/ui/Sheet';
import { useState } from 'react';
import { formatBytes, formatMegapixels, formatResolution } from '../lib/format';
import type { QualityAssessment } from '../lib/types';
import { QualityCheckRow } from './QualityCheckRow';
import { VerdictBadge } from './rating';

export interface QualityIndicatorProps {
  assessment: QualityAssessment;
  image: CapturedImage;
  variant: 'full' | 'compact';
}

const VERDICT_SUMMARY = {
  good: 'Looks great: sharp, well exposed, and high resolution.',
  fair: 'Usable, but could be better. See the tips below.',
  poor: 'This photo may not be good enough. Consider retaking it.',
} as const;

function FullIndicator({ assessment, image }: Omit<QualityIndicatorProps, 'variant'>) {
  const pending = assessment.status === 'pending';
  const raw = (id: string) => assessment.checks.find((c) => c.id === id)?.value;
  return (
    <div role="status" aria-live="polite" aria-label="Image quality" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Image quality</h2>
        <VerdictBadge rating={assessment.verdict} pending={pending} />
      </div>
      <p className="text-sm tabular-nums text-slate-200">
        {formatResolution(image.width, image.height)} · {formatBytes(image.byteSize)}
      </p>
      {!pending && <p className="text-sm text-muted">{VERDICT_SUMMARY[assessment.verdict]}</p>}
      <ul className="divide-y divide-border">
        {assessment.checks.map((c) => (
          <QualityCheckRow key={c.id} check={c} pending={pending} />
        ))}
      </ul>
      <details className="rounded-lg bg-surface/60 px-3 py-2 text-xs text-muted">
        <summary className="cursor-pointer select-none">Technical details</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
          <dt>Capture method</dt>
          <dd>{image.captureMethod}</dd>
          <dt>Format</dt>
          <dd>{image.mimeType}</dd>
          <dt>Mean luma</dt>
          <dd>
            {typeof raw('brightness') === 'number' ? `${(raw('brightness') as number).toFixed(1)}%` : '—'}
          </dd>
          <dt>Laplacian variance</dt>
          <dd>{typeof raw('sharpness') === 'number' ? (raw('sharpness') as number).toFixed(1) : '—'}</dd>
          {image.cameraLabel && (
            <>
              <dt>Camera</dt>
              <dd className="truncate">{image.cameraLabel}</dd>
            </>
          )}
        </dl>
      </details>
    </div>
  );
}

function CompactIndicator({ assessment, image }: Omit<QualityIndicatorProps, 'variant'>) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const [open, setOpen] = useState(false);
  const trigger = (
    <button
      type="button"
      onClick={desktop ? undefined : () => setOpen(true)}
      className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-2 py-1 text-xs hover:bg-surface-overlay"
    >
      <span className="sr-only">Image quality:</span>
      <VerdictBadge
        rating={assessment.verdict}
        pending={assessment.status === 'pending'}
        className="px-2 py-0.5 text-xs"
      />
      <span className="sr-only sm:not-sr-only sm:tabular-nums sm:text-muted">
        {formatMegapixels(image.width, image.height)} · {formatBytes(image.byteSize)}
      </span>
      <span className="sr-only">, show details</span>
    </button>
  );
  if (desktop) {
    return (
      <Popover trigger={trigger}>
        <FullIndicator assessment={assessment} image={image} />
      </Popover>
    );
  }
  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen} title="Image quality">
        <FullIndicator assessment={assessment} image={image} />
      </Sheet>
    </>
  );
}

/** Always-visible quality feedback: full on Review, compact on Annotate (FR-014). */
export function QualityIndicator({ variant, ...props }: QualityIndicatorProps) {
  return variant === 'full' ? <FullIndicator {...props} /> : <CompactIndicator {...props} />;
}
