import { describe, expect, it } from 'vitest';
import { classifyCameraError, CAMERA_ERROR_COPY, preflightCameraError } from './cameraErrors';

const env = { isSecureContext: true, hasGetUserMedia: true };
const dom = (name: string) => new DOMException(name, name);

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', undefined, 'permission-denied'],
    ['NotAllowedError', 'denied', 'permission-denied'],
    ['NotAllowedError', 'prompt', 'permission-dismissed'],
    ['SecurityError', undefined, 'permission-denied'],
    ['NotFoundError', undefined, 'no-camera'],
    ['DevicesNotFoundError', undefined, 'no-camera'],
    ['OverconstrainedError', undefined, 'no-camera'],
    ['NotReadableError', undefined, 'camera-busy'],
    ['TrackStartError', undefined, 'camera-busy'],
    ['AbortError', undefined, 'camera-busy'],
    ['NotSupportedError', undefined, 'unsupported'],
    ['TypeError', undefined, 'unknown'],
  ] as const)('%s (permission %s) → %s', (name, permissionState, kind) => {
    expect(classifyCameraError(dom(name), { ...env, permissionState }).kind).toBe(kind);
  });

  it('treats a missing secure context or API as the root cause', () => {
    expect(classifyCameraError(dom('NotAllowedError'), { ...env, isSecureContext: false }).kind).toBe(
      'insecure-context',
    );
    expect(classifyCameraError(new Error('x'), { ...env, hasGetUserMedia: false }).kind).toBe('unsupported');
  });

  it('keeps the original error as the cause and a human message', () => {
    const err = dom('NotReadableError');
    const result = classifyCameraError(err, env);
    expect(result.cause).toBe(err);
    expect(result.message).toBe(CAMERA_ERROR_COPY['camera-busy'].title);
  });

  it('classifies unknown non-Error values', () => {
    expect(classifyCameraError('weird', env).kind).toBe('unknown');
  });
});

describe('preflightCameraError', () => {
  it('detects insecure contexts and missing APIs before prompting', () => {
    expect(preflightCameraError({ isSecureContext: false, hasGetUserMedia: true })?.kind).toBe(
      'insecure-context',
    );
    expect(preflightCameraError({ isSecureContext: true, hasGetUserMedia: false })?.kind).toBe('unsupported');
    expect(preflightCameraError(env)).toBeNull();
  });
});
