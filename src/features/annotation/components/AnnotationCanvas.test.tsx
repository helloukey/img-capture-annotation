import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '@/app/AppContext';
import { makeAppState, makePhoto } from '../../../../tests/fakes/appState';
import { Toaster } from '@/shared/ui/Toaster';
import { AnnotationProvider } from '../state/AnnotationProvider';
import { AnnotateView } from './AnnotateView';

// 4000×3000 photo displayed at 400×300 → 0.1 CSS px per image px; min box = 24 CSS px = 240 image px.
const image = makePhoto({ id: 'img', objectUrl: 'blob:img', width: 4000, height: 3000 });
const DISPLAY = { left: 0, top: 0, width: 400, height: 300 };

beforeEach(() => {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.tagName.toLowerCase() === 'svg') {
      return {
        ...DISPLAY,
        x: 0,
        y: 0,
        right: DISPLAY.width,
        bottom: DISPLAY.height,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return original.call(this);
  });
});

function renderAnnotate() {
  render(
    <AppProvider initialState={makeAppState([image], { step: 'annotate' })}>
      <AnnotationProvider>
        <AnnotateView image={image} />
      </AnnotationProvider>
      <Toaster />
    </AppProvider>,
  );
  return screen.getByTestId('annotation-surface');
}

type Pt = [number, number];
function drag(target: Element, from: Pt, to: Pt, pointerId = 1) {
  const surface = screen.getByTestId('annotation-surface');
  fireEvent.pointerDown(target, {
    clientX: from[0],
    clientY: from[1],
    pointerId,
    button: 0,
    pointerType: 'mouse',
  });
  fireEvent.pointerMove(surface, {
    clientX: (from[0] + to[0]) / 2,
    clientY: (from[1] + to[1]) / 2,
    pointerId,
  });
  fireEvent.pointerMove(surface, { clientX: to[0], clientY: to[1], pointerId });
  fireEvent.pointerUp(surface, { clientX: to[0], clientY: to[1], pointerId });
}

function boxRect(name: string) {
  const g = screen.getByRole('button', { name: `Annotation ${name}` });
  const r = g.querySelector('rect')!;
  return ['x', 'y', 'width', 'height'].map((k) => Number(r.getAttribute(k)));
}

function handle(h: string) {
  return document.querySelector(`[data-handle="${h}"] rect`)!;
}

describe('AnnotationCanvas', () => {
  it('drawing on an empty area creates a box in image pixels', () => {
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    expect(boxRect('Untitled 1')).toEqual([400, 300, 1000, 1000]);
    expect(screen.getByRole('button', { name: 'Annotation Untitled 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('a tap creates nothing, and a tap on empty space deselects', () => {
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    fireEvent.pointerDown(surface, { clientX: 300, clientY: 250, pointerId: 2 });
    fireEvent.pointerUp(surface, { clientX: 300, clientY: 250, pointerId: 2 });
    expect(screen.getAllByRole('button', { name: /^Annotation / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Annotation Untitled 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('a second box can be drawn right after the first, with no mode switch', () => {
    const surface = renderAnnotate();
    drag(surface, [10, 10], [60, 60]);
    drag(surface, [200, 150], [300, 250]);
    expect(boxRect('Untitled 2')).toEqual([2000, 1500, 1000, 1000]);
  });

  it('dragging a box moves it, clamped to the image', () => {
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    const body = screen.getByRole('button', { name: 'Annotation Untitled 1' }).querySelector('rect')!;
    drag(body, [60, 50], [160, 150]);
    expect(boxRect('Untitled 1')).toEqual([1400, 1300, 1000, 1000]);
    drag(body, [160, 150], [990, 990]);
    expect(boxRect('Untitled 1')).toEqual([3000, 2000, 1000, 1000]);
  });

  it('resizes from the se corner and the n edge', () => {
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    drag(handle('se'), [140, 130], [200, 200]);
    expect(boxRect('Untitled 1')).toEqual([400, 300, 1600, 1700]);
    drag(handle('n'), [120, 30], [120, 10]);
    expect(boxRect('Untitled 1')).toEqual([400, 100, 1600, 1900]);
  });

  it('a second pointer cancels the gesture and restores the box', () => {
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    const body = screen.getByRole('button', { name: 'Annotation Untitled 1' }).querySelector('rect')!;
    fireEvent.pointerDown(body, { clientX: 60, clientY: 50, pointerId: 5 });
    fireEvent.pointerMove(surface, { clientX: 120, clientY: 110, pointerId: 5 });
    expect(boxRect('Untitled 1')[0]).toBe(1000); // live preview while dragging
    fireEvent.pointerDown(surface, { clientX: 300, clientY: 200, pointerId: 6 });
    expect(boxRect('Untitled 1')).toEqual([400, 300, 1000, 1000]);
    fireEvent.pointerUp(surface, { clientX: 120, clientY: 110, pointerId: 5 });
    fireEvent.pointerUp(surface, { clientX: 300, clientY: 200, pointerId: 6 });
    expect(boxRect('Untitled 1')).toEqual([400, 300, 1000, 1000]);
    expect(screen.getAllByRole('button', { name: /^Annotation / })).toHaveLength(1);
  });

  it('a box at the 24px minimum gets outside corner handles and its body can still be dragged', () => {
    const surface = renderAnnotate();
    drag(surface, [300, 200], [330, 230]); // 30 CSS px
    expect(document.querySelectorAll('[data-handle]')).toHaveLength(4);
    const body = screen.getByRole('button', { name: 'Annotation Untitled 1' }).querySelector('rect')!;
    drag(body, [315, 215], [215, 115]);
    expect(boxRect('Untitled 1')).toEqual([2000, 1000, 300, 300]);
  });

  it('a drag smaller than the minimum is treated as a tap', () => {
    const surface = renderAnnotate();
    drag(surface, [40, 30], [50, 40]); // 10 CSS px < 24
    expect(screen.queryAllByRole('button', { name: /^Annotation / })).toHaveLength(0);
  });

  it('Delete removes the selected box and Undo restores it', async () => {
    const user = userEvent.setup();
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    fireEvent.keyDown(surface, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: 'Annotation Untitled 1' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Annotation Untitled 1' })).toBeInTheDocument();
  });

  it('Escape deselects', () => {
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Annotation Untitled 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('labels the selected box (max 50 chars); Backspace in the input never deletes the box', async () => {
    const user = userEvent.setup();
    const surface = renderAnnotate();
    drag(surface, [40, 30], [140, 130]);
    const input = screen.getByRole('textbox', { name: 'Label' });
    expect(input).toHaveAttribute('maxLength', '50');
    await user.click(input);
    await user.type(input, 'Bottlex{Backspace}{Enter}');
    expect(screen.getByRole('button', { name: 'Annotation Bottle' })).toBeInTheDocument();
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'Backspace' });
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(screen.getByRole('button', { name: 'Annotation Bottle' })).toBeInTheDocument();
  });
});
