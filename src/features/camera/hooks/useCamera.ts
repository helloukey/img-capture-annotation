import { useCallback, useEffect, useRef, useState } from 'react';
import { createCapturedImage } from '@/shared/capturedImage';
import type { CapturedImage } from '@/shared/types';
import { captureVideoFrame, capturePhoto } from '../lib/capture';
import {
  cameraError,
  classifyCameraError,
  preflightCameraError,
  type CameraError,
} from '../lib/cameraErrors';
import { buildConstraintLadder, pickUpgradeConstraints } from '../lib/constraints';
import { decodeImage } from '../lib/decodeImage';
import { usePageVisibility } from './usePageVisibility';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'capturing' | 'error';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface UseCameraOptions {
  preferredFacingMode?: 'environment' | 'user';
  autoStart?: boolean;
}

export interface UseCameraResult {
  status: CameraStatus;
  error: CameraError | null;
  videoRef: (el: HTMLVideoElement | null) => void;
  track: MediaStreamTrack | null;
  resolution: { width: number; height: number } | null;
  devices: CameraDevice[];
  activeDeviceId: string | null;
  facingMode: 'environment' | 'user' | null;
  canSwitchCamera: boolean;
  start(): Promise<void>;
  stop(): void;
  retry(): Promise<void>;
  switchCamera(deviceId?: string): Promise<void>;
  capture(): Promise<CapturedImage>;
  /** One burst frame at the stream's full resolution; the stream keeps running (research R4). */
  captureFrame(): Promise<CapturedImage>;
}

function isOverconstrained(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError';
}

async function queryPermission(): Promise<PermissionState | undefined> {
  try {
    const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    return status?.state;
  } catch {
    return undefined; // Permissions API is a hint only (research R4).
  }
}

