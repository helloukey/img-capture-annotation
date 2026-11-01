import { useEffect } from 'react';
import { Flashlight, FlashlightOff } from '@/shared/ui/icons';
import { notify } from '@/shared/ui/toast';
import { Toggle } from '@/shared/ui/Toggle';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useTorch, type UseTorchResult } from '../hooks/useTorch';

export const TORCH_UNSUPPORTED = 'Flash isn’t supported on this device or browser';

export interface TorchToggleProps {
  track: MediaStreamTrack | null;
  /** Reports the torch controller so the parent can record support on capture. */
  onTorch?: (torch: UseTorchResult) => void;
}

export function TorchToggle({ track, onTorch }: TorchToggleProps) {
  const torch = useTorch(track);

  useEffect(() => {
    onTorch?.(torch);
  }, [onTorch, torch]);

  useEffect(() => {
    if (torch.error) notify.error(torch.error);
  }, [torch.error]);

  if (!torch.supported) {
    return (
      <Tooltip content={TORCH_UNSUPPORTED}>
        {/* The wrapper catches taps on the disabled control so touch users still get the explanation. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <span onClick={() => notify.info(TORCH_UNSUPPORTED)} className="inline-flex">
          <Toggle pressed={false} onPressedChange={() => {}} disabled aria-label="Torch (unavailable)">
            <FlashlightOff size={22} aria-hidden />
          </Toggle>
          <span className="sr-only">{TORCH_UNSUPPORTED}</span>
        </span>
      </Tooltip>
    );
  }

  return (
    <Toggle
      pressed={torch.on}
      pending={torch.pending}
      onPressedChange={() => void torch.toggle()}
      aria-label="Torch"
    >
      {torch.on ? <Flashlight size={22} aria-hidden /> : <FlashlightOff size={22} aria-hidden />}
    </Toggle>
  );
}
