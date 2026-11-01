export type CameraErrorKind =
  | 'insecure-context'
  | 'unsupported'
  | 'permission-denied'
  | 'permission-dismissed'
  | 'no-camera'
  | 'camera-busy'
  | 'stream-interrupted'
  | 'capture-failed'
  | 'unknown';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
  cause?: unknown;
}

export interface CameraEnv {
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
  permissionState?: PermissionState | undefined;
}

export type CameraAction = 'retry' | 'allow' | 'reconnect' | 'upload';

export interface CameraErrorCopy {
  title: string;
  body: string;
  primary: CameraAction;
  secondary?: CameraAction;
}

/** Specific message and recovery action per condition (FR-011, contracts/camera.md UI states). */
export const CAMERA_ERROR_COPY: Record<CameraErrorKind, CameraErrorCopy> = {
  'insecure-context': {
    title: 'Camera needs a secure connection',
    body: 'Browsers only allow camera access on HTTPS pages (or localhost). Open this app over https://, or choose an existing photo instead.',
    primary: 'upload',
  },
  unsupported: {
    title: 'This browser doesn’t support camera access',
    body: 'Try a current version of Chrome, Safari, Edge or Firefox, or choose an existing photo instead.',
    primary: 'upload',
  },
  'permission-denied': {
    title: 'Camera access is blocked',
    body: 'This site isn’t allowed to use your camera. Re-enable it in your browser’s site settings, then try again.',
    primary: 'retry',
    secondary: 'upload',
  },
  'permission-dismissed': {
    title: 'Camera access is needed',
    body: 'Allow camera access when your browser asks, so you can take a photo here.',
    primary: 'allow',
    secondary: 'upload',
  },
  'no-camera': {
    title: 'No camera found',
    body: 'We couldn’t find a camera on this device. You can still choose an existing photo to annotate.',
    primary: 'upload',
    secondary: 'retry',
  },
  'camera-busy': {
    title: 'Camera is in use by another app',
    body: 'Close other apps or tabs that might be using the camera (video calls, other camera apps), then try again.',
    primary: 'retry',
    secondary: 'upload',
  },
  'stream-interrupted': {
    title: 'Camera disconnected',
    body: 'The camera stopped unexpectedly. It may have been unplugged or its permission revoked.',
    primary: 'reconnect',
    secondary: 'upload',
  },
  'capture-failed': {
    title: 'Couldn’t take the photo',
    body: 'Something went wrong while capturing. Please try again.',
    primary: 'retry',
    secondary: 'upload',
  },
  unknown: {
    title: 'The camera couldn’t start',
    body: 'An unexpected error occurred while opening the camera.',
    primary: 'retry',
    secondary: 'upload',
  },
};

export function cameraError(kind: CameraErrorKind, cause?: unknown): CameraError {
  return { kind, message: CAMERA_ERROR_COPY[kind].title, ...(cause !== undefined ? { cause } : {}) };
}

/** Checks done before any permission prompt. */
export function preflightCameraError(env: CameraEnv): CameraError | null {
  if (!env.isSecureContext) return cameraError('insecure-context');
  if (!env.hasGetUserMedia) return cameraError('unsupported');
  return null;
}

/** Maps getUserMedia failures to a closed set of kinds (research R4). */
export function classifyCameraError(err: unknown, env: CameraEnv): CameraError {
  const pre = preflightCameraError(env);
  if (pre) return { ...pre, cause: err };
  const name = (err as { name?: unknown } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      // Chrome reports a dismissed prompt as NotAllowedError while the permission stays "prompt".
      return cameraError(
        env.permissionState === 'prompt' ? 'permission-dismissed' : 'permission-denied',
        err,
      );
    case 'SecurityError':
      return cameraError('permission-denied', err);
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return cameraError('no-camera', err);
    case 'NotSupportedError':
      return cameraError('unsupported', err);
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return cameraError('camera-busy', err);
    default:
      return cameraError('unknown', err);
  }
}

/** Browser-specific steps to re-enable a blocked camera permission. */
export function permissionHelp(userAgent: string): string {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 'On iPhone/iPad: tap “aA” in the address bar → Website Settings → Camera → Allow. Or Settings → Safari → Camera.';
  }
  if (/Firefox\//.test(userAgent))
    return 'In Firefox: click the camera icon in the address bar and remove the block.';
  if (/Safari\//.test(userAgent) && !/Chrome|Chromium|Edg\//.test(userAgent)) {
    return 'In Safari: Safari menu → Settings for This Website → Camera → Allow.';
  }
  return 'In Chrome/Edge: click the icon left of the address bar → Site settings → Camera → Allow.';
}