function hasGetUserMedia(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

function trackFacingMode(track: MediaStreamTrack): 'environment' | 'user' | null {
  const mode = track.getSettings().facingMode;
  if (mode === 'user' || mode === 'environment') return mode;
  return /front|user|facetime/i.test(track.label) ? 'user' : null;
}

/**
 * Owns the camera stream (contracts/camera.md). Components never call getUserMedia directly.
 */
export function useCamera({
  preferredFacingMode = 'environment',
  autoStart = true,
}: UseCameraOptions = {}): UseCameraResult {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraError | null>(null);
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user' | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestId = useRef(0);
  const inFlightCapture = useRef<Promise<CapturedImage> | null>(null);
  const pausedByVisibility = useRef(false);
  const statusRef = useRef<CameraStatus>('idle');
  const activeDeviceRef = useRef<string | null>(null);
  const devicesRef = useRef<CameraDevice[]>([]);
  const mounted = useRef(false);

  const updateStatus = useCallback((next: CameraStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const syncVideoResolution = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth && video.videoHeight) {
      setResolution({ width: video.videoWidth, height: video.videoHeight });
    }
  }, []);

  const attachStream = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    if (video.srcObject !== streamRef.current) video.srcObject = streamRef.current;
    if (streamRef.current) void video.play().catch(() => undefined);
  }, []);

  const videoCallbackRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (videoRef.current && videoRef.current !== el) {
        videoRef.current.removeEventListener('loadedmetadata', syncVideoResolution);
        videoRef.current.removeEventListener('resize', syncVideoResolution);
      }
      videoRef.current = el;
      if (el) {
        el.addEventListener('loadedmetadata', syncVideoResolution);
        el.addEventListener('resize', syncVideoResolution);
        attachStream(el);
      }
    },
    [attachStream, syncVideoResolution],
  );

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTrack(null);
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videos = all
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      devicesRef.current = videos;
      setDevices(videos);
    } catch {
      // Device listing is a nicety; capture still works without it.
    }
  }, []);

  const open = useCallback(
    async (deviceId?: string) => {
      const id = ++requestId.current;
      releaseStream();
      setError(null);
      updateStatus('requesting');

      const fail = (err: CameraError) => {
        if (id !== requestId.current) return;
        setError(err);
        updateStatus('error');
      };

      const preflight = preflightCameraError({
        isSecureContext: window.isSecureContext,
        hasGetUserMedia: hasGetUserMedia(),
      });
      if (preflight) return fail(preflight);

      let stream: MediaStream | null = null;
      let lastError: unknown;
      for (const constraints of buildConstraintLadder({
        facingMode: preferredFacingMode,
        ...(deviceId ? { deviceId } : {}),
      })) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
          if (!isOverconstrained(err)) break;
        }
      }

      if (id !== requestId.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!stream) {
        const permissionState = await queryPermission();
        return fail(
          classifyCameraError(lastError, { isSecureContext: true, hasGetUserMedia: true, permissionState }),
        );
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        stream.getTracks().forEach((t) => t.stop());
        return fail(cameraError('no-camera'));
      }

      try {
        const upgrade = pickUpgradeConstraints(
          videoTrack.getCapabilities?.() ?? {},
          videoTrack.getSettings(),
        );
        if (upgrade) await videoTrack.applyConstraints(upgrade);
      } catch {
        // Keep the stage-1 stream if the device refuses the upgrade (research R2).
      }

      if (id !== requestId.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      videoTrack.addEventListener('ended', () => {
        if (streamRef.current === stream && statusRef.current === 'live') {
          releaseStream();
          setError(cameraError('stream-interrupted'));
          updateStatus('error');
        }
      });

      const settings = videoTrack.getSettings();
      const resolvedDeviceId = settings.deviceId ?? deviceId ?? null;
      activeDeviceRef.current = resolvedDeviceId;
      setActiveDeviceId(resolvedDeviceId);
      setFacingMode(trackFacingMode(videoTrack));
      setTrack(videoTrack);
      if (settings.width && settings.height)
        setResolution({ width: settings.width, height: settings.height });
      attachStream(videoRef.current);
      syncVideoResolution();
      updateStatus('live');
      void refreshDevices();
    },
    [attachStream, preferredFacingMode, refreshDevices, releaseStream, syncVideoResolution, updateStatus],
  );

  const start = useCallback(() => open(activeDeviceRef.current ?? undefined), [open]);

  const stop = useCallback(() => {
    requestId.current++;
    releaseStream();
    updateStatus('idle');
  }, [releaseStream, updateStatus]);

  const retry = useCallback(() => open(activeDeviceRef.current ?? undefined), [open]);

  const switchCamera = useCallback(
    async (deviceId?: string) => {
      const list = devicesRef.current;
      let next = deviceId;
      if (!next) {
        if (list.length < 2) return;
        const index = list.findIndex((d) => d.deviceId === activeDeviceRef.current);
        next = list[(index + 1) % list.length]?.deviceId;
      }
      if (next) await open(next);
    },
    [open],
  );

  const capture = useCallback((): Promise<CapturedImage> => {
    if (inFlightCapture.current) return inFlightCapture.current;
    const stream = streamRef.current;
    const videoTrack = stream?.getVideoTracks()[0];
    const video = videoRef.current;
    if (statusRef.current !== 'live' || !videoTrack || !video) {
      return Promise.reject(cameraError('capture-failed', new Error('The camera is not ready.')));
    }
    updateStatus('capturing');
    const promise = (async () => {
      try {
        const result = await capturePhoto({ track: videoTrack, video, decode: decodeImage });
        const image = await createCapturedImage(result.blob, {
          source: 'camera',
          captureMethod: result.captureMethod,
          size: { width: result.width, height: result.height },
          ...(videoTrack.label ? { cameraLabel: videoTrack.label } : {}),
        });
        // The photo is taken: release the camera (and torch) right away (FR-006).
        requestId.current++;
        releaseStream();
        updateStatus('idle');
        return image;
      } catch (err) {
        if (streamRef.current) updateStatus('live');
        throw cameraError('capture-failed', err);
      } finally {
        inFlightCapture.current = null;
      }
    })();
    inFlightCapture.current = promise;
    return promise;
  }, [releaseStream, updateStatus]);

  const captureFrame = useCallback(async (): Promise<CapturedImage> => {
    const video = videoRef.current;
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (statusRef.current !== 'live' || !video || !videoTrack) {
      throw cameraError('capture-failed', new Error('The camera is not ready.'));
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    const blob = await captureVideoFrame(video);
    return createCapturedImage(blob, {
      source: 'camera',
      captureMethod: 'burst',
      size: { width, height },
      ...(videoTrack.label ? { cameraLabel: videoTrack.label } : {}),
    });
  }, []);

  const visible = usePageVisibility();

  // Release the camera while the page is hidden; resume when it becomes visible again.
  useEffect(() => {
    if (!visible) {
      if (streamRef.current || statusRef.current === 'requesting') {
        pausedByVisibility.current = true;
        requestId.current++;
        releaseStream();
        statusRef.current = 'idle';
        queueMicrotask(() => setStatus('idle'));
      }
      return;
    }
    if (pausedByVisibility.current) {
      pausedByVisibility.current = false;
      queueMicrotask(() => {
        if (mounted.current) void open(activeDeviceRef.current ?? undefined);
      });
    }
  }, [visible, open, releaseStream]);

  useEffect(() => {
    mounted.current = true;
    const requests = requestId; // a counter, not a DOM ref
    const streams = streamRef;
    if (autoStart) {
      queueMicrotask(() => {
        if (mounted.current) void open();
      });
    }
    return () => {
      mounted.current = false;
      requests.current++;
      streams.current?.getTracks().forEach((t) => t.stop());
      streams.current = null;
    };
    // Mount-only: later starts go through start()/retry().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    error,
    videoRef: videoCallbackRef,
    track,
    resolution,
    devices,
    activeDeviceId,
    facingMode,
    canSwitchCamera: devices.length > 1,
    start,
    stop,
    retry,
    switchCamera,
    capture,
    captureFrame,
  };
}
