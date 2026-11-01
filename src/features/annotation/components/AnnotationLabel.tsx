import type { Rect } from '../lib/geometry';

const FONT_PX = 13;
const PAD_PX = 4;
const CHAR_W = 0.6; // approximate glyph width / font size for system-ui

/** Label rendered in CSS px regardless of image scale; truncated with an ellipsis. */
export function AnnotationLabel({
  rect,
  text,
  scale,
  selected,
}: {
  rect: Rect;
  text: string;
  scale: number;
  selected: boolean;
}) {
  const s = scale || 1;
  const font = FONT_PX / s;
  const pad = PAD_PX / s;
  const height = font + pad * 2;
  const maxChars = Math.max(4, Math.floor((Math.max(rect.width * s, 90) - PAD_PX * 2) / (FONT_PX * CHAR_W)));
  const shown = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  const width = shown.length * font * CHAR_W + pad * 2;
  // Flip inside the box when there's no room above it.
  const y = rect.y - height < 0 ? rect.y : rect.y - height;
  return (
    <g pointerEvents="none" aria-hidden>
      <rect
        x={rect.x}
        y={y}
        width={width}
        height={height}
        rx={3 / s}
        className={selected ? 'fill-annotation-selected' : 'fill-annotation'}
      />
      <text
        x={rect.x + pad}
        y={y + pad + font * 0.82}
        fontSize={font}
        className="fill-slate-950 font-semibold"
        style={{ userSelect: 'none' }}
      >
        {shown}
      </text>
    </g>
  );
}
