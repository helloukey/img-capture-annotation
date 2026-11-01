import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clampRect,
  clientToImage,
  isBelowMin,
  moveRect,
  rectFromPoints,
  resizeRect,
  type Handle,
  type Point,
  type Rect,
  type Size,
} from '../lib/geometry';

/** Screen distance a press must travel before it counts as a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 4;

type Gesture =
  | { kind: 'draw'; pointerId: number; start: Point }
  | {
      kind: 'move';
      pointerId: number;
      id: string;
      start: Point;
      startClient: Point;
      origin: Rect;
      dragging: boolean;
    }
  | { kind: 'resize'; pointerId: number; id: string; handle: Handle; origin: Rect };

export interface PointerGestureOptions {
  natural: Size;
  minSize: number;
  items: readonly (Rect & { id: string })[];
  onCreate(rect: Rect): void;
  onUpdate(id: string, rect: Rect): void;
  onSelect(id: string | null): void;
}

export interface LivePreview {
  id: string;
  rect: Rect;
}

/**
 * Unified mouse/touch/pen editing via Pointer Events (research R6). The in-progress rect lives in
 * local state and is committed on pointerup, keeping drags at 60 fps.
 */
export function usePointerGesture({
  natural,
  minSize,
  items,
  onCreate,
  onUpdate,
  onSelect,
}: PointerGestureOptions) {
  const gesture = useRef<Gesture | null>(null);
  const activePointers = useRef(new Set<number>());
  const [draft, setDraft] = useState<Rect | null>(null);
  const [preview, setPreview] = useState<LivePreview | null>(null);

  const toImage = (e: ReactPointerEvent<Element>): Point =>
    clientToImage({ x: e.clientX, y: e.clientY }, e.currentTarget.getBoundingClientRect(), natural);

  /** Abandons the current gesture and restores the original geometry. */
  const cancel = useCallback(() => {
    gesture.current = null;
    setDraft(null);
    setPreview(null);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1) {
      // A second finger means pinch/scroll intent: never create or change boxes.
      cancel();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });

    const target = e.target as Element;
    const handleEl = target.closest('[data-handle]');
    const boxEl = target.closest('[data-annotation-id]');
    const p = toImage(e);
    const box = (id: string | null) => (id ? items.find((a) => a.id === id) : undefined);

    if (handleEl) {
      const id = handleEl.getAttribute('data-annotation-id');
      const origin = box(id);
      if (id && origin) {
        gesture.current = {
          kind: 'resize',
          pointerId: e.pointerId,
          id,
          handle: handleEl.getAttribute('data-handle') as Handle,
          origin,
        };
      }
    } else if (boxEl) {
      const id = boxEl.getAttribute('data-annotation-id');
      const origin = box(id);
      if (id && origin) {
        onSelect(id);
        gesture.current = {
          kind: 'move',
          pointerId: e.pointerId,
          id,
          start: p,
          startClient: { x: e.clientX, y: e.clientY },
          origin,
          dragging: false,
        };
      }
    } else {
      gesture.current = { kind: 'draw', pointerId: e.pointerId, start: p };
    }

    if (gesture.current) e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const p = toImage(e);
    if (g.kind === 'draw') {
      setDraft(clampRect(rectFromPoints(g.start, p), natural));
    } else if (g.kind === 'move') {
      if (!g.dragging) {
        const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
        if (moved < DRAG_THRESHOLD_PX) return;
        g.dragging = true;
      }
      setPreview({ id: g.id, rect: moveRect(g.origin, p.x - g.start.x, p.y - g.start.y, natural) });
    } else {
      setPreview({ id: g.id, rect: resizeRect(g.origin, g.handle, p, natural, minSize) });
    }
  };

  const finish = (e: ReactPointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.kind === 'draw') {
      if (draft && !isBelowMin(draft, minSize)) onCreate(draft);
      else onSelect(null); // a tap on empty space deselects
    } else if (preview && preview.id === g.id && (g.kind === 'resize' || g.dragging)) {
      onUpdate(g.id, preview.rect);
    }
    cancel();
  };

  const onPointerCancel = (e: ReactPointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);
    cancel();
  };

  return {
    draft,
    preview,
    cancel,
    isActive: () => gesture.current !== null,
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel },
  };
}
