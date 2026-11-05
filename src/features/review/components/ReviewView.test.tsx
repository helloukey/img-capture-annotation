import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppProvider, useApp } from '@/app/AppContext';
import { annotationReducer, initialAnnotationState } from '@/features/annotation/lib/annotationReducer';
import { Toaster } from '@/shared/ui/Toaster';
import { makeAppState, makePhoto } from '../../../../tests/fakes/appState';
import { ReviewView } from './ReviewView';

const image = makePhoto({ id: 'i1', objectUrl: 'blob:x' });

function StepProbe() {
  const { state } = useApp();
  return <output data-testid="step">{state.step}</output>;
}

function withBoxes(n: number) {
  let s = initialAnnotationState(image.id);
  for (let i = 0; i < n; i++)
    s = annotationReducer(s, {
      type: 'CREATE',
      id: `a${i}`,
      rect: { x: 0, y: 0, width: 50, height: 50 },
      createdAt: i,
    });
  return s;
}

function renderReview(
  opts: { annotationCount?: number } = {},
  props: Partial<Parameters<typeof ReviewView>[0]> = {},
) {
  const state = makeAppState([image], { annotations: { [image.id]: withBoxes(opts.annotationCount ?? 0) } });
  return render(
    <AppProvider initialState={state}>
      <ReviewView image={image} {...props} />
      <StepProbe />
      <Toaster />
    </AppProvider>,
  );
}

describe('ReviewView', () => {
  it('shows the full captured frame with Retake and Use Photo', () => {
    renderReview();
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
