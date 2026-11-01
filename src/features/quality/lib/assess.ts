import { formatBytes, formatResolution } from './format';
import { QUALITY_THRESHOLDS, type QualityThresholds } from './thresholds';
import type { ImageMetrics, QualityAssessment, QualityCheck, QualityRating } from './types';

const ORDER: Record<QualityRating, number> = { good: 0, fair: 1, poor: 2 };

export function worstRating(ratings: readonly QualityRating[]): QualityRating {
  return ratings.reduce<QualityRating>((worst, r) => (ORDER[r] > ORDER[worst] ? r : worst), 'good');
}

export interface AssessContext {
  torchSupported?: boolean;
}

function check(c: QualityCheck, rating: QualityRating, message?: string, tip?: string): QualityCheck {
  return rating === 'good'
    ? { ...c, rating }
    : { ...c, rating, ...(message ? { message } : {}), ...(tip ? { tip } : {}) };
}

function unanalyzed(base: QualityCheck, what: string): QualityCheck {
  return { ...base, rating: 'fair', display: '—', message: `Couldn’t analyze ${what} on this device.` };
}

/** Pure quality evaluation (contracts/quality.md). Boundaries are inclusive at the "good" edge. */
export function assessQuality(
  m: ImageMetrics,
  t: QualityThresholds = QUALITY_THRESHOLDS,
  ctx: AssessContext = {},
): QualityAssessment {
  const mp = (m.width * m.height) / 1_000_000;
  const resolutionBase: QualityCheck = {
    id: 'resolution',
    label: 'Resolution',
    rating: 'good',
    value: mp,
    display: formatResolution(m.width, m.height),
  };
  const resolution =
    mp >= t.resolutionMP.good
      ? check(resolutionBase, 'good')
      : mp >= t.resolutionMP.fair
        ? check(
            resolutionBase,
            'fair',
            'Resolution is a bit low for fine detail.',
            'Move closer to the subject, or use the rear camera if available.',
          )
        : check(
            resolutionBase,
            'poor',
            'Resolution is too low.',
            'Use the rear camera or a device with a higher-resolution camera.',
          );

  const f = t.fileSizeBytes;
  const sizeBase: QualityCheck = {
    id: 'fileSize',
    label: 'File size',
    rating: 'good',
    value: m.byteSize,
    display: formatBytes(m.byteSize),
  };
  const fileSize =
    m.byteSize >= f.goodMin && m.byteSize <= f.goodMax
      ? check(sizeBase, 'good')
      : m.byteSize > f.goodMax
        ? check(
            sizeBase,
            'fair',
            'The file is very large.',
            'That’s fine for detail, but it may be slow to share or upload.',
          )
        : m.byteSize >= f.fairMin
          ? check(
              sizeBase,
              'fair',
              'The file is small, so it may lack detail.',
              'Fill the frame with your subject and make sure it’s well lit.',
            )
          : check(
              sizeBase,
              'poor',
              'The file is unusually small, so the photo likely lacks detail.',
              'Check the lens isn’t covered and the scene isn’t too dark or plain.',
            );

  const b = t.brightnessPct;
  const brightBase: QualityCheck = {
    id: 'brightness',
    label: 'Brightness',
    rating: 'good',
    value: m.brightnessPct,
    display: m.brightnessPct === null ? '—' : `${Math.round(m.brightnessPct)}%`,
  };
  const darkTip = ctx.torchSupported
    ? 'Turn on the torch or move to better light.'
    : 'Move to better light or add a lamp.';
  let brightness: QualityCheck;
  if (m.brightnessPct === null) brightness = unanalyzed(brightBase, 'brightness');
  else if (m.brightnessPct >= b.goodMin && m.brightnessPct <= b.goodMax)
    brightness = check(brightBase, 'good');
  else if (m.brightnessPct < b.fairMin)
    brightness = check(brightBase, 'poor', 'The image is too dark.', darkTip);
  else if (m.brightnessPct < b.goodMin)
    brightness = check(brightBase, 'fair', 'The image is a little dark.', darkTip);
  else if (m.brightnessPct <= b.fairMax)
    brightness = check(
      brightBase,
      'fair',
      'The image is a little bright.',
      'Avoid pointing at bright lights or windows.',
    );
  else
    brightness = check(
      brightBase,
      'poor',
      'The image is overexposed.',
      'Move away from direct light or turn off the torch.',
    );

  const s = t.sharpness;
  const sharpBase: QualityCheck = {
    id: 'sharpness',
    label: 'Sharpness',
    rating: 'good',
    value: m.sharpness,
    display: m.sharpness === null ? '—' : String(Math.round(m.sharpness)),
  };
  let sharpness: QualityCheck;
  if (m.sharpness === null) sharpness = unanalyzed(sharpBase, 'sharpness');
  else if (m.sharpness >= s.good) sharpness = { ...check(sharpBase, 'good'), display: 'Sharp' };
  else if (m.sharpness >= s.fair)
    sharpness = {
      ...check(
        sharpBase,
        'fair',
        'The image looks slightly soft or blurred.',
        'Hold steady and tap to focus before capturing.',
      ),
      display: 'Slightly soft',
    };
  else
    sharpness = {
      ...check(
        sharpBase,
        'poor',
        'The image looks blurry.',
        'Hold the device steady, wait for focus, and retake.',
      ),
      display: 'Blurry',
    };

  const checks = [resolution, fileSize, brightness, sharpness];
  return { checks, verdict: worstRating(checks.map((c) => c.rating)), status: 'ready' };
}
