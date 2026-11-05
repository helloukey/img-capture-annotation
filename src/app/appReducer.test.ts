import { describe, expect, it } from 'vitest';
import { annotationReducer, initialAnnotationState } from '@/features/annotation/lib/annotationReducer';
import { SESSION_MAX_BYTES, SESSION_MAX_PHOTOS } from '@/features/session/lib/limits';
import { makeAppState, makePhoto } from '../../tests/fakes/appState';
import { appReducer, initialAppState, type AppState } from './appReducer';

const rect = { x: 10, y: 10, width: 100, height: 100 };
const withBox = (photoId: string) =>
  annotationReducer(initialAnnotationState(photoId), {
    type: 'CREATE',
    id: `${photoId}-a`,
    rect,
    createdAt: 1,
  });

describe('appReducer', () => {
  it('starts on the camera with an empty session', () => {
    expect(initialAppState).toEqual({
      step: 'camera',
      session: { photos: [], selectedId: null, annotations: {}, pending: {} },
    });
  });

  describe('PHOTOS_ADDED', () => {
    it('appends, selects the first new photo, goes to review, and creates empty annotation slices', () => {
      const a = makePhoto();
      const s1 = appReducer(initialAppState, { type: 'PHOTOS_ADDED', photos: [a] });
      const b = makePhoto();
      const c = makePhoto();
      const s2 = appReducer({ ...s1, step: 'camera' }, { type: 'PHOTOS_ADDED', photos: [b, c] });
      expect(s2.session.photos.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
      expect(s2.session.selectedId).toBe(b.id);
      expect(s2.step).toBe('review');
      expect(s2.session.annotations[c.id]).toEqual(initialAnnotationState(c.id));
    });

    it(`caps the session at ${SESSION_MAX_PHOTOS} photos`, () => {
      const start = makeAppState(
        Array.from({ length: SESSION_MAX_PHOTOS - 2 }, () => makePhoto({ byteSize: 1000 })),
      );
      const s = appReducer(start, {
        type: 'PHOTOS_ADDED',
        photos: [1, 2, 3, 4].map(() => makePhoto({ byteSize: 1000 })),
      });
      expect(s.session.photos).toHaveLength(SESSION_MAX_PHOTOS);
    });

    it('caps the session at the byte budget, counting pending deletions', () => {
      const big = makePhoto({ byteSize: SESSION_MAX_BYTES - 10_000_000 });
      let s = appReducer(initialAppState, {
        type: 'PHOTOS_ADDED',
        photos: [big, makePhoto({ byteSize: 1000 })],
      });
      s = appReducer(s, { type: 'DELETE_PHOTO', photoId: big.id, token: 't' });
      s = appReducer(s, {
        type: 'PHOTOS_ADDED',
        photos: [makePhoto({ byteSize: 5_000_000 }), makePhoto({ byteSize: 6_000_000 })],
      });
      expect(s.session.photos).toHaveLength(2); // 1000 + 5MB fit; 6MB would exceed with the pending 140MB
    });

    it('returns the same state for an empty list', () => {
      expect(appReducer(initialAppState, { type: 'PHOTOS_ADDED', photos: [] })).toBe(initialAppState);
    });
  });

  it('SELECT changes the selection; unknown ids are ignored', () => {
    const [a, b] = [makePhoto(), makePhoto()];
    const s = makeAppState([a, b]);
    expect(appReducer(s, { type: 'SELECT', photoId: b.id }).session.selectedId).toBe(b.id);
    expect(appReducer(s, { type: 'SELECT', photoId: 'nope' })).toBe(s);
  });

  describe('DELETE_PHOTO / UNDO / FINALIZE', () => {
    it('moves the photo and its annotations to pending and selects the next photo', () => {
      const [a, b, c] = [makePhoto(), makePhoto(), makePhoto()];
      const s = appReducer(
        makeAppState([a, b, c], { selectedId: b.id, annotations: { [b.id]: withBox(b.id) } }),
        {
          type: 'DELETE_PHOTO',
          photoId: b.id,
          token: 't1',
        },
      );
      expect(s.session.photos.map((p) => p.id)).toEqual([a.id, c.id]);
      expect(s.session.selectedId).toBe(c.id);
      expect(s.session.annotations[b.id]).toBeUndefined();
      expect(s.session.pending.t1).toMatchObject({ photo: b, index: 1 });
      expect(s.session.pending.t1?.annotations.items).toHaveLength(1);
    });

    it('selects the previous photo when the last one is deleted', () => {
      const [a, b] = [makePhoto(), makePhoto()];
      const s = appReducer(makeAppState([a, b], { selectedId: b.id }), {
        type: 'DELETE_PHOTO',
        photoId: b.id,
        token: 't',
      });
      expect(s.session.selectedId).toBe(a.id);
    });

    it('returns to the camera when no photos remain', () => {
      const a = makePhoto();
      const s = appReducer(makeAppState([a], { step: 'annotate' }), {
        type: 'DELETE_PHOTO',
        photoId: a.id,
        token: 't',
      });
      expect(s.step).toBe('camera');
      expect(s.session.selectedId).toBeNull();
    });

    it('undo restores the photo and its annotations at the original index and selects it', () => {
      const [a, b, c] = [makePhoto(), makePhoto(), makePhoto()];
      let s = makeAppState([a, b, c], { annotations: { [b.id]: withBox(b.id) } });
      s = appReducer(s, { type: 'DELETE_PHOTO', photoId: b.id, token: 't' });
      s = appReducer(s, { type: 'UNDO_DELETE_PHOTO', token: 't' });
      expect(s.session.photos.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
      expect(s.session.selectedId).toBe(b.id);
      expect(s.session.annotations[b.id]?.items).toHaveLength(1);
      expect(s.session.pending).toEqual({});
    });

    it('undo after the only photo was deleted returns to review', () => {
      const a = makePhoto();
      let s = appReducer(makeAppState([a]), { type: 'DELETE_PHOTO', photoId: a.id, token: 't' });
      s = appReducer(s, { type: 'UNDO_DELETE_PHOTO', token: 't' });
      expect(s.step).toBe('review');
    });

    it('undo is refused when the session is full again, or the token is unknown', () => {
      const photos = Array.from({ length: SESSION_MAX_PHOTOS }, () => makePhoto({ byteSize: 10 }));
      let s = appReducer(makeAppState(photos), { type: 'DELETE_PHOTO', photoId: photos[0]!.id, token: 't' });
      s = appReducer(s, { type: 'PHOTOS_ADDED', photos: [makePhoto({ byteSize: 10 })] });
      expect(appReducer(s, { type: 'UNDO_DELETE_PHOTO', token: 't' })).toBe(s);
      expect(appReducer(s, { type: 'UNDO_DELETE_PHOTO', token: 'nope' })).toBe(s);
    });

    it('FINALIZE_DELETE drops the pending entry', () => {
      const [a, b] = [makePhoto(), makePhoto()];
      let s = appReducer(makeAppState([a, b]), { type: 'DELETE_PHOTO', photoId: a.id, token: 't' });
      s = appReducer(s, { type: 'FINALIZE_DELETE', token: 't' });
      expect(s.session.pending).toEqual({});
      expect(appReducer(s, { type: 'FINALIZE_DELETE', token: 't' })).toBe(s);
    });
  });

  it('START_OVER and RESET return the initial state', () => {
    const s = makeAppState([makePhoto(), makePhoto()], { step: 'annotate' });
    expect(appReducer(s, { type: 'START_OVER' })).toEqual(initialAppState);
    expect(appReducer(s, { type: 'RESET' })).toEqual(initialAppState);
  });

  it('GO requires photos for review/annotate; camera is always allowed and keeps the session', () => {
    expect(appReducer(initialAppState, { type: 'GO', step: 'review' })).toBe(initialAppState);
    const s = makeAppState([makePhoto()]);
    expect(appReducer(s, { type: 'GO', step: 'annotate' }).step).toBe('annotate');
    const cam = appReducer(s, { type: 'GO', step: 'camera' });
    expect(cam.step).toBe('camera');
    expect(cam.session).toBe(s.session);
  });

  describe('ANNOTATION routing', () => {
    it('applies the action to that photo only', () => {
      const [a, b] = [makePhoto(), makePhoto()];
      const s = appReducer(makeAppState([a, b]), {
        type: 'ANNOTATION',
        photoId: b.id,
        action: { type: 'CREATE', id: 'x', rect, createdAt: 1 },
      });
      expect(s.session.annotations[b.id]?.items).toHaveLength(1);
      expect(s.session.annotations[a.id]?.items).toHaveLength(0);
    });

    it('is a no-op for unknown photos and unchanged slices', () => {
      const s: AppState = makeAppState([makePhoto()]);
      expect(
        appReducer(s, { type: 'ANNOTATION', photoId: 'nope', action: { type: 'SELECT', id: null } }),
      ).toBe(s);
      const id = s.session.photos[0]!.id;
      expect(appReducer(s, { type: 'ANNOTATION', photoId: id, action: { type: 'SELECT', id: null } })).toBe(
        s,
      );
    });
  });
});
