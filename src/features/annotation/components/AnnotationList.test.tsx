import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Toaster } from '@/shared/ui/Toaster';
import { useAnnotations } from '../hooks/useAnnotations';
import { annotationReducer, initialAnnotationState, type AnnotationState } from '../lib/annotationReducer';
import { AnnotationProvider } from '../state/AnnotationProvider';
import { AnnotationList } from './AnnotationList';

function seeded(n: number): AnnotationState {
  let s = initialAnnotationState('img');
  for (let i = 1; i <= n; i++)
    s = annotationReducer(s, {
      type: 'CREATE',
      id: `a${i}`,
      rect: { x: i, y: i, width: 50, height: 50 },
      createdAt: i,
    });
  s = annotationReducer(s, { type: 'RENAME', id: 'a2', label: 'Cup' });
  return annotationReducer(s, { type: 'SELECT', id: null });
}

/** Mirrors canvas selection so we can assert the two stay in sync. */
function SelectionProbe() {
  const { state, select } = useAnnotations();
  return (
    <div>
      <output data-testid="selected">{state.selectedId ?? 'none'}</output>
      <button type="button" onClick={() => select('a3')}>
        select-on-canvas
      </button>
    </div>
  );
}

function renderList(state: AnnotationState) {
  return render(
    <AnnotationProvider imageId="img" initialState={state}>
      <AnnotationList />
      <SelectionProbe />
      <Toaster />
    </AnnotationProvider>,
  );
}

const rows = () => within(screen.getByRole('list', { name: 'Annotations' })).queryAllByRole('listitem');
const selectBtn = (row: HTMLElement) => within(row).getByRole('button', { name: /^Select / });

describe('AnnotationList', () => {
  it('lists annotations in creation order with defaults and a count', () => {
    renderList(seeded(3));
    expect(screen.getByRole('heading', { name: /3 annotations/ })).toBeInTheDocument();
    expect(
      rows().map(
        (r) =>
          within(r).getByRole('textbox').getAttribute('value') ||
          within(r).getByRole('textbox').getAttribute('placeholder'),
      ),
    ).toEqual(['Untitled 1', 'Cup', 'Untitled 3']);
  });

  it('selection is synchronized both ways', async () => {
    const user = userEvent.setup();
    renderList(seeded(3));
    await user.click(within(rows()[1]!).getByRole('button', { name: /Select Cup/ }));
    expect(screen.getByTestId('selected')).toHaveTextContent('a2');
    expect(selectBtn(rows()[1]!)).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'select-on-canvas' }));
    expect(selectBtn(rows()[2]!)).toHaveAttribute('aria-pressed', 'true');
    expect(selectBtn(rows()[1]!)).toHaveAttribute('aria-pressed', 'false');
  });

  it('renames inline (50 char limit)', async () => {
    const user = userEvent.setup();
    renderList(seeded(2));
    const input = within(rows()[0]!).getByRole('textbox');
    expect(input).toHaveAttribute('maxLength', '50');
    await user.click(input);
    await user.type(input, 'Bottle{Enter}');
    expect(within(rows()[0]!).getByRole('textbox')).toHaveValue('Bottle');
  });

  it('deletes from the row with an undo toast', async () => {
    const user = userEvent.setup();
    renderList(seeded(2));
    await user.click(within(rows()[1]!).getByRole('button', { name: 'Delete Cup' }));
    expect(rows()).toHaveLength(1);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(rows()).toHaveLength(2);
  });

  it('Clear all asks for confirmation; cancel keeps everything', async () => {
    const user = userEvent.setup();
    renderList(seeded(3));
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('dialog', { name: /Clear all annotations/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rows()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await user.click(screen.getByRole('button', { name: 'Clear all annotations' }));
    expect(screen.queryByRole('list', { name: 'Annotations' })).not.toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderList(initialAnnotationState('img'));
    expect(screen.getByText('Drag on the photo to draw your first box')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  });
});
