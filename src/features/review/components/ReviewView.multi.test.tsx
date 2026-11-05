import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppProvider, useApp } from '@/app/AppContext';
import { annotationReducer, initialAnnotationState } from '@/features/annotation/lib/annotationReducer';
import { Toaster } from '@/shared/ui/Toaster';
import { makeAppState, makePhoto } from '../../../../tests/fakes/appState';
import { ReviewView } from './ReviewView';

const photos = [1, 2, 3, 4].map((i) => makePhoto({ id: `p${i}`, objectUrl: `blob:p${i}` }));
const boxed = (id: string, n: number) => {
  let s = initialAnnotationState(id);
  for (let i = 0; i < n; i++)
    s = annotationReducer(s, {
      type: 'CREATE',
      id: `${id}-${i}`,
      rect: { x: 0, y: 0, width: 60, height: 60 },
      createdAt: i,
    });
  return s;
};

function Screen() {
  const { state } = useApp();
  const selected = state.session.photos.find((p) => p.id === state.session.selectedId);
  return (
    <>
      {selected && state.step === 'review' && <ReviewView image={selected} />}
      <output data-testid="step">{state.step}</output>
      <output data-testid="ids">{state.session.photos.map((p) => p.id).join(',')}</output>
    </>
  );
}

function renderMulti(list = photos, annotations: Record<string, ReturnType<typeof boxed>> = {}) {
  return render(
    <AppProvider initialState={makeAppState(list, { annotations })}>
      <Screen />
      <Toaster />
    </AppProvider>,
  );
}

const ids = () => screen.getByTestId('ids').textContent;
const strip = () => screen.getByRole('toolbar', { name: /^Photos/ });

describe('ReviewView with several photos', () => {
  it('switches the large photo when a thumbnail is selected', async () => {
    const user = userEvent.setup();
    renderMulti();
    expect(screen.getByRole('img', { name: 'Your capture' })).toHaveAttribute('src', 'blob:p1');
    await user.click(within(strip()).getByRole('button', { name: /^Photo 3 of 4/ }));
    expect(screen.getByRole('img', { name: 'Your capture' })).toHaveAttribute('src', 'blob:p3');
  });

  it('deletes an unannotated photo at once, and Undo restores it at its index', async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(within(strip()).getByRole('button', { name: /^Photo 2 of 4/ }));
    await user.click(screen.getByRole('button', { name: 'Delete photo' }));
    expect(ids()).toBe('p1,p3,p4');
    expect(screen.getByRole('img', { name: 'Your capture' })).toHaveAttribute('src', 'blob:p3'); // next photo
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(ids()).toBe('p1,p2,p3,p4');
  });

  it('asks before deleting an annotated photo, naming the annotation count', async () => {
    const user = userEvent.setup();
    renderMulti(photos, { p1: boxed('p1', 2) });
    await user.click(screen.getByRole('button', { name: 'Delete photo' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this photo?' });
    expect(dialog).toHaveTextContent('2 annotations');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(ids()).toBe('p1,p2,p3,p4');
    await user.click(screen.getByRole('button', { name: 'Delete photo' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete photo' }));
    expect(ids()).toBe('p2,p3,p4');
  });

  it('deleting the last photo selects the previous one', async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(within(strip()).getByRole('button', { name: /^Photo 4 of 4/ }));
    await user.click(screen.getByRole('button', { name: 'Delete photo' }));
    expect(screen.getByRole('img', { name: 'Your capture' })).toHaveAttribute('src', 'blob:p3');
  });

  it('Add more goes to the camera and keeps the photos', async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole('button', { name: /Add more/ }));
    expect(screen.getByTestId('step')).toHaveTextContent('camera');
    expect(ids()).toBe('p1,p2,p3,p4');
  });

  it('Start over always asks first; cancel keeps everything, confirm clears it', async () => {
    const user = userEvent.setup();
    renderMulti(photos, { p2: boxed('p2', 1) });
    await user.click(screen.getByRole('button', { name: /Start over/ }));
    const dialog = screen.getByRole('dialog', { name: 'Discard all 4 photos?' });
    expect(dialog).toHaveTextContent('1 annotation');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(ids()).toBe('p1,p2,p3,p4');
    await user.click(screen.getByRole('button', { name: /Start over/ }));
    await user.click(screen.getByRole('button', { name: 'Discard all' }));
    expect(ids()).toBe('');
    expect(screen.getByTestId('step')).toHaveTextContent('camera');
  });

  it('Start over asks even without annotations (constitution V)', async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole('button', { name: /Start over/ }));
    expect(screen.getByRole('dialog', { name: 'Discard all 4 photos?' })).toBeInTheDocument();
  });

  it('Continue to annotate opens Annotate on the selected photo', async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole('button', { name: /Continue to annotate/ }));
    expect(screen.getByTestId('step')).toHaveTextContent('annotate');
  });
});

describe('ReviewView with one photo (FR-032)', () => {
  it('keeps Retake and Use Photo, hides the strip, and adds an "Add more" link', () => {
    renderMulti([photos[0]!]);
    expect(screen.getByRole('button', { name: /Retake/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Photo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add more/ })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: /^Photos/ })).not.toBeInTheDocument();
  });

  it('deleting the only photo returns to the camera with Undo offered', async () => {
    const user = userEvent.setup();
    renderMulti([photos[0]!]);
    await user.click(screen.getByRole('button', { name: /Retake/ }));
    expect(screen.getByTestId('step')).toHaveTextContent('camera');
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
