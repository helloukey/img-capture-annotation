import type { CapturedImage } from '@/shared/types';

export type AppStep = 'camera' | 'review' | 'annotate';

export interface AppFlowState {
  step: AppStep;
  image: CapturedImage | null;
  /** Set when leaving the photo would discard annotations (FR-028). */
  pendingConfirm: 'retake' | null;
  /** Mirrored from the annotation store so the flow can guard destructive transitions. */
  annotationCount: number;
}

export type AppFlowAction =
  | { type: 'CAPTURED'; image: CapturedImage }
  | { type: 'UPLOADED'; image: CapturedImage }
  | { type: 'RETAKE' }
  | { type: 'ACCEPT' }
  | { type: 'BACK_TO_REVIEW' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'SET_ANNOTATION_COUNT'; count: number }
  | { type: 'RESET' };

export const initialAppFlowState: AppFlowState = {
  step: 'camera',
  image: null,
  pendingConfirm: null,
  annotationCount: 0,
};

/** Pure state machine for Capture → Review → Annotate (data-model.md §6). */
export function appFlowReducer(state: AppFlowState, action: AppFlowAction): AppFlowState {
  switch (action.type) {
    case 'CAPTURED':
    case 'UPLOADED':
      if (state.step !== 'camera') return state;
      return { ...initialAppFlowState, step: 'review', image: action.image };

    case 'RETAKE':
      if (state.step === 'camera') return state;
      if (state.annotationCount > 0) return { ...state, pendingConfirm: 'retake' };
      return initialAppFlowState;

    case 'ACCEPT':
      if (state.step !== 'review' || !state.image) return state;
      return { ...state, step: 'annotate' };

    case 'BACK_TO_REVIEW':
      if (state.step !== 'annotate') return state;
      return { ...state, step: 'review' };

    case 'CONFIRM':
      if (state.pendingConfirm !== 'retake') return state;
      return initialAppFlowState;

    case 'CANCEL':
      if (state.pendingConfirm === null) return state;
      return { ...state, pendingConfirm: null };

    case 'SET_ANNOTATION_COUNT':
      if (state.annotationCount === action.count) return state;
      return { ...state, annotationCount: action.count };

    case 'RESET':
      return initialAppFlowState;
  }
}
