// Burst and session limits: the single source of truth for constitution Principle VIII.
// Change these only by amending the constitution (data-model.md §1).

/** A press of this long or shorter is a tap (one photo); longer starts a burst (FR-001/FR-002). */
export const TAP_THRESHOLD_MS = 300;
/** Target gap between burst frame starts: about 3 photos per second (FR-002). */
export const BURST_INTERVAL_MS = 333;
/** Longest a burst may run (FR-010). */
export const BURST_MAX_MS = 3000;
/** Most photos one burst may take (FR-011). */
export const BURST_MAX_FRAMES = 10;
/** Most photos a session may hold (FR-012). */
export const SESSION_MAX_PHOTOS = 20;
/** Most encoded image bytes a session may hold, including photos inside their undo window (FR-013). */
export const SESSION_MAX_BYTES = 150_000_000;
/** Size estimate for the next frame before any frame of the burst exists (research R3). */
export const FIRST_FRAME_ESTIMATE_BYTES = 4_000_000;
/** Long side of strip thumbnails, in pixels (research R5). */
export const THUMBNAIL_LONG_SIDE = 160;
/** How long a deleted photo or annotation can be restored (shared with feature 001). */
export const UNDO_WINDOW_MS = 5000;
