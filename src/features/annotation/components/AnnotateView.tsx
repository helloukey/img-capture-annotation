import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useAppFlow } from '@/app/AppFlowContext';
import type { CapturedImage } from '@/shared/types';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { cn } from '@/shared/ui/cn';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { IconButton } from '@/shared/ui/IconButton';
import { List, SquareDashed, Trash2 } from '@/shared/ui/icons';
import { Sheet } from '@/shared/ui/Sheet';
import { useAnnotations } from '../hooks/useAnnotations';
import { AnnotationCanvas } from './AnnotationCanvas';
import { AnnotationList } from './AnnotationList';
import { AnnotationToolbar } from './AnnotationToolbar';
import { LABEL_INPUT_ID, LabelEditor } from './LabelEditor';

export interface AnnotateViewProps {
  image: CapturedImage;
  quality?: ReactNode;
  toolbarActions?: ReactNode;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]')
  );
}

export function AnnotateView({ image, quality, toolbarActions }: AnnotateViewProps) {
  const { state: flow, dispatch: flowDispatch } = useAppFlow();
  const { state, selected, select, rename, deleteWithUndo, displayName } = useAnnotations();
  const wide = useMediaQuery('(min-width: 768px)');
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const listOpen = wide ? panelOpen : sheetOpen;
  const toggleList = () => (wide ? setPanelOpen((o) => !o) : setSheetOpen((o) => !o));

  // Shortcuts apply while the canvas or list has focus, never while typing (FR-029).
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (isTypingTarget(e.target)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      deleteWithUndo(selected.id);
    } else if (e.key === 'Escape' && state.selectedId) {
      e.preventDefault();
      select(null);
    } else if (e.key === 'Enter' && selected && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      document.getElementById(LABEL_INPUT_ID)?.focus();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- delegated shortcuts for the canvas and list
    <section aria-label="Annotate photo" className="flex h-full flex-col" onKeyDown={onKeyDown}>
      <AnnotationToolbar
        onBack={() => flowDispatch({ type: 'BACK_TO_REVIEW' })}
        onRetake={() => flowDispatch({ type: 'RETAKE' })}
        quality={quality}
        actions={
          <>
            {toolbarActions}
            <button
              type="button"
              onClick={toggleList}
              aria-expanded={listOpen}
              className={cn(
                'relative flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm',
                listOpen && wide ? 'bg-accent/15 text-accent' : 'hover:bg-white/10',
              )}
            >
              <List size={18} aria-hidden />
              <span className="sr-only lg:not-sr-only">Annotations</span>
              <span className="rounded-full bg-surface-overlay px-1.5 text-xs tabular-nums text-slate-200">
                {state.items.length}
              </span>
            </button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1 bg-black/60">
          <AnnotationCanvas image={image} />
        </div>
        {wide && panelOpen && (
          <aside
            aria-label="Annotation list"
            className="flex w-72 shrink-0 flex-col border-l border-border bg-surface-raised p-3 lg:w-80"
          >
            <AnnotationList />
          </aside>
        )}
      </div>

      {!wide && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Annotations">
          <AnnotationList showHeading={false} />
        </Sheet>
      )}

      <div className="safe-bottom safe-x flex shrink-0 items-center gap-2 border-t border-border bg-surface-raised pt-3">
        {selected ? (
          <>
            <LabelEditor
              key={selected.id}
              annotation={selected}
              placeholder={`Label for ${displayName(selected)}`}
              onCommit={(label) => rename(selected.id, label)}
            />
            <IconButton
              aria-label="Delete annotation"
              tone="danger"
              onClick={() => deleteWithUndo(selected.id)}
            >
              <Trash2 size={18} aria-hidden />
            </IconButton>
          </>
        ) : (
          <p className="flex min-h-11 items-center gap-2 text-sm text-muted" aria-live="polite">
            <SquareDashed size={18} aria-hidden />
            {state.items.length === 0
              ? 'Drag on the photo to add a box'
              : 'Drag to add another box, or tap a box to edit it'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={flow.pendingConfirm === 'retake'}
        title="Discard annotations?"
        description={`Retaking will discard ${state.items.length} annotation${state.items.length === 1 ? '' : 's'} on this photo.`}
        confirmLabel="Discard and retake"
        destructive
        onConfirm={() => flowDispatch({ type: 'CONFIRM' })}
        onCancel={() => flowDispatch({ type: 'CANCEL' })}
      />
    </section>
  );
}
