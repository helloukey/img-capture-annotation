import { useState } from 'react';
import { useSession } from '@/app/AppContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

/**
 * Deleting a photo (or retaking the only one) is undoable; if it has annotations, the user is
 * asked first and told how many will be lost (FR-018, constitution V).
 */
export function useDeletePhoto(
  copy: { title: string; confirmLabel: string; verb: string } = {
    title: 'Discard annotations?',
    confirmLabel: 'Discard and retake',
    verb: 'Retaking',
  },
) {
  const { deletePhoto, annotationCount } = useSession();
  const [target, setTarget] = useState<{ id: string; count: number } | null>(null);

  const request = (photoId: string) => {
    const count = annotationCount(photoId);
    if (count > 0) setTarget({ id: photoId, count });
    else deletePhoto(photoId);
  };

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      title={copy.title}
      description={
        target
          ? `${copy.verb} will discard ${target.count} annotation${target.count === 1 ? '' : 's'} on this photo.`
          : ''
      }
      confirmLabel={copy.confirmLabel}
      destructive
      onConfirm={() => {
        if (target) deletePhoto(target.id);
        setTarget(null);
      }}
      onCancel={() => setTarget(null)}
    />
  );

  return { request, dialog };
}
