import {
  CORNER_HANDLES,
  HANDLE_CURSORS,
  HANDLE_HIT_PX,
  HANDLE_VISUAL_PX,
  HANDLES,
  handlePosition,
  SMALL_BOX_PX,
  type Rect,
} from '../lib/geometry';

/**
 * 8 handles: 12 CSS px visible, 44 CSS px hit area (FR-031). Small boxes get only corner handles
 * placed OUTSIDE the box so the body stays draggable (contracts/annotation-store.md).
 */
export function ResizeHandles({ id, rect, scale }: { id: string; rect: Rect; scale: number }) {
  const s = scale || 1;
  const hit = HANDLE_HIT_PX / s;
  const visual = HANDLE_VISUAL_PX / s;
  const small = rect.width * s < SMALL_BOX_PX || rect.height * s < SMALL_BOX_PX;
  const handles = small ? CORNER_HANDLES : HANDLES;

  return (
    <g data-testid="resize-handles">
      {handles.map((handle) => {
        const p = handlePosition(rect, handle);
        const hx = small ? (handle.includes('w') ? p.x - hit : p.x) : p.x - hit / 2;
        const hy = small ? (handle.includes('n') ? p.y - hit : p.y) : p.y - hit / 2;
        return (
          <g
            key={handle}
            data-handle={handle}
            data-annotation-id={id}
            style={{ cursor: HANDLE_CURSORS[handle] }}
            aria-hidden
          >
            <rect x={hx} y={hy} width={hit} height={hit} fill="transparent" />
            <rect
              x={p.x - visual / 2}
              y={p.y - visual / 2}
              width={visual}
              height={visual}
              rx={visual / 4}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
              className="fill-white stroke-annotation-selected"
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}
