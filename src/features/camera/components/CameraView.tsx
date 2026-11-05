import { useCallback, useRef, useState } from 'react';
import { useApp, useSession } from '@/app/AppContext';
import { ChoosePhotoButton } from '@/features/upload/components/ChoosePhotoButton';
import { BURST_STOP_COPY, burstAnnouncement } from '@/features/session/lib/burstCopy';
import type { BurstStopReason } from '@/features/session/lib/burstScheduler';
import { heldBytes } from '@/features/session/lib/sessionSelectors';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { Photo } from '@/shared/types';
import { cn } from '@/shared/ui/cn';
import { notify } from '@/shared/ui/toast';
import { useBurst } from '../hooks/useBurst';
import { useCamera } from '../hooks/useCamera';
import type { UseTorchResult } from '../hooks/useTorch';
import { BurstProgress } from './BurstProgress';
import { CameraErrorState } from './CameraErrorState';
import { CameraPreview } from './CameraPreview';
import { PermissionPrimer } from './PermissionPrimer';
import { ShutterButton } from './ShutterButton';
import { SwitchCameraButton } from './SwitchCameraButton';
import { TorchToggle } from './TorchToggle';

export function CameraView() {
  const { stateRef } = useApp();
  const { addPhotos } = useSession();
  const camera = useCamera();
  const landscape = useMediaQuery('(orientation: landscape) and (max-height: 600px)');
  const [flashKey, setFlashKey] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const torchSupported = useRef(false);
  const onTorch = useCallback((t: UseTorchResult) => {
    torchSupported.current = t.supported;
  }, []);

  const onStopped = (reason: BurstStopReason, frames: number) => {
    setAnnouncement(burstAnnouncement(frames, reason));
    const why = BURST_STOP_COPY[reason];
    if (why) (reason === 'interrupted' || reason === 'backgrounded' ? notify.error : notify.info)(why);
  };

  const onPhotos = (photos: Photo[]) => {
    if (!photos.length) return;
    const result = addPhotos(photos.map((p) => ({ ...p, torchAvailable: torchSupported.current })));
    if (result.skipped)
      notify.info(`${result.skipped} photo${result.skipped === 1 ? '' : 's'} not added: session full`);
  };

  const burst = useBurst({
    camera,
    onPhotos,
    onStopped,
    session: () => ({
      photos: stateRef.current.session.photos.length,
      heldBytes: heldBytes(stateRef.current.session),
    }),
    onFrame: () => setFlashKey((k) => k + 1),
    onError: () => notify.error('Couldn’t take the photo', 'Please try again.'),
  });

  const live = camera.status === 'live' || camera.status === 'capturing';
  const bursting = burst.phase === 'running';
  const busyControls = burst.phase !== 'idle';

  return (
    <section aria-label="Camera" className="relative h-full w-full overflow-hidden bg-black">
      {camera.status === 'error' && camera.error ? (
        <CameraErrorState error={camera.error} onRetry={() => void camera.retry()} />
      ) : (
        <CameraPreview videoRef={camera.videoRef} mirrored={camera.facingMode === 'user'} />
      )}

      {(camera.status === 'requesting' || camera.status === 'idle') && <PermissionPrimer />}

      {flashKey > 0 && (
        <div
          key={flashKey}
          data-testid="shutter-flash"
          className={cn(
            'pointer-events-none absolute inset-0 bg-white animate-shutter',
            bursting && 'opacity-50',
          )}
          aria-hidden
        />
      )}

      {live && camera.resolution && (
        <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium tabular-nums text-white backdrop-blur">
          {camera.resolution.width} × {camera.resolution.height}
        </div>
      )}

      {/* Torch and camera switching are unavailable during a burst (FR-009). */}
      {live && (
        <div className="absolute right-3 top-3" inert={busyControls || undefined}>
          <TorchToggle track={camera.track} onTorch={onTorch} />
        </div>
      )}

      {camera.status !== 'error' && (
        <div
          className={cn(
            'absolute flex items-center justify-between gap-4',
            landscape
              ? 'inset-y-0 right-0 w-28 flex-col-reverse justify-center py-6 pr-[max(1rem,env(safe-area-inset-right))]'
              : 'inset-x-0 bottom-0 safe-bottom px-8 pt-10 bg-gradient-to-t from-black/70 to-transparent',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center" inert={busyControls || undefined}>
            <ChoosePhotoButtonCompact />
          </div>
          <div className="relative">
            <ShutterButton
              handlers={burst.shutterHandlers}
              disabled={!live}
              busy={camera.status === 'capturing'}
            />
            {bursting && burst.startedAt !== null && (
              <BurstProgress startedAt={burst.startedAt} frames={burst.frameCount} />
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center" inert={busyControls || undefined}>
            {camera.canSwitchCamera && (
              <SwitchCameraButton
                onSwitch={() => void camera.switchCamera()}
                disabled={camera.status !== 'live'}
              />
            )}
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </section>
  );
}

/** Small gallery button in the live control bar, for picking an existing photo. */
function ChoosePhotoButtonCompact() {
  return <ChoosePhotoButton iconOnly label="Choose a photo from your device" />;
}
