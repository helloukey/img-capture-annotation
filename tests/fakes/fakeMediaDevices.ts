import { vi } from 'vitest';
import { FakeMediaStream, FakeTrack, type FakeTrackOptions } from './fakeTrack';

export type DomErrorName =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'AbortError'
  | 'SecurityError';

export function domError(name: DomErrorName, message = name): DOMException {
  return new DOMException(message, name);
}

export interface FakeDevice {
  deviceId: string;
  label: string;
  track?: FakeTrackOptions;
}

export interface InstallOptions {
  devices?: FakeDevice[];
  /** Errors thrown by successive getUserMedia calls (undefined entries succeed). */
  failures?: (DOMException | Error | undefined)[];
  /** Fails every call with this error. */
  alwaysFail?: DOMException | Error;
}

export interface FakeMediaDevicesHandle {
  getUserMedia: ReturnType<typeof vi.fn>;
  enumerateDevices: ReturnType<typeof vi.fn>;
  tracks: FakeTrack[];
  lastTrack(): FakeTrack;
}

/** Installs a fake navigator.mediaDevices. Each successful getUserMedia creates a new FakeTrack. */
export function installFakeMediaDevices(opts: InstallOptions = {}): FakeMediaDevicesHandle {
  const devices = opts.devices ?? [{ deviceId: 'cam-back', label: 'Back Camera' }];
  const failures = [...(opts.failures ?? [])];
  const tracks: FakeTrack[] = [];

  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    if (opts.alwaysFail) throw opts.alwaysFail;
    const failure = failures.shift();
    if (failure) throw failure;
    const video = typeof constraints.video === 'object' ? constraints.video : {};
    const wanted = (video.deviceId as ConstrainDOMStringParameters | undefined)?.exact;
    const device = devices.find((d) => d.deviceId === wanted) ?? devices[0];
    if (!device) throw domError('NotFoundError');
    const track = new FakeTrack({ label: device.label, deviceId: device.deviceId, ...device.track });
    tracks.push(track);
    return new FakeMediaStream([track]) as unknown as MediaStream;
  });

  const enumerateDevices = vi.fn(async () =>
    devices.map(
      (d) => ({ kind: 'videoinput', deviceId: d.deviceId, label: d.label, groupId: 'g' }) as MediaDeviceInfo,
    ),
  );

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });

  return {
    getUserMedia,
    enumerateDevices,
    tracks,
    lastTrack() {
      const t = tracks.at(-1);
      if (!t) throw new Error('No track was created');
      return t;
    },
  };
}

export function removeMediaDevices() {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
}
