import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { photoProcessor } from '@/features/session/lib/defaultPhotoProcessor';
import { BURST_MAX_FRAMES, TAP_THRESHOLD_MS } from '@/features/session/lib/limits';
import type { Photo } from '@/shared/types';
import { makePhoto } from '../../../../tests/fakes/appState';
import { ShutterButton } from '../components/ShutterButton';
import type { UseCameraResult } from './useCamera';
import { useBurst, type UseBurstOptions } from './useBurst';

function fakeCamera(overrides: Partial<UseCameraResult> = {}) {
  return {
    status: 'live',
    capture: vi.fn(async () => makePhoto()),
    captureFrame: vi.fn(async () => makePhoto({ captureMethod: 'burst' })),
    stop: vi.fn(),
    ...overrides,
  } as unknown as UseCameraResult;
}

let lastBurst: ReturnType<typeof useBurst>;
function Harness(props: UseBurstOptions) {
  const burst = useBurst(props);
  useEffect(() => {
    lastBurst = burst;
  });
  return (
    <>
      <ShutterButton handlers={burst.shutterHandlers} disabled={false} busy={false} />
      <output data-testid="count">{burst.frameCount}</output>
      <output data-testid="phase">{burst.phase}</output>
    </>
  );
}

function setup(camera = fakeCamera(), session = { photos: 0, heldBytes: 0 }) {
  const onPhotos = vi.fn<(photos: Photo[], reason: string | null) => void>();
  const view = render(<Harness camera={camera} onPhotos={onPhotos} session={() => session} />);
  return { camera, onPhotos, shutter: screen.getByRole('button', { name: 'Capture photo' }), ...view };
}

const press = (el: Element, id = 1) =>
  fireEvent.pointerDown(el, { pointerId: id, button: 0, pointerType: 'touch' });
const release = (el: Element, id = 1) => fireEvent.pointerUp(el, { pointerId: id, pointerType: 'touch' });
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('tap vs hold (FR-001, FR-002)', () => {
  it('a 299 ms press is a single capture', async () => {
    const { camera, onPhotos, shutter } = setup();
    press(shutter);
    await advance(299);
    release(shutter);
    await advance(10);
    expect(camera.capture).toHaveBeenCalledTimes(1);
    expect(camera.captureFrame).not.toHaveBeenCalled();
    expect(onPhotos).toHaveBeenCalledWith([expect.any(Object)], null);
  });

  it('a press of exactly 300 ms is still a tap', async () => {
    const { camera, shutter } = setup();
    press(shutter);
    await advance(TAP_THRESHOLD_MS);
    release(shutter);
    await advance(10);
    expect(camera.capture).toHaveBeenCalledTimes(1);
    expect(camera.captureFrame).not.toHaveBeenCalled();
  });

  it('holding past 300 ms starts a burst of sequential frames, then stops the camera', async () => {
    const pause = vi.spyOn(photoProcessor, 'pause');
    const resume = vi.spyOn(photoProcessor, 'resume');
    const { camera, onPhotos, shutter } = setup();
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 1);
    expect(screen.getByTestId('phase')).toHaveTextContent('running');
    expect(pause).toHaveBeenCalled();
    await advance(1000);
    release(shutter);
    await advance(50);
    expect(camera.capture).not.toHaveBeenCalled();
    expect(vi.mocked(camera.captureFrame).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(camera.stop).toHaveBeenCalled();
    expect(resume).toHaveBeenCalled();
    const [photos, reason] = onPhotos.mock.calls[0]!;
    expect(reason).toBe('released');
    expect(photos.map((p) => p.burstIndex)).toEqual(photos.map((_, i) => i + 1));
    expect(new Set(photos.map((p) => p.burstId)).size).toBe(1);
  });

  it('updates the live frame counter per frame', async () => {
    const { shutter } = setup();
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 1 + 400);
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThanOrEqual(2);
  });

  it('auto-stops at the burst limits', async () => {
    const { onPhotos, shutter } = setup();
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 1 + 4000);
    release(shutter); // delivery waits for the finger to lift
    await advance(10);
    const [photos, reason] = onPhotos.mock.calls[0]!;
    expect(photos.length).toBeLessThanOrEqual(BURST_MAX_FRAMES);
    expect(['time-limit', 'frame-limit']).toContain(reason);
  });
});

