import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/AppContext';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { cn } from '@/shared/ui/cn';
import { notify } from '@/shared/ui/toast';
import { ChoosePhotoButton } from '@/features/upload/components/ChoosePhotoButton';
import { useCamera } from '../hooks/useCamera';
import type { UseTorchResult } from '../hooks/useTorch';
import { CameraErrorState } from './CameraErrorState';
import { CameraPreview } from './CameraPreview';
import { PermissionPrimer } from './PermissionPrimer';
import { TorchToggle } from './TorchToggle';
import { ShutterButton } from './ShutterButton';
import { SwitchCameraButton } from './SwitchCameraButton';

export function CameraView() {
  const { addPhotos } = useSession();
  const camera = useCamera();
  const landscape = useMediaQuery('(orientation: landscape) and (max-height: 600px)');
  const [flashKey, setFlashKey] = useState(0);
  const torchSupported = useRef(false);
  const onTorch = useCallback((t: UseTorchResult) => {
    torchSupported.current = t.supported;
  }, []);

  const handleCapture = async () => {
    setFlashKey((k) => k + 1);
    try {
      const image = await camera.capture();
      addPhotos([{ ...image, torchAvailable: torchSupported.current }]);
    } catch {
      notify.error('Couldn’t take the photo', 'Please try again.');
    }
  };

  const live = camera.status === 'live' || camera.status === 'capturing';

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
          className="pointer-events-none absolute inset-0 bg-white animate-shutter"
          aria-hidden
        />
      )}

      {live && camera.resolution && (
        <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium tabular-nums text-white backdrop-blur">
          {camera.resolution.width} × {camera.resolution.height}
        </div>
      )}

      {live && (
        <div className="absolute right-3 top-3">
          <TorchToggle track={camera.track} onTorch={onTorch} />
        </div>
      )}

      {camera.status !== 'error' && (
        <div
          className={cn(
            'absolute flex items-center justify-between gap-4',
            landscape
              ? 'inset-y-0 right-0 w-28 flex-col-reverse justify-center py-6 pr-[max(1rem,env(safe-area-inset-right))]'
              : 'inset-x-0 bottom-0 safe-bottom px-8 pt-6 bg-gradient-to-t from-black/70 to-transparent',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center">
            <ChoosePhotoButtonCompact />
          </div>
          <ShutterButton
            onCapture={() => void handleCapture()}
            disabled={!live}
            busy={camera.status === 'capturing'}
          />
          <div className="flex h-12 w-12 items-center justify-center">
            {camera.canSwitchCamera && (
              <SwitchCameraButton
                onSwitch={() => void camera.switchCamera()}
                disabled={camera.status !== 'live'}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Small gallery button in the live control bar, for picking an existing photo. */
function ChoosePhotoButtonCompact() {
  return <ChoosePhotoButton iconOnly label="Choose a photo from your device" />;
}
