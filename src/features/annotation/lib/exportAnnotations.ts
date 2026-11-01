import type { QualityAssessment } from '@/features/quality/lib/types';
import type { CapturedImage } from '@/shared/types';
import { displayName, LABEL_MAX_LENGTH, type Annotation } from './annotationReducer';

/** Shape of contracts/export-format.schema.json (enhancement, US8). */
export interface AnnotationExport {
  version: 1;
  exportedAt: string;
  image: {
    width: number;
    height: number;
    byteSize: number;
    mimeType: string;
    source: 'camera' | 'upload';
    capturedAt: string;
  };
  quality?: { verdict: string; checks: { id: string; rating: string; value: number }[] };
  annotations: { id: string; label: string; bbox: { x: number; y: number; width: number; height: number } }[];
}

export function buildExport(
  image: CapturedImage,
  items: readonly Annotation[],
  quality: QualityAssessment | null,
  now: Date = new Date(),
): AnnotationExport {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    image: {
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
      mimeType: image.mimeType,
      source: image.source,
      capturedAt: new Date(image.capturedAt).toISOString(),
    },
    ...(quality && quality.status === 'ready'
      ? {
          quality: {
            verdict: quality.verdict,
            checks: quality.checks
              .filter((c) => c.value !== null)
              .map((c) => ({ id: c.id, rating: c.rating, value: c.value as number })),
          },
        }
      : {}),
    annotations: items.map((a) => ({
      id: a.id,
      label: a.label.slice(0, LABEL_MAX_LENGTH),
      bbox: {
        x: Math.round(a.x),
        y: Math.round(a.y),
        width: Math.max(1, Math.round(a.width)),
        height: Math.max(1, Math.round(a.height)),
      },
    })),
  };
}

export function exportFileName(image: CapturedImage, ext: 'json' | 'jpg'): string {
  const stamp = new Date(image.capturedAt).toISOString().slice(0, 19).replace(/:/g, '-');
  return `${ext === 'json' ? 'annotations' : 'annotated'}-${stamp}.${ext}`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(data: unknown, fileName: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName);
}

/** iOS Safari caps canvas area at ~16.7 MP; larger photos are scaled to fit. */
const MAX_CANVAS_PIXELS = 16_777_216;

/** Renders the photo with boxes and labels burned in, at full resolution where the browser allows. */
export async function renderAnnotatedImage(
  image: CapturedImage,
  items: readonly Annotation[],
): Promise<Blob> {
  const scale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (image.width * image.height)));
  const w = Math.round(image.width * scale);
  const h = Math.round(image.height * scale);
  const bitmap = await createImageBitmap(image.blob, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const short = Math.min(w, h);
  const line = Math.max(2, short / 350);
  const font = Math.max(14, short / 45);
  ctx.font = `600 ${font}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  for (const a of items) {
    const x = a.x * scale;
    const y = a.y * scale;
    ctx.lineWidth = line;
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56,189,248,0.12)';
    ctx.fillRect(x, y, a.width * scale, a.height * scale);
    ctx.strokeRect(x, y, a.width * scale, a.height * scale);
    const text = displayName(a);
    const pad = font * 0.3;
    const tw = ctx.measureText(text).width + pad * 2;
    const th = font + pad * 2;
    const ty = y - th < 0 ? y : y - th;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x, ty, tw, th);
    ctx.fillStyle = '#020617';
    ctx.fillText(text, x + pad, ty + pad);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))),
      'image/jpeg',
      0.95,
    ),
  );
}
