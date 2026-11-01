import { cn } from '@/shared/ui/cn';
import type { Annotation } from '../lib/annotationReducer';
import { AnnotationLabel } from './AnnotationLabel';

export interface AnnotationBoxProps {
  annotation: Annotation;
  name: string;
  selected: boolean;
  scale: number;
  onFocusBox(id: string): void;
}

export function AnnotationBox({ annotation: a, name, selected, scale, onFocusBox }: AnnotationBoxProps) {
  return (
    <g
      data-annotation-id={a.id}
      role="button"
      tabIndex={0}
      aria-label={`Annotation ${name}`}
      aria-pressed={selected}
      onFocus={() => onFocusBox(a.id)}
      className="cursor-move outline-none"
    >
      <rect
        x={a.x}
        y={a.y}
        width={a.width}
        height={a.height}
        vectorEffect="non-scaling-stroke"
        strokeWidth={selected ? 2.5 : 2}
        className={cn(
          'transition-[fill] duration-100',
          selected
            ? 'fill-annotation-selected/15 stroke-annotation-selected'
            : 'fill-annotation/10 stroke-annotation hover:fill-annotation/20',
        )}
      />
      <AnnotationLabel rect={a} text={name} scale={scale} selected={selected} />
    </g>
  );
}
