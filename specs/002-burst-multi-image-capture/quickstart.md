# Quickstart & Validation Guide: Burst Capture & Multi-Image Sessions

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[session-store](./contracts/session-store.md), [burst](./contracts/burst.md),
[photo-processing-and-strip](./contracts/photo-processing-and-strip.md)

Setup and quality gates are the same as in [feature 001's quickstart](../001-image-capture-annotation/quickstart.md):
`npm install`, `npm run dev` (or `dev:https` for phones), `npm run lint`, `npm run typecheck`,
`npm test`, `npm run test:e2e`, `npm run build`.

**Additional gate:** every feature 001 test still passes (SC-009). The only exceptions are tests
that assumed a one-photo session, which are updated rather than deleted.

## Validation scenarios

| # | Story | Steps | Expected |
|---|---|---|---|
| B1 | US1 Tap | Tap the shutter 20 times in a row (Retake between taps) | Exactly 1 photo each time (SC-002) |
| B2 | US1 Hold | Phone: hold the shutter for about 2 s, then release | A counter and ring appear during the hold. Review shows about 5–7 photos, each with its own resolution (the stream resolution, for example 3840 × 2160) |
| B3 | US1 Limits | Hold for more than 3 s | The burst stops at 3 s or 10 photos with a "Burst limit reached" toast (SC-004) |
| B4 | US1 Long-press | Hold for about 3 s on Android and iOS | No context menu, text selection or save-image prompt appears |
| B5 | US1 Stop reasons | Hold, then (a) slide the finger off the shutter while still pressing, then release; (b) switch apps; (c) unplug a USB webcam on desktop | (a) The burst continues until release; (b) and (c) stop it, keep the photos, and give the matching reason |
| B6 | US2 Strip | After a 6-photo burst, select each thumbnail | The large view and quality panel switch within 0.1 s. Quality dots fill in one by one (SC-006) |
| B7 | US2 Delete | Delete 2 photos, then press Undo on the second toast | 5 photos remain, and the restored one is back in its original position |
| B8 | US2 Delete annotated | Annotate a photo, return to Review, delete it | A confirmation says "1 annotation will be lost"; Undo restores the photo and its box |
| B9 | US2 Add more / Start over | Add more, take 2 single photos; then Start over: cancel once, then confirm | The session grows by 2; Start over always asks "Discard all N photos…?"; cancel keeps everything, confirm clears it and opens the camera |
| B10 | US3 Isolation | Draw 2 boxes on photo 1 and 1 box on photo 2, switch back and forth, resize the window | Each photo shows only its own boxes, aligned; the strip shows counts 2 and 1 (SC-007) |
| B11 | US3 Undo across switch | Delete a box on photo 1, switch to photo 2, press Undo | The box returns on photo 1, not photo 2 |
| B12 | US4 Session full | Take bursts until 20 photos | The last burst stops with "Session full"; the shutter and Burst button are disabled with the message. Delete 3 photos and the shutter works again |
| B13 | US4 Smoothness | On a mid-range phone, fill the session through bursts | The preview never freezes, the tab never reloads, and the shutter responds to release within 0.2 s (SC-003, SC-005) |
| B14 | US5 Keyboard | Tab to the Burst button and press Enter; press Enter again after 1 s | The burst starts, then stops early; a screen reader announces "Burst: N photos" |
| B15 | US6 Multi-upload | Choose 4 images plus 1 PDF | 4 photos are added; the toast says "1 skipped: not an image" |
| B16 | Compatibility | Tap once and annotate | It looks like feature 001: no strip, Retake and Use Photo, plus a small "Add more" link |

## Automated coverage map

| Area | Tests |
|---|---|
| Scheduler limits, cadence, sequencing, stop reasons | `burstScheduler.test.ts` (fake timers) |
| Session reducer: add, delete, undo, finalize, start over, routing | `appReducer.test.ts` |
| Processor: order, pause, single decode, release | `photoProcessor.test.ts` |
| Shutter tap and hold, `contextmenu` prevented, first pointer only | `ShutterButton.test.tsx` |
| Strip keyboard, names, delete | `PhotoStrip.test.tsx` |
| Per-photo isolation and undo across a switch | `AnnotateView.multi.test.tsx` |
| End to end: hold, tap, delete with undo, isolation, session full | `tests/e2e/burst.spec.ts` |
