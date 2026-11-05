import { useState } from 'react';
import { useSession } from '@/app/AppContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

/** "Start over" discards the whole session and can't be undone, so it is always confirmed (FR-020, constitution V). */
export function useStartOver() {
  const { photos, totalAnnotations, startOver } = useSession();
  const [open, setOpen] = useState(false);
  const n = photos.length;
  const notes = totalAnnotations
    ? ` and ${totalAnnotations} annotation${totalAnnotations === 1 ? '' : 's'}`
    : '';
  const dialog = (
    <ConfirmDialog
      open={open}
      title={`Discard all ${n} photos?`}
      description={`This removes all ${n} photos${notes}. This can’t be undone.`}
      confirmLabel="Discard all"
      destructive
      onConfirm={() => {
        setOpen(false);
        startOver();
      }}
      onCancel={() => setOpen(false)}
    />
  );
  return { request: () => setOpen(true), dialog };
}
