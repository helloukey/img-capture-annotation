import { describe, expect, it, vi } from 'vitest';
import { SESSION_MAX_BYTES, SESSION_MAX_PHOTOS } from '@/features/session/lib/limits';
import type { Photo } from '@/shared/types';
import { makeAppState, makePhoto } from '../../../../tests/fakes/appState';
import { UploadError } from './fileToCapturedImage';
import { importPhotos, importSummary } from './importPhotos';

const file = (name: string, size = 1000, type = 'image/jpeg') => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

/** Fake converter: names starting with "bad" are unreadable, non-image types aren't images. */
const convert = vi.fn(async (f: File): Promise<Photo> => {
  if (!f.type.startsWith('image/')) throw new UploadError('not an image', undefined, 'not-image');
  if (f.name.startsWith('bad')) throw new UploadError('unreadable', undefined, 'unreadable');
  return makePhoto({ id: f.name, byteSize: f.size });
});

describe('importPhotos (US6, FR-031)', () => {
  it('adds readable images in order and reports skipped files by reason', async () => {
    const session = makeAppState([]).session;
    const result = await importPhotos(
      [file('a.jpg'), file('notes.txt', 10, 'text/plain'), file('bad.jpg'), file('b.jpg')],
      session,
      convert,
    );
    expect(result.photos.map((p) => p.id)).toEqual(['a.jpg', 'b.jpg']);
    expect(result.skipped).toEqual({ notImage: 1, unreadable: 1, sessionFull: 0, memory: 0 });
  });

  it('skips files beyond the session limit without decoding them', async () => {
    convert.mockClear();
    const session = makeAppState(
      Array.from({ length: SESSION_MAX_PHOTOS - 1 }, () => makePhoto({ byteSize: 1 })),
    ).session;
    const result = await importPhotos([file('a.jpg'), file('b.jpg'), file('c.jpg')], session, convert);
    expect(result.photos).toHaveLength(1);
    expect(result.skipped.sessionFull).toBe(2);
    expect(convert).toHaveBeenCalledTimes(1);
  });

  it('skips files that would exceed the memory budget', async () => {
    const session = makeAppState([makePhoto({ byteSize: SESSION_MAX_BYTES - 5_000_000 })]).session;
    const result = await importPhotos([file('a.jpg', 3_000_000), file('b.jpg', 3_000_000)], session, convert);
    expect(result.photos).toHaveLength(1);
    expect(result.skipped.memory).toBe(1);
  });

  it('summarizes the outcome in one line', () => {
    expect(importSummary(4, { notImage: 1, unreadable: 0, sessionFull: 2, memory: 0 })).toBe(
      '4 added · 1 skipped: not an image · 2 skipped: session full',
    );
    expect(importSummary(0, { notImage: 0, unreadable: 1, sessionFull: 0, memory: 0 })).toBe(
      '0 added · 1 skipped: couldn’t be opened',
    );
    expect(importSummary(3, { notImage: 0, unreadable: 0, sessionFull: 0, memory: 0 })).toBeNull();
  });
});
