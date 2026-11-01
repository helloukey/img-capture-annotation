import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installFakeImageCapture } from '../../../../tests/fakes/fakeImageCapture';
import { installFakeMediaDevices, domError } from '../../../../tests/fakes/fakeMediaDevices';
import { useCamera, type UseCameraResult } from './useCamera';

function setup(options?: Parameters<typeof useCamera>[0]) {
  const result: { current: UseCameraResult } = { current: null as unknown as UseCameraResult };
  function Harness() {
    result.current = useCamera(options);
    return <video ref={result.current.videoRef} data-testid="video" />;
  }
  const view = render(<Harness />);
  return { result, ...view };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useCamera', () => {
  it('goes requesting → live and reports the resolution the track delivers', async () => {
    installFakeMediaDevices({
      devices: [
        {
          deviceId: 'cam-back',
          label: 'Back',
          track: {
            capabilities: { width: { max: 1920 }, height: { max: 1080 } },
            settings: { width: 1920, height: 1080 },
          },
        },
      ],
    });
    const { result } = setup();
    expect(['idle', 'requesting']).toContain(result.current.status);
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(result.current.resolution).toEqual({ width: 1920, height: 1080 });
  });

  it('upgrades the stream to the capability max via applyConstraints', async () => {
    const media = installFakeMediaDevices({
      devices: [
        {
          deviceId: 'cam-back',
          label: 'Back',
          track: {
            capabilities: { width: { max: 3840 }, height: { max: 2160 } },
            settings: { width: 1280, height: 720 },
          },
        },
      ],
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(media.lastTrack().applyConstraints).toHaveBeenCalledWith({
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    });
    expect(result.current.resolution).toEqual({ width: 3840, height: 2160 });
  });

  it('walks the constraint ladder on OverconstrainedError', async () => {
    const media = installFakeMediaDevices({ failures: [domError('OverconstrainedError')] });
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('stops tracks on unmount', async () => {
    const media = installFakeMediaDevices();
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    unmount();
    expect(media.lastTrack().stop).toHaveBeenCalled();
  });

  it('releases the camera when the page is hidden and restarts when visible', async () => {
    const media = installFakeMediaDevices();
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    const first = media.lastTrack();
    act(() => setVisibility('hidden'));
    expect(first.stop).toHaveBeenCalled();
    act(() => setVisibility('visible'));
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(media.tracks).toHaveLength(2);
  });

  it('capture() returns a CapturedImage sized from the decoded photo and stops the stream', async () => {
    const media = installFakeMediaDevices();
    installFakeImageCapture({ photoWidth: 4032, photoHeight: 3024 });
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    let image: Awaited<ReturnType<UseCameraResult['capture']>> | undefined;
    await act(async () => {
      image = await result.current.capture();
    });
    expect(image).toMatchObject({
      width: 4032,
      height: 3024,
      source: 'camera',
      captureMethod: 'image-capture',
    });
    expect(media.lastTrack().stop).toHaveBeenCalled();
  });

  it('ignores a second concurrent capture() call', async () => {
    installFakeMediaDevices();
    const ic = installFakeImageCapture();
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    await act(async () => {
      const a = result.current.capture();
      const b = result.current.capture();
      expect(b).toBe(a);
      await a;
    });
    expect(ic.takePhoto).toHaveBeenCalledTimes(1);
  });

  it('capture() rejects when the camera is not live', async () => {
    installFakeMediaDevices({ alwaysFail: domError('NotAllowedError') });
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('error'));
    await expect(result.current.capture()).rejects.toMatchObject({ kind: expect.any(String) });
  });

  it('switchCamera() cycles to the next device with deviceId exact and stops the old track', async () => {
    const media = installFakeMediaDevices({
      devices: [
        { deviceId: 'cam-back', label: 'Back' },
        { deviceId: 'cam-front', label: 'Front' },
      ],
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    await waitFor(() => expect(result.current.canSwitchCamera).toBe(true));
    const first = media.lastTrack();
    await act(async () => {
      await result.current.switchCamera();
    });
    expect(first.stop).toHaveBeenCalled();
    expect(media.getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ deviceId: { exact: 'cam-front' } }) }),
    );
    expect(result.current.activeDeviceId).toBe('cam-front');
    expect(result.current.track).toBe(media.lastTrack());
  });

  it('canSwitchCamera is false with a single device', async () => {
    installFakeMediaDevices();
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(result.current.canSwitchCamera).toBe(false);
  });

  it('does not auto-start when autoStart is false', async () => {
    const media = installFakeMediaDevices();
    const { result } = setup({ autoStart: false });
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.status).toBe('idle');
    expect(media.getUserMedia).not.toHaveBeenCalled();
    vi.clearAllMocks();
  });
});
