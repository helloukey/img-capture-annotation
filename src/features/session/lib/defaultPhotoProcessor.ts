import { analyzeSource, decodeForProcessing, renderThumbnail } from '@/features/quality/lib/measure';
import { THUMBNAIL_LONG_SIDE } from './limits';
import { createPhotoProcessor } from './photoProcessor';

function schedule(task: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: 250 });
  else setTimeout(task, 0);
}

/** The app-wide processor, wired to the real decoder, metrics and thumbnail renderer. */
export const photoProcessor = createPhotoProcessor({
  decode: decodeForProcessing,
  analyze: analyzeSource,
  thumbnail: (source, w, h) => renderThumbnail(source, w, h, THUMBNAIL_LONG_SIDE),
  schedule,
});
