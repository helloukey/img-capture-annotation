// The ONLY module allowed to import sonner (Constitution VI): swap the toast library here.
import { toast } from 'sonner';

export interface UndoOptions {
  durationMs?: number;
  onDismiss?: () => void;
}

export const notify = {
  success(message: string) {
    toast.success(message);
  },
  error(message: string, description?: string) {
    toast.error(message, description ? { description } : undefined);
  },
  info(message: string) {
    toast(message);
  },
  /** A toast with an Undo action. `onDismiss` fires when it closes without Undo being pressed. */
  undo(message: string, onUndo: () => void, { durationMs = 5000, onDismiss }: UndoOptions = {}) {
    let undone = false;
    toast(message, {
      duration: durationMs,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          onUndo();
        },
      },
      onDismiss: () => {
        if (!undone) onDismiss?.();
      },
      onAutoClose: () => {
        if (!undone) onDismiss?.();
      },
    });
  },
};
