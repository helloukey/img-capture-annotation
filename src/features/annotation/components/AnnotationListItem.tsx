import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/ui/cn';
import { IconButton } from '@/shared/ui/IconButton';
import { Trash2 } from '@/shared/ui/icons';
import { LABEL_MAX_LENGTH, type Annotation } from '../lib/annotationReducer';

export interface AnnotationListItemProps {
  annotation: Annotation;
  name: string;
  selected: boolean;
  onSelect(): void;
  onRename(label: string): void;
  onDelete(): void;
}

export function AnnotationListItem({
  annotation,
  name,
  selected,
  onSelect,
  onRename,
  onDelete,
}: AnnotationListItemProps) {
  const row = useRef<HTMLLIElement>(null);
  const [value, setValue] = useState(annotation.label);

  useEffect(() => {
    if (selected) row.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const commit = () => {
    if (value.trim() !== annotation.label) onRename(value);
  };

  return (
    <li
      ref={row}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors',
        selected
          ? 'border-annotation-selected/70 bg-annotation-selected/10'
          : 'border-transparent hover:bg-white/5',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Select ${name}`}
        onClick={onSelect}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
      >
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border-2 text-xs font-bold tabular-nums',
            selected
              ? 'border-annotation-selected text-annotation-selected'
              : 'border-annotation text-annotation',
          )}
        >
          {annotation.ordinal}
        </span>
      </button>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Label for annotation {annotation.ordinal}</span>
        <input
          value={value}
          maxLength={LABEL_MAX_LENGTH}
          placeholder={`Untitled ${annotation.ordinal}`}
          autoComplete="off"
          enterKeyHint="done"
          onFocus={onSelect}
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
          title={name}
          className="h-10 w-full truncate rounded-lg border border-transparent bg-transparent px-2 text-sm placeholder:text-muted hover:border-border focus:border-accent focus:bg-surface"
        />
      </label>
      <IconButton
        aria-label={`Delete ${name}`}
        tone="danger"
        onClick={onDelete}
        className="border-transparent bg-transparent"
      >
        <Trash2 size={16} aria-hidden />
      </IconButton>
    </li>
  );
}
