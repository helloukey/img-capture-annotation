import { describe, expect, it } from 'vitest';
import {
  annotationReducer,
  displayName,
  initialAnnotationState,
  LABEL_MAX_LENGTH,
  type AnnotationState,
} from './annotationReducer';

const rect = (x: number) => ({ x, y: 10, width: 50, height: 40 });

function withItems(n: number): AnnotationState {
  let s = initialAnnotationState('img');
  for (let i = 1; i <= n; i++)
    s = annotationReducer(s, { type: 'CREATE', id: `a${i}`, rect: rect(i * 100), createdAt: i });
  return s;
}

describe('annotationReducer', () => {
  it('CREATE adds and selects the item with the next ordinal', () => {
    const s = withItems(2);
    expect(s.items.map((a) => [a.id, a.ordinal])).toEqual([
      ['a1', 1],
      ['a2', 2],
    ]);
    expect(s.selectedId).toBe('a2');
    expect(s.items[0]).toMatchObject({ label: '', x: 100, y: 10, width: 50, height: 40, createdAt: 1 });
  });

  it('never reuses an ordinal after deletion', () => {
    let s = withItems(2);
    s = annotationReducer(s, { type: 'DELETE', id: 'a2' });
    s = annotationReducer(s, { type: 'CREATE', id: 'a3', rect: rect(0), createdAt: 3 });
    expect(s.items.at(-1)?.ordinal).toBe(3);
  });

  it('UPDATE_RECT replaces geometry', () => {
    const s = annotationReducer(withItems(1), {
      type: 'UPDATE_RECT',
      id: 'a1',
      rect: { x: 1, y: 2, width: 30, height: 40 },
    });
    expect(s.items[0]).toMatchObject({ x: 1, y: 2, width: 30, height: 40 });
  });

  it(`RENAME trims and limits labels to ${LABEL_MAX_LENGTH} characters`, () => {
    const s = annotationReducer(withItems(1), { type: 'RENAME', id: 'a1', label: `  ${'x'.repeat(60)}  ` });
    expect(s.items[0]?.label).toHaveLength(50);
    const t = annotationReducer(withItems(1), { type: 'RENAME', id: 'a1', label: '  Bottle ' });
    expect(t.items[0]?.label).toBe('Bottle');
  });

  it('returns the identical state for unknown ids', () => {
    const s = withItems(1);
    expect(annotationReducer(s, { type: 'RENAME', id: 'nope', label: 'x' })).toBe(s);
    expect(annotationReducer(s, { type: 'UPDATE_RECT', id: 'nope', rect: rect(1) })).toBe(s);
    expect(annotationReducer(s, { type: 'DELETE', id: 'nope' })).toBe(s);
    expect(annotationReducer(s, { type: 'SELECT', id: 'nope' })).toBe(s);
  });

  it('DELETE of the selected item clears selection and records lastDeleted', () => {
    const s = annotationReducer(withItems(2), { type: 'DELETE', id: 'a2' });
    expect(s.items.map((a) => a.id)).toEqual(['a1']);
    expect(s.selectedId).toBeNull();
    expect(s.lastDeleted?.entries).toEqual([{ index: 1, item: expect.objectContaining({ id: 'a2' }) }]);
  });

  it('UNDO_DELETE restores at the original index', () => {
    let s = annotationReducer(withItems(3), { type: 'DELETE', id: 'a2' });
    s = annotationReducer(s, { type: 'UNDO_DELETE' });
    expect(s.items.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(s.lastDeleted).toBeNull();
  });

  it('CLEAR_ALL then UNDO_DELETE restores everything in order', () => {
    let s = annotationReducer(withItems(3), { type: 'CLEAR_ALL' });
    expect(s.items).toEqual([]);
    s = annotationReducer(s, { type: 'UNDO_DELETE' });
    expect(s.items.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('UNDO_DELETE with a stale token does nothing (a newer delete replaced it)', () => {
    let s = annotationReducer(withItems(3), { type: 'DELETE', id: 'a1' });
    const firstToken = s.lastDeleted!.token;
    s = annotationReducer(s, { type: 'DELETE', id: 'a2' });
    expect(annotationReducer(s, { type: 'UNDO_DELETE', token: firstToken })).toBe(s);
  });

  it('UNDO_DELETE without lastDeleted is a no-op', () => {
    const s = withItems(1);
    expect(annotationReducer(s, { type: 'UNDO_DELETE' })).toBe(s);
  });

  it('DISMISS_UNDO clears lastDeleted for the matching token only', () => {
    const s = annotationReducer(withItems(2), { type: 'DELETE', id: 'a1' });
    expect(annotationReducer(s, { type: 'DISMISS_UNDO', token: 'other' })).toBe(s);
    expect(
      annotationReducer(s, { type: 'DISMISS_UNDO', token: s.lastDeleted!.token }).lastDeleted,
    ).toBeNull();
  });

  it('SELECT null deselects', () => {
    expect(annotationReducer(withItems(1), { type: 'SELECT', id: null }).selectedId).toBeNull();
  });

  it('RESET starts fresh for a new image', () => {
    expect(annotationReducer(withItems(2), { type: 'RESET', imageId: 'img-2' })).toEqual(
      initialAnnotationState('img-2'),
    );
  });

  it('displayName falls back to "Untitled {ordinal}"', () => {
    const s = withItems(2);
    expect(displayName(s.items[1]!)).toBe('Untitled 2');
    expect(displayName({ ...s.items[1]!, label: 'Cup' })).toBe('Cup');
  });
});
