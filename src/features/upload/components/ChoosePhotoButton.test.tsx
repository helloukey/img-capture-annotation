import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProvider, useApp } from '@/app/AppContext';
import { Toaster } from '@/shared/ui/Toaster';
import { brokenImageBlob, fakeImageBlob } from '../../../../tests/fakes/fakeImage';
import { makeAppState } from '../../../../tests/fakes/appState';
import { ChoosePhotoButton } from './ChoosePhotoButton';

function asFile(blob: Blob, name: string, type = blob.type) {
  const f = new File([blob], name, { type });
  Object.assign(f, {
    __width: (blob as { __width?: number }).__width,
    __height: (blob as { __height?: number }).__height,
  });
  Object.defineProperty(f, 'size', { value: blob.size });
  return f;
}

function Count() {
  return <output data-testid="count">{useApp().state.session.photos.length}</output>;
}

describe('ChoosePhotoButton with several files', () => {
  it('accepts multiple files, adds the readable images, and shows one summary toast', async () => {
    render(
      <AppProvider initialState={makeAppState([], { step: 'camera' })}>
        <ChoosePhotoButton />
        <Count />
        <Toaster />
      </AppProvider>,
    );
    const input = screen.getByTestId('choose-photo-input');
    expect(input).toHaveAttribute('multiple');
    fireEvent.change(input, {
      target: {
        files: [
          asFile(fakeImageBlob(3000, 2000, 1_000_000), 'a.jpg'),
          new File(['x'], 'notes.pdf', { type: 'application/pdf' }),
          asFile(brokenImageBlob(), 'broken.jpg'),
          asFile(fakeImageBlob(1600, 1200, 500_000), 'b.jpg'),
        ],
      },
    });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
    expect(
      await screen.findByText('2 added · 1 skipped: not an image · 1 skipped: couldn’t be opened'),
    ).toBeInTheDocument();
  });
});
