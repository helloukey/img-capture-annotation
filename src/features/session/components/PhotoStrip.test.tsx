import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makePhoto } from '../../../../tests/fakes/appState';
import { PhotoStrip } from './PhotoStrip';

const photos = [
  makePhoto(),
  makePhoto({ captureMethod: 'burst', burstId: 'b1', burstIndex: 1 }),
  makePhoto(),
];

function renderStrip(props: Partial<Parameters<typeof PhotoStrip>[0]> = {}) {
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  render(
    <PhotoStrip
      photos={photos}
      selectedId={photos[0]!.id}
      onSelect={onSelect}
      onDelete={onDelete}
      annotationCounts={{ [photos[0]!.id]: 2 }}
      verdicts={{ [photos[1]!.id]: 'fair' }}
      {...props}
    />,
  );
  return { onSelect, onDelete };
}

describe('PhotoStrip', () => {
  it('renders nothing for fewer than 2 photos', () => {
    const { container } = render(
      <PhotoStrip photos={[photos[0]!]} selectedId={photos[0]!.id} onSelect={() => {}} onDelete={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('gives each item aria-pressed and a descriptive accessible name', () => {
    renderStrip();
    expect(
      screen.getByRole('button', { name: 'Photo 1 of 3, quality pending, 2 annotations' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Photo 2 of 3, Fair quality, 0 annotations, burst photo' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('uses a roving tabindex and arrow keys to move focus', () => {
    renderStrip();
    const items = screen.getAllByRole('button');
    expect(items.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    items[0]!.focus();
    fireEvent.keyDown(items[0]!, { key: 'ArrowRight' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1]!, { key: 'ArrowLeft' });
    expect(items[0]).toHaveFocus();
  });

  it('selects on click / Enter and deletes the focused photo with Delete or Backspace', async () => {
    const user = userEvent.setup();
    const { onSelect, onDelete } = renderStrip();
    await user.click(screen.getByRole('button', { name: /^Photo 3 of 3/ }));
    expect(onSelect).toHaveBeenCalledWith(photos[2]!.id);
    const second = screen.getByRole('button', { name: /^Photo 2 of 3/ });
    fireEvent.keyDown(second, { key: 'Delete' });
    fireEvent.keyDown(second, { key: 'Backspace' });
    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledWith(photos[1]!.id);
  });

  it('scrolls the selected item into view', () => {
    renderStrip({ selectedId: photos[2]!.id });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
