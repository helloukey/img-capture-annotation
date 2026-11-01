import type { Rect } from '../lib/geometry';

export function DraftBox({ rect }: { rect: Rect }) {
  return (
    <rect
      data-testid="draft-box"
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      vectorEffect="non-scaling-stroke"
      strokeWidth={2}
      strokeDasharray="6 4"
      className="fill-annotation/10 stroke-annotation"
      pointerEvents="none"
    />
  );
}
