/** Square `ideal` lets the browser pick the sensor's native aspect ratio in either orientation. */
export const IDEAL_DIMENSION = 4096;

export interface LadderOptions {
  facingMode: 'environment' | 'user';
  deviceId?: string;
}

/**
 * Ordered getUserMedia attempts (research R2). Resolution is only ever `ideal`, so the browser
 * picks the closest supported mode instead of failing; later rungs drop constraints entirely.
 */
export function buildConstraintLadder({ facingMode, deviceId }: LadderOptions): MediaStreamConstraints[] {
  const target: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: { ideal: facingMode } };
  return [
    {
      audio: false,
      video: { ...target, width: { ideal: IDEAL_DIMENSION }, height: { ideal: IDEAL_DIMENSION } },
    },
    { audio: false, video: { ...target } },
    { audio: false, video: true },
  ];
}

function maxOf(range: unknown): number | undefined {
  const max = (range as { max?: number } | undefined)?.max;
  return typeof max === 'number' && max > 0 ? max : undefined;
}

/**
 * If the track can deliver more pixels than it currently does, returns constraints that push it
 * to the capability maximum. Compares pixel counts so a rotated (portrait) stream counts as maxed.
 */
export function pickUpgradeConstraints(
  caps: MediaTrackCapabilities,
  settings: MediaTrackSettings,
): MediaTrackConstraints | null {
  const maxW = maxOf(caps.width);
  const maxH = maxOf(caps.height);
  if (!maxW || !maxH) return null;
  const current = (settings.width ?? 0) * (settings.height ?? 0);
  if (current >= maxW * maxH * 0.98) return null;
  return { width: { ideal: maxW }, height: { ideal: maxH } };
}
