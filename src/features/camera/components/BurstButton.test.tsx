import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '@/app/AppContext';
import { SESSION_MAX_PHOTOS } from '@/features/session/lib/limits';
import { makeAppState, makePhoto } from '../../../../tests/fakes/appState';
import { CameraView } from './CameraView';

const fakeCamera = {
  status: 'live',
  error: null,
  videoRef: () => {},
  track: null,
  resolution: { width: 1920, height: 1080 },
  devices: [],
  activeDeviceId: null,
  facingMode: 'environment',
  canSwitchCamera: false,
  start: vi.fn(),
  stop: vi.fn(),
  retry: vi.fn(),
  switchCamera: vi.fn(),
  capture: vi.fn(async () => makePhoto()),
  captureFrame: vi.fn(async () => makePhoto({ captureMethod: 'burst' })),
};
vi.mock('../hooks/useCamera', () => ({ useCamera: () => fakeCamera }));

function Count() {
  return <output data-testid="count">{useApp().state.session.photos.length}</output>;
}

function renderCamera(photos: ReturnType<typeof makePhoto>[] = []) {
  render(
    <AppProvider initialState={makeAppState(photos, { step: 'camera' })}>
      <CameraView />
      <Count />
    </AppProvider>,
  );
  return screen.getByRole('button', { name: 'Take a burst of photos, up to 3 seconds' });
}

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }));
afterEach(() => vi.useRealTimers());

describe('Burst button (US5, FR-028/FR-029)', () => {
  it('has an explanatory accessible name and starts/stops a burst on activation', async () => {
    const button = renderCamera();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    // A native <button>: Enter/Space activate it through the same click handler.
    fireEvent.click(button);
    await advance(700);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    await advance(50);
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('status').some((el) => /^Burst: \d+ photos/.test(el.textContent ?? ''))).toBe(true);
  });

  it('stops by itself at the 3 s limit', async () => {
    const button = renderCamera();
    fireEvent.click(button);
    await advance(3500);
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThanOrEqual(5);
  });

  it('is disabled when the session is full', () => {
    const button = renderCamera(
      Array.from({ length: SESSION_MAX_PHOTOS }, () => makePhoto({ byteSize: 10 })),
    );
    expect(button).toBeDisabled();
  });
});
