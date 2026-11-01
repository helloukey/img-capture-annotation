// Pure annotation geometry. All rects are in intrinsic image pixels (Constitution IV).

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const CORNER_HANDLES: readonly Handle[] = ['nw', 'ne', 'se', 'sw'];

/** A box is never smaller than this on screen (FR-023). */
export const MIN_BOX_SCREEN_PX = 24;
/** Visible handle size and touch hit area, in CSS px (FR-031). */
export const HANDLE_VISUAL_PX = 12;
export const HANDLE_HIT_PX = 44;
/** Below this on-screen size, only corner handles are drawn, outside the box. */
export const SMALL_BOX_PX = 88;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function clientToImage(client: Point, display: ClientRectLike, natural: Size): Point {
  return {
    x: ((client.x - display.left) * natural.width) / display.width,
    y: ((client.y - display.top) * natural.height) / display.height,
  };
}

export function imageToClient(p: Point, display: ClientRectLike, natural: Size): Point {
  return {
    x: display.left + (p.x * display.width) / natural.width,
    y: display.top + (p.y * display.height) / natural.height,
  };
}

/** CSS px per image px. */
export function displayScale(display: ClientRectLike, natural: Size): number {
  return natural.width > 0 ? display.width / natural.width : 1;
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function clampRect(r: Rect, bounds: Size): Rect {
  const width = clamp(r.width, 0, bounds.width);
  const height = clamp(r.height, 0, bounds.height);
  return {
    x: clamp(r.x, 0, bounds.width - width),
    y: clamp(r.y, 0, bounds.height - height),
    width,
    height,
  };
}

export function moveRect(r: Rect, dx: number, dy: number, bounds: Size): Rect {
  return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, bounds);
}

/** Resolves one axis of a resize: `fixed` stays put, `moving` follows the pointer. */
function resolveAxis(fixed: number, moving: number, min: number, limit: number): [number, number] {
  let lo: number;
  let hi: number;
  if (moving >= fixed) {
    lo = fixed;
    hi = Math.max(moving, fixed + min);
  } else {
    lo = Math.min(moving, fixed - min);
    hi = fixed;
  }
  // Keep inside the image, preserving the minimum span.
  if (lo < 0) {
    lo = 0;
    hi = Math.max(hi, min);
  }
  if (hi > limit) {
    hi = limit;
    lo = Math.min(lo, limit - min);
  }
  return [lo, hi];
}

export function resizeRect(r: Rect, handle: Handle, to: Point, bounds: Size, minSize: number): Rect {
  const minW = Math.min(minSize, bounds.width);
  const minH = Math.min(minSize, bounds.height);
  const p = { x: clamp(to.x, 0, bounds.width), y: clamp(to.y, 0, bounds.height) };
  let left = r.x;
  let right = r.x + r.width;
  let top = r.y;
  let bottom = r.y + r.height;

  if (handle.includes('e')) [left, right] = resolveAxis(r.x, p.x, minW, bounds.width);
  else if (handle.includes('w')) [left, right] = resolveAxis(r.x + r.width, p.x, minW, bounds.width);
  else if (r.width < minW) [left, right] = resolveAxis(r.x, r.x + r.width, minW, bounds.width);

  if (handle.includes('s')) [top, bottom] = resolveAxis(r.y, p.y, minH, bounds.height);
  else if (handle.includes('n')) [top, bottom] = resolveAxis(r.y + r.height, p.y, minH, bounds.height);
  else if (r.height < minH) [top, bottom] = resolveAxis(r.y, r.y + r.height, minH, bounds.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** max(1% of the image's shorter side, 24 CSS px expressed in image units), capped at the image. */
export function minBoxSize(natural: Size, scale: number): number {
  const shorter = Math.min(natural.width, natural.height);
  const screenMin = scale > 0 ? MIN_BOX_SCREEN_PX / scale : 0;
  return Math.min(Math.max(0.01 * shorter, screenMin), shorter);
}

export function isBelowMin(r: Rect, minSize: number): boolean {
  return r.width < minSize || r.height < minSize;
}

export function containsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Topmost box at a point: the selected one if it contains p, else the smallest containing p. */
export function hitTest(
  p: Point,
  items: readonly (Rect & { id: string })[],
  selectedId: string | null,
): string | null {
  const hits = items.filter((r) => containsPoint(r, p));
  if (hits.length === 0) return null;
  if (selectedId && hits.some((h) => h.id === selectedId)) return selectedId;
  return hits.reduce((best, r) => (r.width * r.height < best.width * best.height ? r : best)).id;
}

/** Handle anchor point on a rect. */
export function handlePosition(r: Rect, handle: Handle): Point {
  const x = handle.includes('w') ? r.x : handle.includes('e') ? r.x + r.width : r.x + r.width / 2;
  const y = handle.includes('n') ? r.y : handle.includes('s') ? r.y + r.height : r.y + r.height / 2;
  return { x, y };
}

export const HANDLE_CURSORS: Record<Handle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};
