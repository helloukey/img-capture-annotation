import { useState } from 'react';
import { LABEL_MAX_LENGTH, type Annotation } from '../lib/annotationReducer';

export const LABEL_INPUT_ID = 'annotation-label-input';
const COUNTER_FROM = 40;

export interface LabelEditorProps {
  annotation: Annotation;
  placeholder: string;
  onCommit(label: string): void;
}

/** Inline label input; commits on Enter/blur, Escape cancels (FR-025). Remount per annotation. */
export function LabelEditor({ annotation, placeholder, onCommit }: LabelEditorProps) {
  const [value, setValue] = useState(annotation.label);

  const commit = () => {
    if (value.trim() !== annotation.label) onCommit(value);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={LABEL_INPUT_ID} className="sr-only">
        Label
      </label>
      <input
        id={LABEL_INPUT_ID}
        value={value}
        maxLength={LABEL_MAX_LENGTH}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setValue(annotation.label);
            e.currentTarget.blur();
          }
        }}
        className="h-11 w-full rounded-xl border border-border bg-surface px-3 pr-14 text-sm text-slate-100 placeholder:text-muted focus:border-accent"
      />
      {value.length >= COUNTER_FROM && (
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted"
          aria-live="polite"
        >
          {value.length}/{LABEL_MAX_LENGTH}
        </span>
      )}
    </div>
  );
}
