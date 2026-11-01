import { ChoosePhotoButton } from '@/features/upload/components/ChoosePhotoButton';
import { Camera, LoaderCircle } from '@/shared/ui/icons';

/** Shown while the browser's permission prompt is pending (US5-1). */
export function PermissionPrimer() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface/95 p-6 text-center"
      role="status"
    >
      <div className="relative">
        <Camera size={44} className="text-accent" aria-hidden />
        <LoaderCircle size={20} className="absolute -bottom-1 -right-2 animate-spin text-muted" aria-hidden />
      </div>
      <p className="text-lg font-semibold">Allow camera access to take a photo</p>
      <p className="max-w-sm text-sm text-muted">
        Your browser will ask for permission. Photos stay on this device; nothing is uploaded.
      </p>
      <ChoosePhotoButton label="Choose a photo instead" variant="ghost" />
    </div>
  );
}
