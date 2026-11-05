import { useRef, useState } from 'react';
import { useApp, useSession } from '@/app/AppContext';
import { Button, type ButtonVariant } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { ImageUp, LoaderCircle } from '@/shared/ui/icons';
import { notify } from '@/shared/ui/toast';
import { fileToCapturedImage } from '../lib/fileToCapturedImage';
import { importPhotos, importSummary } from '../lib/importPhotos';

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
  const { stateRef } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    setBusy(true);
    try {
      const { photos, skipped } = await importPhotos(files, stateRef.current.session, fileToCapturedImage);
      const result = addPhotos(photos);
      skipped.sessionFull += result.reason === 'count' ? result.skipped : 0;
      skipped.memory += result.reason === 'memory' ? result.skipped : 0;
      const summary = importSummary(result.added, skipped);
      if (summary) (result.added ? notify.info : notify.error)(summary);
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
        multiple
        className="hidden"
        data-testid="choose-photo-input"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onFiles(e.target.files)}
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
