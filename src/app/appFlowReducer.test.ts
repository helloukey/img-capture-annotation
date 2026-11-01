import { describe, expect, it } from 'vitest';
import type { CapturedImage } from '@/shared/types';
import { appFlowReducer, initialAppFlowState, type AppFlowState } from './appFlowReducer';

const image = { id: 'img-1', objectUrl: 'blob:1', width: 4000, height: 3000 } as CapturedImage;
const other = { id: 'img-2', objectUrl: 'blob:2', width: 100, height: 100 } as CapturedImage;

const review: AppFlowState = { ...initialAppFlowState, step: 'review', image };
const annotate: AppFlowState = { ...review, step: 'annotate' };

describe('appFlowReducer', () => {
  it('starts on the camera step with no image', () => {
    expect(initialAppFlowState).toEqual({
      step: 'camera',
      image: null,
      pendingConfirm: null,
      annotationCount: 0,
    });
  });

  it('CAPTURED and UPLOADED move to review with the image', () => {
    expect(appFlowReducer(initialAppFlowState, { type: 'CAPTURED', image })).toMatchObject({
      step: 'review',
      image,
    });
    expect(appFlowReducer(initialAppFlowState, { type: 'UPLOADED', image })).toMatchObject({
      step: 'review',
      image,
    });
  });

  it('RETAKE from review without annotations returns to camera and drops the image', () => {
    expect(appFlowReducer(review, { type: 'RETAKE' })).toEqual(initialAppFlowState);
  });

  it('ACCEPT moves to annotate', () => {
    expect(appFlowReducer(review, { type: 'ACCEPT' }).step).toBe('annotate');
  });

  it('BACK_TO_REVIEW keeps the image and annotation count', () => {
    const s = appFlowReducer({ ...annotate, annotationCount: 3 }, { type: 'BACK_TO_REVIEW' });
    expect(s).toMatchObject({ step: 'review', image, annotationCount: 3 });
  });

  it('RETAKE from annotate with annotations asks for confirmation first', () => {
    const s = appFlowReducer({ ...annotate, annotationCount: 2 }, { type: 'RETAKE' });
    expect(s).toMatchObject({ step: 'annotate', pendingConfirm: 'retake', image });
  });

  it('RETAKE from review when annotations exist (after BACK_TO_REVIEW) asks for confirmation', () => {
    const s = appFlowReducer({ ...review, annotationCount: 1 }, { type: 'RETAKE' });
    expect(s).toMatchObject({ step: 'review', pendingConfirm: 'retake', image });
  });

  it('CONFIRM discards everything and returns to camera', () => {
    const pending: AppFlowState = { ...annotate, annotationCount: 2, pendingConfirm: 'retake' };
    expect(appFlowReducer(pending, { type: 'CONFIRM' })).toEqual(initialAppFlowState);
  });

  it('CANCEL keeps the image and annotations', () => {
    const pending: AppFlowState = { ...annotate, annotationCount: 2, pendingConfirm: 'retake' };
    expect(appFlowReducer(pending, { type: 'CANCEL' })).toEqual({ ...annotate, annotationCount: 2 });
  });

  it('CONFIRM without a pending confirmation is a no-op', () => {
    expect(appFlowReducer(review, { type: 'CONFIRM' })).toBe(review);
  });

  it('SET_ANNOTATION_COUNT updates the count', () => {
    expect(appFlowReducer(annotate, { type: 'SET_ANNOTATION_COUNT', count: 4 }).annotationCount).toBe(4);
  });

  it('ignores ACCEPT outside review and capture outside camera', () => {
    expect(appFlowReducer(initialAppFlowState, { type: 'ACCEPT' })).toBe(initialAppFlowState);
    expect(appFlowReducer(annotate, { type: 'CAPTURED', image: other })).toBe(annotate);
  });

  it('RESET clears everything from any step', () => {
    expect(appFlowReducer({ ...annotate, annotationCount: 5 }, { type: 'RESET' })).toEqual(
      initialAppFlowState,
    );
  });
});
