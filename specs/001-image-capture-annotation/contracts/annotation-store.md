# Contract: Annotation Store, Geometry & Canvas

**Module**: `src/features/annotation/` · **Implements**: FR-021–FR-029, US2/US3/US7 ·
**Research**: R6, R7

## Geometry (`lib/geometry.ts`, pure)

```ts
interface Point { x: number; y: number }          // image px unless noted
interface Rect  { x: number; y: number; width: number; height: number }
interface Size  { width: number; height: number }
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

clientToImage(client: Point, displayRect: DOMRectReadOnly, natural: Size): Point;
imageToClient(p: Point, displayRect: DOMRectReadOnly, natural: Size): Point;
displayScale(displayRect: DOMRectReadOnly, natural: Size): number; // CSS px per image px

rectFromPoints(a: Point, b: Point): Rect;           // normalized (positive w/h)
clampRect(r: Rect, bounds: Size): Rect;             // fully inside the image
moveRect(r: Rect, dx: number, dy: number, bounds: Size): Rect; // keeps size, clamps
resizeRect(r: Rect, handle: Handle, to: Point, bounds: Size, minSize: number): Rect;
minBoxSize(natural: Size, scale: number): number;   // data-model §3
isBelowMin(r: Rect, minSize: number): boolean;
hitTest(p: Point, items: Annotation[], selectedId: string | null): string | null;
  // topmost = selected first, then smallest area containing p
```

**Invariants** (property-tested over random inputs):
`clientToImage(imageToClient(p)) ≈ p`; every output of `clampRect`, `moveRect` and `resizeRect`
lies within the bounds and has width and height of at least `minSize` (when the bounds allow
it); and the output of `resizeRect` never has negative dimensions, even when the user drags past
the opposite edge (the box flips and is normalized).

## Reducer (`lib/annotationReducer.ts`, pure)

```ts
type AnnotationAction =
  | { type: "RESET"; imageId: string }
  | { type: "CREATE"; rect: Rect }                       // selects the new item
  | { type: "UPDATE_RECT"; id: string; rect: Rect }
  | { type: "RENAME"; id: string; label: string }        // trimmed, sliced to 50
  | { type: "SELECT"; id: string | null }
  | { type: "DELETE"; id: string }                       // sets lastDeleted
  | { type: "CLEAR_ALL" }                                // sets lastDeleted (all)
  | { type: "UNDO_DELETE" }                              // restores at original indices
  | { type: "DISMISS_UNDO" };
```

**Rules**: An unknown id is a no-op that returns the same state object. `DELETE` of the selected
item clears `selectedId`. `UNDO_DELETE` with no `lastDeleted` is a no-op. `CREATE` assigns the
`ordinal` from `nextOrdinal` and then increments it.

## Context & hooks

```ts
<AnnotationProvider imageId={string}>         // RESET on imageId change; mounted in App, keyed by image.id
                                              // (NOT inside AnnotateView) so annotations survive Back to review
useAnnotations(): { state: AnnotationState; dispatch: Dispatch<AnnotationAction>;
                    selected: Annotation | null; displayName(a: Annotation): string };
```

## Canvas component contract (`<AnnotationCanvas image={CapturedImage} />`)

- **DOM**: The wrapper has `style="aspect-ratio: W / H"` with `max-width: 100%` and `max-height:
  100%`. Inside it, an `<img>` and an `<svg viewBox="0 0 W H" preserveAspectRatio="none">` both
  fill the wrapper (research R6).
- **Pointer handling** (on the SVG, `touch-action: none`):
  - `pointerdown` on an empty area → start a draft (there is no mode toggle). `pointermove` →
    update the draft. `pointerup` → `CREATE`, unless the draft is below `minSize`. In that case it
    is a tap, and a tap on an empty area → `SELECT(null)`.
  - `pointerdown` on a box → `SELECT` it. Dragging the box body → `UPDATE_RECT` via `moveRect`.
  - `pointerdown` on a handle (selected box only) → resize via `resizeRect`.
  - A second simultaneous pointer → cancel the in-progress gesture and restore the original
    rectangle.
  - `pointercancel` → cancel the gesture.
  - During a drag, the rectangle is held in local state and committed to the store on
    `pointerup`. This keeps 60 fps and avoids a reducer call on every move.
- **Handles**: 8 per selected box. The visual size is 12 CSS px and the hit area is 44 CSS px,
  computed as `44 / displayScale` in image units.
- **Small boxes**: When the box is under 88 CSS px on either axis, render only the 4 corner
  handles and centre their hit areas *outside* the box corners. The box body always takes
  precedence over handles inside the box, so even a box at the 24 px minimum can still be moved.
- **Labels**: Rendered as SVG `<text>` sized in CSS px (`fontSize = 14 / scale`), truncated with
  an ellipsis, and flipped inside the box when the box touches the top edge.
- **Keyboard** (when the canvas or list has focus): Shortcuts MUST be ignored when
  `event.target` is an `input`, a `textarea`, or `contenteditable`, so that typing in the label or
  rename field never deletes a box. `Delete`/`Backspace` → `DELETE` the selected box; `Escape` → deselect; `Enter` → focus the label editor; `Tab` cycles boxes in creation
  order. Each `<g role="button" aria-label="Annotation {name}">` is focusable.
- **Feedback**: Deleting shows a toast via `notify.undo` (the `src/shared/ui/toast.ts` wrapper) reading "Annotation deleted" with an **Undo** action for
  5 s → `UNDO_DELETE`.

## List component contract (`<AnnotationList />`)

- Rows appear in creation order and show the name (or `Untitled {n}`), an inline rename field
  (50-character limit, with a counter shown near the limit), and a delete button. The header
  shows the count and "Clear all", which opens a Radix confirm dialog.
- Selection is synchronized both ways with the canvas, and the selected row scrolls into view.
- The empty state reads "Drag on the photo to draw your first box".
- Layout: below 768 px it is a dismissible bottom sheet; at 768 px and above it is a side panel.
