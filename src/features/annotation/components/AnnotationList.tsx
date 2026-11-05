import { useState } from 'react';
import { useSession } from '@/app/AppContext';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Eraser, SquareDashed } from '@/shared/ui/icons';
import { useAnnotations } from '../hooks/useAnnotations';
import { AnnotationListItem } from './AnnotationListItem';

/** View and manage all annotations; shares the canvas's store (FR-027). */
export function AnnotationList({ showHeading = true }: { showHeading?: boolean }) {
  const multi = useSession().photos.length > 1;
  const { state, select, rename, deleteWithUndo, clearAllWithUndo, displayName } = useAnnotations();
  const [confirmClear, setConfirmClear] = useState(false);
  const n = state.items.length;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className={showHeading ? 'text-sm font-semibold' : 'sr-only'} aria-live="polite">
          {n} annotation{n === 1 ? '' : 's'}
          {multi && ' on this photo'}
        </h2>
        {n > 0 && (
          <Button variant="ghost" className="text-poor" onClick={() => setConfirmClear(true)}>
            <Eraser size={16} aria-hidden /> Clear all
          </Button>
        )}
      </div>

      {n === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          <SquareDashed size={28} aria-hidden />
          Drag on the photo to draw your first box
        </div>
      ) : (
        <ul aria-label="Annotations" className="min-h-0 space-y-1 overflow-y-auto">
          {state.items.map((a) => (
            <AnnotationListItem
              key={`${a.id}:${a.label}`}
              annotation={a}
              name={displayName(a)}
              selected={a.id === state.selectedId}
              onSelect={() => select(a.id)}
              onRename={(label) => rename(a.id, label)}
              onDelete={() => deleteWithUndo(a.id)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear all annotations?"
        description={`This removes all ${n} annotation${n === 1 ? '' : 's'} from the photo. You can undo for a few seconds.`}
        confirmLabel="Clear all annotations"
        destructive
        onConfirm={() => {
          setConfirmClear(false);
          clearAllWithUndo();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
