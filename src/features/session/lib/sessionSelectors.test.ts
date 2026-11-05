import { describe, expect, it } from 'vitest';
import { annotationReducer, initialAnnotationState } from '@/features/annotation/lib/annotationReducer';
import { makeAppState, makePhoto } from '../../../../tests/fakes/appState';
import { SESSION_MAX_BYTES, SESSION_MAX_PHOTOS } from './limits';
import {
  admit,
  annotationCount,
  fullReason,
  heldBytes,
  remainingSlots,
  selectedPhoto,
  totalAnnotations,
} from './sessionSelectors';

const box = (id: string, n: number) => {
  let s = initialAnnotationState(id);
  for (let i = 0; i < n; i++)
    s = annotationReducer(s, {
      type: 'CREATE',
      id: `${id}-${i}`,
      rect: { x: 0, y: 0, width: 50, height: 50 },
      createdAt: i,
    });
  return s;
};

describe('session selectors', () => {
  it('heldBytes counts live photos plus pending deletions', () => {
    const [a, b] = [makePhoto({ byteSize: 100 }), makePhoto({ byteSize: 50 })];
    const s = makeAppState([a]).session;
    expect(heldBytes(s)).toBe(100);
    expect(
      heldBytes({
        ...s,
        pending: { t: { token: 't', photo: b, index: 1, annotations: initialAnnotationState(b.id) } },
      }),
    ).toBe(150);
  });

  it('fullReason reports count, memory, or null', () => {
    expect(fullReason(makeAppState([makePhoto()]).session)).toBeNull();
    const twenty = Array.from({ length: SESSION_MAX_PHOTOS }, () => makePhoto({ byteSize: 1 }));
    expect(fullReason(makeAppState(twenty).session)).toBe('count');
    expect(fullReason(makeAppState([makePhoto({ byteSize: SESSION_MAX_BYTES })]).session)).toBe('memory');
  });

  it('counts annotations per photo and in total; finds the selected photo; remaining slots', () => {
    const [a, b] = [makePhoto(), makePhoto()];
    const s = makeAppState([a, b], {
      selectedId: b.id,
      annotations: { [a.id]: box(a.id, 2), [b.id]: box(b.id, 1) },
    }).session;
    expect(annotationCount(s, a.id)).toBe(2);
    expect(annotationCount(s, 'nope')).toBe(0);
    expect(totalAnnotations(s)).toBe(3);
    expect(selectedPhoto(s)).toBe(b);
    expect(remainingSlots(s)).toBe(SESSION_MAX_PHOTOS - 2);
  });

  it('admit accepts what fits and reports why the rest was rejected', () => {
    const s = makeAppState(
      Array.from({ length: SESSION_MAX_PHOTOS - 1 }, () => makePhoto({ byteSize: 1 })),
    ).session;
    expect(admit(s, [{ byteSize: 1 }, { byteSize: 1 }])).toEqual({
      accepted: 1,
      rejected: 1,
      reason: 'count',
    });
    const m = makeAppState([makePhoto({ byteSize: SESSION_MAX_BYTES - 5 })]).session;
    expect(admit(m, [{ byteSize: 3 }, { byteSize: 3 }])).toEqual({
      accepted: 1,
      rejected: 1,
      reason: 'memory',
    });
    expect(admit(m, [])).toEqual({ accepted: 0, rejected: 0, reason: null });
  });
});
