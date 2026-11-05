import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '@/app/AppContext';
import { Toaster } from '@/shared/ui/Toaster';
import { makeAppState, makePhoto } from '../../../../tests/fakes/appState';
import { AnnotationProvider } from '../state/AnnotationProvider';
import { AnnotateView } from './AnnotateView';

const A = makePhoto({ id: 'A', objectUrl: 'blob:A', width: 4000, height: 3000 });
const B = makePhoto({ id: 'B', objectUrl: 'blob:B', width: 1920, height: 1080 });
const DISPLAY = { left: 0, top: 0, width: 400, height: 300 };

beforeEach(() => {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.tagName.toLowerCase() === 'svg') {
      return { ...DISPLAY, x: 0, y: 0, right: 400, bottom: 300, toJSON: () => ({}) } as DOMRect;
    }
    return original.call(this);
  });
});

/** Renders Annotate for whichever photo is selected, like the real AnnotateScreen. */
function Screen() {
  const { state } = useApp();
  const selected = state.session.photos.find((p) => p.id === state.session.selectedId);
  return selected && state.step === 'annotate' ? (
    <AnnotateView image={selected} />
  ) : (
    <output data-testid="step">{state.step}</output>
  );
}

function renderMulti() {
  render(
    <AppProvider initialState={makeAppState([A, B], { step: 'annotate' })}>
      <AnnotationProvider>
        <Screen />
      </AnnotationProvider>
      <Toaster />
    </AppProvider>,
  );
}

type Pt = [number, number];
function drag(from: Pt, to: Pt, pointerId = 1) {
  const surface = screen.getByTestId('annotation-surface');
  fireEvent.pointerDown(surface, {
    clientX: from[0],
    clientY: from[1],
    pointerId,
    button: 0,
    pointerType: 'mouse',
  });
  fireEvent.pointerMove(surface, { clientX: to[0], clientY: to[1], pointerId });
  fireEvent.pointerUp(surface, { clientX: to[0], clientY: to[1], pointerId });
}
const boxes = () => screen.queryAllByRole('button', { name: /^Annotation / });
const rectOf = (name: string) =>
  ['x', 'y', 'width', 'height'].map((k) =>
    Number(
      screen
        .getByRole('button', { name: `Annotation ${name}` })
        .querySelector('rect')!
        .getAttribute(k),
    ),
  );
const strip = () => screen.getByRole('toolbar', { name: /^Photos/ });
const thumb = (n: number) => within(strip()).getByRole('button', { name: new RegExp(`^Photo ${n} of`) });

describe('Annotate with several photos (US3)', () => {
  it('keeps each photo’s boxes separate, in its own image pixels, and shows per-photo counts', async () => {
    const user = userEvent.setup();
    renderMulti();
    drag([40, 30], [140, 130]);
    drag([200, 150], [300, 250]);
    expect(boxes()).toHaveLength(2);

    await user.click(thumb(2));
    expect(screen.getByAltText('Your capture')).toHaveAttribute('src', 'blob:B');
    expect(boxes()).toHaveLength(0);
    drag([40, 30], [140, 130]);
    expect(rectOf('Untitled 1')).toEqual([192, 108, 480, 360]); // B's own pixel space

    await user.click(thumb(1));
    expect(boxes()).toHaveLength(2);
    expect(rectOf('Untitled 1')).toEqual([400, 300, 1000, 1000]);
    expect(thumb(1)).toHaveAccessibleName(/2 annotations/);
    expect(thumb(2)).toHaveAccessibleName(/1 annotation/);
  });

  it('Clear all on one photo leaves the other untouched', async () => {
    const user = userEvent.setup();
    renderMulti();
    drag([40, 30], [140, 130]);
    await user.click(thumb(2));
    drag([40, 30], [140, 130]);
    await user.click(screen.getByRole('button', { name: /^Annotations/ }));
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await user.click(screen.getByRole('button', { name: 'Clear all annotations' }));
    expect(boxes()).toHaveLength(0);
    await user.keyboard('{Escape}');
    await user.click(thumb(1));
    expect(boxes()).toHaveLength(1);
  });

  it('Undo after switching photos restores the box on the photo it came from', async () => {
    const user = userEvent.setup();
    renderMulti();
    drag([40, 30], [140, 130]);
    fireEvent.keyDown(screen.getByTestId('annotation-surface'), { key: 'Delete' });
    expect(boxes()).toHaveLength(0);
    await user.click(thumb(2));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(boxes()).toHaveLength(0); // not restored onto B
    await user.click(thumb(1));
    expect(boxes()).toHaveLength(1);
  });

  it('switching photos mid-drag cancels the drag', async () => {
    const user = userEvent.setup();
    renderMulti();
    const surface = screen.getByTestId('annotation-surface');
    fireEvent.pointerDown(surface, {
      clientX: 40,
      clientY: 30,
      pointerId: 7,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(surface, { clientX: 140, clientY: 130, pointerId: 7 });
    await user.click(thumb(2));
    fireEvent.pointerUp(screen.getByTestId('annotation-surface'), {
      clientX: 140,
      clientY: 130,
      pointerId: 7,
    });
    expect(boxes()).toHaveLength(0);
    await user.click(thumb(1));
    expect(boxes()).toHaveLength(0);
  });

  it('deleting an annotated photo from the strip asks first, then Undo restores it with its boxes', async () => {
    const user = userEvent.setup();
    renderMulti();
    drag([40, 30], [140, 130]);
    drag([200, 150], [300, 250]);
    thumb(1).focus();
    fireEvent.keyDown(thumb(1), { key: 'Delete' });
    const dialog = screen.getByRole('dialog', { name: 'Delete this photo?' });
    expect(dialog).toHaveTextContent('2 annotations');
    await user.click(within(dialog).getByRole('button', { name: 'Delete photo' }));
    expect(screen.getByAltText('Your capture')).toHaveAttribute('src', 'blob:B');
    expect(screen.queryByRole('toolbar', { name: /^Photos/ })).not.toBeInTheDocument(); // one photo left
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(screen.getByAltText('Your capture')).toHaveAttribute('src', 'blob:A');
    expect(boxes()).toHaveLength(2);
  });

  it('with several photos, the toolbar offers Start over (always confirmed) instead of Retake', async () => {
    const user = userEvent.setup();
    renderMulti();
    expect(screen.queryByRole('button', { name: 'Retake' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByRole('dialog', { name: 'Discard all 2 photos?' })).toBeInTheDocument();
  });
});
