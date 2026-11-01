import { IconButton } from '@/shared/ui/IconButton';
import { SwitchCamera } from '@/shared/ui/icons';

export function SwitchCameraButton({ onSwitch, disabled }: { onSwitch: () => void; disabled?: boolean }) {
  return (
    <IconButton aria-label="Switch camera" tone="overlay" size="lg" onClick={onSwitch} disabled={disabled}>
      <SwitchCamera size={22} aria-hidden />
    </IconButton>
  );
}
