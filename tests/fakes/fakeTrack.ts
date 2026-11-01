import { vi } from 'vitest';

export interface FakeTrackOptions {
  label?: string;
  deviceId?: string;
  capabilities?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  /** Override applyConstraints, e.g. to reject or to report a different resulting state. */
  applyConstraints?: (c: MediaTrackConstraints, track: FakeTrack) => Promise<void>;
}

/** Minimal MediaStreamTrack stand-in for jsdom tests. */
export class FakeTrack extends EventTarget {
  readonly kind = 'video';
  readonly id = crypto.randomUUID();
  label: string;
  readyState: MediaStreamTrackState = 'live';
  enabled = true;
  capabilities: Record<string, unknown>;
  settings: Record<string, unknown>;
  stop = vi.fn(() => {
    this.readyState = 'ended';
  });
  applyConstraints: (c?: MediaTrackConstraints) => Promise<void>;

  constructor(opts: FakeTrackOptions = {}) {
    super();
    this.label = opts.label ?? 'Back Camera';
    this.capabilities = { width: { min: 1, max: 1920 }, height: { min: 1, max: 1080 }, ...opts.capabilities };
    this.settings = { width: 1280, height: 720, deviceId: opts.deviceId ?? 'cam-back', ...opts.settings };
    const custom = opts.applyConstraints;
    this.applyConstraints = vi.fn(async (c: MediaTrackConstraints = {}) => {
      if (custom) return custom(c, this);
      // Default: honor width/height ideals and torch like a real device would.
      const w = c.width as ConstrainULongRange | undefined;
      const h = c.height as ConstrainULongRange | undefined;
      if (w?.ideal) this.settings.width = w.ideal;
      if (h?.ideal) this.settings.height = h.ideal;
      const torch = (c.advanced?.[0] as { torch?: boolean } | undefined)?.torch;
      if (torch !== undefined) this.settings.torch = torch;
    });
  }

  getCapabilities() {
    return this.capabilities as MediaTrackCapabilities;
  }
  getSettings() {
    return this.settings as MediaTrackSettings;
  }
  getConstraints() {
    return {};
  }
  end() {
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }
}

export class FakeMediaStream {
  constructor(private tracks: FakeTrack[]) {}
  getVideoTracks() {
    return this.tracks;
  }
  getTracks() {
    return this.tracks;
  }
}
