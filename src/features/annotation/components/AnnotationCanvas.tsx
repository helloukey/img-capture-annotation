import { useCallback, useEffect, useRef } from 'react';
import type { CapturedImage } from '@/shared/types';
import { useAnnotations } from '../hooks/useAnnotations';
import { useDisplayScale } from '../hooks/useDisplayScale';
import { usePointerGesture } from '../hooks/usePointerGesture';
import { minBoxSize } from '../lib/geometry';
import { AnnotationBox } from './AnnotationBox';
import { DraftBox } from './DraftBox';
import { ResizeHandles } from './ResizeHandles';

/**
 * The photo plus an SVG overlay whose viewBox equals the image's intrinsic size. Boxes are drawn in
 * image pixels, so the browser's viewBox transform keeps them aligned at any display size (R6).
 */
export function AnnotationCanvas({ image }: { image: CapturedImage }) {
  const { state, selected, create, select, dispatch, displayName } = useAnnotations();
  const natural = { width: image.width, height: image.height };
  const cancelRef = useRef<() => void>(() => {});
  // A layout change mid-drag would make the in-progress pointer math stale: abandon it (T055).
  const onLayoutChange = useCallback(() => cancelRef.current(), []);
  const { ref, scale } = useDisplayScale<SVGSVGElement>(natural, onLayoutChange);
  const minSize = minBoxSize(natural, scale);

  const gesture = usePointerGesture({
    natural,
    minSize,
    items: state.items,
    onCreate: create,
    onUpdate: (id, rect) => dispatch({ type: 'UPDATE_RECT', id, rect }),
    onSelect: select,
  });
  useEffect(() => {
    cancelRef.current = gesture.cancel;
  }, [gesture.cancel]);

  const { draft, preview } = gesture;
  const selectedRect = selected ? (preview?.id === selected.id ? preview.rect : selected) : null;

  return (
    <div
      className="flex h-full w-full items-center justify-center p-4 sm:p-6"
      style={{ containerType: 'size' }}
    >
      <div
        data-testid="annotation-stage"
        className="relative select-none"
        style={{
          aspectRatio: `${image.width} / ${image.height}`,
          width: `min(100cqw, calc(100cqh * ${image.width / image.height}))`,
        }}
      >
        <img
          src={image.objectUrl}
          alt="Your capture"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full rounded-sm object-fill"
        />
        <svg
          ref={ref}
          data-testid="annotation-surface"
          role="group"
          aria-label="Annotation canvas. Drag on the photo to draw a box."
          tabIndex={-1}
          viewBox={`0 0 ${image.width} ${image.height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full cursor-crosshair overflow-visible outline-none"
          style={{ touchAction: 'none' }}
          {...gesture.handlers}
        >
          {state.items.map((a) => {
            const shown = preview?.id === a.id ? { ...a, ...preview.rect } : a;
            return (
              <AnnotationBox
                key={a.id}
                annotation={shown}
                name={displayName(a)}
                selected={a.id === state.selectedId}
                scale={scale}
                onFocusBox={select}
              />
            );
          })}
          {selected && selectedRect && <ResizeHandles id={selected.id} rect={selectedRect} scale={scale} />}
          {draft && <DraftBox rect={draft} />}
        </svg>
      </div>
    </div>
  );
}
