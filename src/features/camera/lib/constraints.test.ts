import { describe, expect, it } from 'vitest';
import { buildConstraintLadder, IDEAL_DIMENSION, pickUpgradeConstraints } from './constraints';

describe('buildConstraintLadder', () => {
  it('starts with ideal high-resolution constraints preferring the rear camera', () => {
    const [first] = buildConstraintLadder({ facingMode: 'environment' });
    expect(first).toEqual({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: IDEAL_DIMENSION },
        height: { ideal: IDEAL_DIMENSION },
      },
    });
  });

  it('never uses exact/min for resolution in any rung', () => {
    for (const c of buildConstraintLadder({ facingMode: 'environment' })) {
      const json = JSON.stringify(c);
      expect(json).not.toMatch(/"width":\{"(exact|min)"/);
      expect(json).not.toMatch(/"height":\{"(exact|min)"/);
    }
  });

  it('falls back to facingMode-only and then to any camera', () => {
    const ladder = buildConstraintLadder({ facingMode: 'environment' });
    expect(ladder[1]).toEqual({ audio: false, video: { facingMode: { ideal: 'environment' } } });
    expect(ladder.at(-1)).toEqual({ audio: false, video: true });
  });

  it('targets a specific device with deviceId exact when given', () => {
    const ladder = buildConstraintLadder({ facingMode: 'environment', deviceId: 'cam-2' });
    expect(ladder[0]).toMatchObject({
      video: { deviceId: { exact: 'cam-2' }, width: { ideal: IDEAL_DIMENSION } },
    });
    expect(ladder[0]?.video).not.toHaveProperty('facingMode');
    expect(ladder[1]).toEqual({ audio: false, video: { deviceId: { exact: 'cam-2' } } });
  });
});

describe('pickUpgradeConstraints', () => {
  const caps = { width: { min: 1, max: 3840 }, height: { min: 1, max: 2160 } } as MediaTrackCapabilities;

  it('returns null when the stream already delivers the max resolution', () => {
    expect(pickUpgradeConstraints(caps, { width: 3840, height: 2160 })).toBeNull();
  });

  it('treats a rotated (portrait) stream at max resolution as already maxed', () => {
    expect(pickUpgradeConstraints(caps, { width: 2160, height: 3840 })).toBeNull();
  });

  it('asks for the capability max as ideal when the stream is below it', () => {
    expect(pickUpgradeConstraints(caps, { width: 1280, height: 720 })).toEqual({
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    });
  });

  it('returns null when capabilities are unknown', () => {
    expect(pickUpgradeConstraints({}, { width: 640, height: 480 })).toBeNull();
  });
});
