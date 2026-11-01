import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeImageCapture } from '../../tests/fakes/fakeImageCapture';
import { installFakeMediaDevices } from '../../tests/fakes/fakeMediaDevices';
import { App } from './App';

function currentStep() {
  const nav = screen.getByRole('navigation', { name: 'Progress' });
  return within(nav).getByText((_, el) => el?.getAttribute('aria-current') === 'step').textContent;
}

describe('capture → review → retake → accept flow', () => {
  it('walks the full US1 loop', async () => {
    installFakeMediaDevices();
    installFakeImageCapture({ photoWidth: 4032, photoHeight: 3024, delayMs: 30 });
    const user = userEvent.setup();
    render(<App />);

    const shutter = await screen.findByRole('button', { name: 'Capture photo' });
    await waitFor(() => expect(shutter).toBeEnabled());
    expect(currentStep()).toContain('Capture');

    await user.click(shutter);
    expect(screen.getByTestId('shutter-flash')).toBeInTheDocument();
    const photo = await screen.findByRole('img', { name: 'Your capture' });
    expect(photo).toHaveAttribute('src', expect.stringMatching(/^blob:/));
    expect(currentStep()).toContain('Review');

    await user.click(screen.getByRole('button', { name: /Retake/ }));
    expect(await screen.findByRole('button', { name: 'Capture photo' })).toBeInTheDocument();
    expect(currentStep()).toContain('Capture');

    const shutter2 = screen.getByRole('button', { name: 'Capture photo' });
    await waitFor(() => expect(shutter2).toBeEnabled());
    await user.click(shutter2);
    await screen.findByRole('img', { name: 'Your capture' });

    await user.click(screen.getByRole('button', { name: /Use Photo/ }));
    await waitFor(() => expect(currentStep()).toContain('Annotate'));
  });
});
