import type { ImageMetrics } from '@/features/quality/lib/types';
import type { Photo } from '@/shared/types';

export interface PhotoInfo {
  status: 'queued' | 'processing' | 'ready' | 'error';
  thumbnailUrl: string | null;
  metrics: ImageMetrics | null;
}

export interface DecodedSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

export interface ProcessorDeps {
  decode(blob: Blob): Promise<DecodedSource>;
  /** Brightness and sharpness on a 512 px copy, or null if the canvas is unavailable. */
  analyze(
    source: CanvasImageSource,
    w: number,
    h: number,
  ): { brightnessPct: number; sharpness: number } | null;
  thumbnail(source: CanvasImageSource, w: number, h: number): Promise<Blob>;
  schedule(task: () => void): void;
}

export interface PhotoProcessor {
  enqueue(photos: readonly Photo[]): void;
  prioritize(photoId: string): void;
  pause(): void;
  resume(): void;
  release(photoId: string): void;
  releaseAll(): void;
  get(photoId: string): PhotoInfo | undefined;
  subscribe(listener: () => void): () => void;
}

/**
 * Background thumbnails + quality metrics (research R5, constitution VIII): one photo at a time,
 * selected photo first, paused during bursts, one decode per photo, URLs revoked on release.
 */
export function createPhotoProcessor(deps: ProcessorDeps): PhotoProcessor {
  const info = new Map<string, PhotoInfo>();
  const photos = new Map<string, Photo>();
  const listeners = new Set<() => void>();
  let queue: string[] = [];
  let running: string | null = null;
  let paused = false;
  let scheduled = false;

  const emit = () => listeners.forEach((l) => l());
  const set = (id: string, value: PhotoInfo) => {
    info.set(id, value);
    emit();
  };

  async function process(photo: Photo): Promise<PhotoInfo> {
    let decoded: DecodedSource | null = null;
    try {
      decoded = await deps.decode(photo.blob);
      const pixels = deps.analyze(decoded.source, decoded.width, decoded.height);
      const thumb = await deps.thumbnail(decoded.source, decoded.width, decoded.height);
      const metrics: ImageMetrics = {
        width: photo.width,
        height: photo.height,
        byteSize: photo.byteSize,
        brightnessPct: pixels?.brightnessPct ?? null,
        sharpness: pixels?.sharpness ?? null,
      };
      return { status: 'ready', thumbnailUrl: URL.createObjectURL(thumb), metrics };
    } catch {
      return { status: 'error', thumbnailUrl: null, metrics: null };
    } finally {
      decoded?.close();
    }
  }

  function runNext() {
    if (paused || running) return;
    const id = queue.shift();
    const photo = id ? photos.get(id) : undefined;
    if (!id || !photo) return;
    running = id;
    set(id, { status: 'processing', thumbnailUrl: null, metrics: null });
    void process(photo).then((result) => {
      running = null;
      if (photos.has(id)) {
        set(id, result);
      } else if (result.thumbnailUrl) {
        URL.revokeObjectURL(result.thumbnailUrl); // released while processing: discard, don't leak
      }
      pump();
    });
  }

  function pump() {
    if (paused || running || scheduled || queue.length === 0) return;
    scheduled = true;
    deps.schedule(() => {
      scheduled = false;
      runNext();
    });
  }

  function release(id: string) {
    const entry = info.get(id);
    if (entry?.thumbnailUrl) URL.revokeObjectURL(entry.thumbnailUrl);
    const had = photos.delete(id) || info.delete(id);
    info.delete(id);
    queue = queue.filter((q) => q !== id);
    if (had) emit();
  }

  return {
    enqueue(list) {
      for (const p of list) {
        if (photos.has(p.id)) continue;
        photos.set(p.id, p);
        info.set(p.id, { status: 'queued', thumbnailUrl: null, metrics: null });
        queue.push(p.id);
      }
      emit();
      pump();
    },
    prioritize(id) {
      if (!queue.includes(id)) return;
      queue = [id, ...queue.filter((q) => q !== id)];
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      pump();
    },
    release,
    releaseAll() {
      for (const id of [...photos.keys()]) release(id);
    },
    get: (id) => info.get(id),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
