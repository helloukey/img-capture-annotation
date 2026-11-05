import { useRef, useState } from 'react';
import { useSession } from '@/app/AppContext';
import { Button, type ButtonVariant } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { ImageUp, LoaderCircle } from '@/shared/ui/icons';
import { notify } from '@/shared/ui/toast';
import { fileToCapturedImage, UploadError } from '../lib/fileToCapturedImage';

export interface ChoosePhotoButtonProps {
  label?: string;
  /** Render as a round overlay icon button (camera control bar). */
  iconOnly?: boolean;
  variant?: ButtonVariant;
  className?: string;
}

/** Upload fallback whenever live capture is unavailable (FR-012). */
export function ChoosePhotoButton({
  label = 'Choose a photo',
  iconOnly = false,
  variant = 'secondary',
  className,
}: ChoosePhotoButtonProps) {
  const { addPhotos } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const image = await fileToCapturedImage(file);
      addPhotos([image]);
    } catch (err) {
      notify.error(err instanceof UploadError ? err.message : 'That file couldn’t be opened as an image.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="choose-photo-input"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {iconOnly ? (
        <IconButton
          aria-label={label}
          tone="overlay"
          size="lg"
          className={className}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle size={20} className="animate-spin" aria-hidden />
          ) : (
            <ImageUp size={20} aria-hidden />
          )}
        </IconButton>
      ) : (
        <Button
          variant={variant}
          className={className}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle size={18} className="animate-spin" aria-hidden />
          ) : (
            <ImageUp size={18} aria-hidden />
          )}
          {label}
        </Button>
      )}
    </>
  );
}
