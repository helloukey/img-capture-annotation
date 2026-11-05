import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '@/app/AppContext';
import { SESSION_MAX_BYTES, SESSION_MAX_PHOTOS, TAP_THRESHOLD_MS } from '@/features/session/lib/limits';
import { Toaster } from '@/shared/ui/Toaster';
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
  captureFrame: vi.fn(async () => makePhoto({ captureMethod: 'burst', byteSize: 2_000_000 })),
};
vi.mock('../hooks/useCamera', () => ({ useCamera: () => fakeCamera }));

function Probe() {
  const { state, dispatch } = useApp();
  return (
    <>
      <output data-testid="count">{state.session.photos.length}</output>
      <button
        type="button"
        onClick={() => dispatch({ type: 'DELETE_PHOTO', photoId: state.session.photos[0]!.id, token: 't' })}
      >
        delete-one
      </button>
    </>
  );
}

function renderCamera(
  photos = Array.from({ length: SESSION_MAX_PHOTOS }, () => makePhoto({ byteSize: 1000 })),
) {
  render(
    <AppProvider initialState={makeAppState(photos, { step: 'camera' })}>
      <CameraView />
      <Probe />
      <Toaster />
    </AppProvider>,
  );
  return screen.getByRole('button', { name: 'Capture photo' });
}

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
});
afterEach(() => vi.useRealTimers());

describe('CameraView session limits (US4)', () => {
  it('a full session disables the shutter with a visible explanation', () => {
    const shutter = renderCamera();
    expect(shutter).toBeDisabled();
    expect(screen.getByText('Session full (20 photos). Delete some photos to take more.')).toBeVisible();
    expect(shutter).toHaveAttribute('aria-describedby', 'session-full-message');
    expect(screen.getByRole('button', { name: 'Review photos' })).toBeInTheDocument();
  });

  it('deleting a photo enables the shutter again', async () => {
    const shutter = renderCamera();
    fireEvent.click(screen.getByRole('button', { name: 'delete-one' }));
    expect(shutter).toBeEnabled();
    expect(screen.queryByText(/Session full/)).not.toBeInTheDocument();
  });

  it('a burst near the limit stops when the session is full and says so', async () => {
    const shutter = renderCamera(
      Array.from({ length: SESSION_MAX_PHOTOS - 2 }, () => makePhoto({ byteSize: 1000 })),
    );
    fireEvent.pointerDown(shutter, { pointerId: 1, button: 0, pointerType: 'mouse' });
    await advance(TAP_THRESHOLD_MS + 2000);
    fireEvent.pointerUp(shutter, { pointerId: 1, pointerType: 'mouse' });
    await advance(50);
    expect(screen.getByTestId('count')).toHaveTextContent(String(SESSION_MAX_PHOTOS));
    expect(screen.getAllByText(/Session full \(20 photos\)/).length).toBeGreaterThan(0);
  });

  it('a burst that would exceed the memory budget stops with the memory message', async () => {
    const shutter = renderCamera([makePhoto({ byteSize: SESSION_MAX_BYTES - 3_000_000 })]);
    expect(shutter).toBeEnabled();
    fireEvent.pointerDown(shutter, { pointerId: 1, button: 0, pointerType: 'mouse' });
    await advance(TAP_THRESHOLD_MS + 500);
    fireEvent.pointerUp(shutter, { pointerId: 1, pointerType: 'mouse' });
    await advance(50);
    expect(screen.getAllByText(/Memory limit reached/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
