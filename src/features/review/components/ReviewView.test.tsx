import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppFlowProvider, useAppFlow } from '@/app/AppFlowContext';
import type { AppFlowState } from '@/app/appFlowReducer';
import type { CapturedImage } from '@/shared/types';
import { ReviewView } from './ReviewView';

const image = { id: 'i1', objectUrl: 'blob:x', width: 4000, height: 3000 } as CapturedImage;

function StepProbe() {
  const { state } = useAppFlow();
  return <output data-testid="step">{state.step}</output>;
}

function renderReview(initial: Partial<AppFlowState>, props: Partial<Parameters<typeof ReviewView>[0]> = {}) {
  const state: AppFlowState = { step: 'review', image, pendingConfirm: null, annotationCount: 0, ...initial };
  return render(
    <AppFlowProvider initialState={state}>
      <ReviewView image={image} {...props} />
      <StepProbe />
    </AppFlowProvider>,
  );
}

describe('ReviewView', () => {
  it('shows the full captured frame with Retake and Use Photo', () => {
    renderReview({});
    expect(screen.getByRole('img', { name: 'Your capture' })).toHaveAttribute('src', 'blob:x');
    expect(screen.getByRole('button', { name: /Retake/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Photo/ })).toBeInTheDocument();
  });

  it('asks before discarding annotations when retaking after Back to review (FR-028)', async () => {
    const user = userEvent.setup();
    renderReview({ annotationCount: 2 });
    await user.click(screen.getByRole('button', { name: /Retake/ }));
    expect(screen.getByRole('dialog', { name: 'Discard annotations?' })).toHaveTextContent('2 annotations');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('step')).toHaveTextContent('review');

    await user.click(screen.getByRole('button', { name: /Retake/ }));
    await user.click(screen.getByRole('button', { name: 'Discard and retake' }));
    expect(screen.getByTestId('step')).toHaveTextContent('camera');
  });

  it('emphasizes Retake and relabels continue as "Use anyway" when quality is poor', () => {
    renderReview({}, { poorQuality: true });
    expect(screen.getByRole('button', { name: /Use anyway/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retake/ }).className).toMatch(/ring-2/);
  });
});
