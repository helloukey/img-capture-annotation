import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/shared/ui/Tooltip';
import { Toaster } from '@/shared/ui/Toaster';
import { FakeTrack } from '../../../../tests/fakes/fakeTrack';
import { TorchToggle } from './TorchToggle';

function renderToggle(track: FakeTrack | null) {
  return render(
    <TooltipProvider>
      <TorchToggle track={track as unknown as MediaStreamTrack | null} />
      <Toaster />
    </TooltipProvider>,
  );
}

describe('TorchToggle', () => {
  it('is disabled with an explanation when unsupported', () => {
    renderToggle(new FakeTrack());
    const btn = screen.getByRole('button', { name: /Torch/ });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Flash isn.t supported on this device or browser/)).toBeInTheDocument();
  });

  it('aria-pressed reflects the confirmed hardware state', async () => {
    const user = userEvent.setup();
    renderToggle(new FakeTrack({ capabilities: { torch: true } }));
    const btn = screen.getByRole('button', { name: 'Torch' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows busy while pending', async () => {
    let release!: () => void;
    const track = new FakeTrack({
      capabilities: { torch: true },
      applyConstraints: () => new Promise<void>((r) => (release = r)),
    });
    const user = userEvent.setup();
    renderToggle(track);
    await user.click(screen.getByRole('button', { name: 'Torch' }));
    expect(screen.getByRole('button', { name: 'Torch' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => release());
  });

  it('shows a toast when the torch cannot be turned on', async () => {
    const user = userEvent.setup();
    renderToggle(
      new FakeTrack({
        capabilities: { torch: true },
        applyConstraints: async () => {
          throw new Error('fail');
        },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Torch' }));
    expect(await screen.findByText(/Couldn.t turn on the flash/)).toBeInTheDocument();
  });
});