describe('auto-stop while still held', () => {
  it('reports the stop at once but delivers photos only when the finger lifts (no ghost tap on Review)', async () => {
    const onStopped = vi.fn();
    const camera = fakeCamera();
    const onPhotos = vi.fn();
    render(
      <Harness
        camera={camera}
        onPhotos={onPhotos}
        onStopped={onStopped}
        session={() => ({ photos: 0, heldBytes: 0 })}
      />,
    );
    const shutter = screen.getByRole('button', { name: 'Capture photo' });
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 1 + 3500); // past the 3 s limit, finger still down
    expect(onStopped).toHaveBeenCalledWith(expect.stringMatching(/limit/), expect.any(Number));
    expect(onPhotos).not.toHaveBeenCalled();
    expect(camera.stop).not.toHaveBeenCalled(); // the preview stays up while held
    fireEvent.pointerUp(shutter, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 });
    await advance(10);
    expect(onPhotos).toHaveBeenCalledTimes(1);
    expect(camera.stop).toHaveBeenCalled();

    // The browser's synthetic click at the release point must not reach whatever is now there…
    const ghost = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 102, clientY: 198 });
    document.body.dispatchEvent(ghost);
    expect(ghost.defaultPrevented).toBe(true);
    // …but a click elsewhere, or a later click, is untouched.
    const elsewhere = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 400, clientY: 50 });
    document.body.dispatchEvent(elsewhere);
    expect(elsewhere.defaultPrevented).toBe(false);
  });
});

describe('stop signals (FR-003)', () => {
  it('pointercancel and lostpointercapture stop the burst with "released"', async () => {
    const { onPhotos, shutter } = setup();
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 500);
    fireEvent.pointerCancel(shutter, { pointerId: 1 });
    await advance(50);
    expect(onPhotos.mock.calls[0]![1]).toBe('released');
  });

  it('moving outside the button does not stop the burst; pointerup anywhere does', async () => {
    const { onPhotos, shutter } = setup();
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 300);
    fireEvent.pointerMove(shutter, { pointerId: 1, clientX: 900, clientY: 900 });
    fireEvent.pointerLeave(shutter, { pointerId: 1 });
    await advance(400);
    expect(onPhotos).not.toHaveBeenCalled();
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    release(shutter); // pointer capture routes the up event to the shutter
    await advance(50);
    expect(onPhotos).toHaveBeenCalledTimes(1);
  });

  it('a second pointer neither starts nor stops anything', async () => {
    const { camera, onPhotos, shutter } = setup();
    press(shutter, 1);
    await advance(TAP_THRESHOLD_MS + 300);
    press(shutter, 2);
    release(shutter, 2);
    await advance(300);
    expect(onPhotos).not.toHaveBeenCalled();
    expect(camera.capture).not.toHaveBeenCalled();
    release(shutter, 1);
    await advance(50);
    expect(onPhotos).toHaveBeenCalledTimes(1);
  });

  it('hiding the page stops with "backgrounded"', async () => {
    const { onPhotos, shutter } = setup();
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 300);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(50);
    expect(onPhotos.mock.calls[0]![1]).toBe('backgrounded');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('a camera interruption stops with "interrupted"', async () => {
    const camera = fakeCamera();
    const onPhotos = vi.fn();
    const { rerender } = render(
      <Harness camera={camera} onPhotos={onPhotos} session={() => ({ photos: 0, heldBytes: 0 })} />,
    );
    const shutter = screen.getByRole('button', { name: 'Capture photo' });
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 300);
    rerender(
      <Harness
        camera={{ ...camera, status: 'error' } as UseCameraResult}
        onPhotos={onPhotos}
        session={() => ({ photos: 0, heldBytes: 0 })}
      />,
    );
    await advance(50);
    expect(onPhotos.mock.calls[0]![1]).toBe('interrupted');
  });

  it('keeps the torch untouched during a burst (edge case)', async () => {
    const applyConstraints = vi.fn();
    const { shutter } = setup(fakeCamera({ track: { applyConstraints } as unknown as MediaStreamTrack }));
    press(shutter);
    await advance(TAP_THRESHOLD_MS + 1000);
    release(shutter);
    await advance(50);
    expect(applyConstraints).not.toHaveBeenCalled();
  });
});

describe('shutter details', () => {
  it('prevents the long-press context menu (FR-008)', () => {
    const { shutter } = setup();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    shutter.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Enter and Space take a single photo, never a burst', async () => {
    const { camera, shutter } = setup();
    fireEvent.keyDown(shutter, { key: 'Enter' });
    await advance(10);
    fireEvent.keyDown(shutter, { key: ' ' });
    await advance(500);
    expect(camera.capture).toHaveBeenCalledTimes(2);
    expect(camera.captureFrame).not.toHaveBeenCalled();
  });

  it('toggleBurst starts and stops a burst without holding (toggled)', async () => {
    const { onPhotos } = setup();
    act(() => lastBurst.toggleBurst());
    await advance(700);
    act(() => lastBurst.toggleBurst());
    await advance(50);
    expect(onPhotos.mock.calls[0]![1]).toBe('toggled');
  });
});
