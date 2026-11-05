# Implementation Plan: Burst Capture & Multi-Image Sessions

**Branch**: `002-burst-multi-image-capture` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-burst-multi-image-capture/spec.md`

## Summary

This plan turns the one-photo flow from feature 001 into a **session of up to 20 photos**. It
has four parts.

**1. Session store.** A root `appReducer` (step plus session) is mounted above every screen, so
the session survives "Add more" trips back to the camera.
- Each photo owns an annotation slice driven by feature 001's unchanged `annotationReducer`. The
  existing canvas, list, shortcuts and export work per photo through a thin adapter.
- Deleting a photo is undoable for 5 s and takes its annotations with it.
- Memory is released when a deletion becomes final or the session is cleared.

**2. Burst capture.** A pure, sequential `burstScheduler` drives it.
- A press of 300 ms or less is a single capture (feature 001's `takePhoto()` path, unchanged).
- Holding longer captures full-stream-resolution canvas frames at about 3 fps. The next frame
  starts only after the previous one finishes encoding.
- The burst stops at 3 s, 10 frames, 20 photos in the session, or 150 MB, or when the user
  releases, the app is hidden, or the camera is interrupted. The user is told which.
- A `BurstButton` offers a burst that doesn't need holding.

**3. Background processing.** A `photoProcessor` decodes each photo **once**, after the burst and
one photo at a time (selected photo first). That decode produces both the quality metrics and a
160 px thumbnail, so the shared `PhotoStrip` never renders full-resolution images.

**4. Review and Annotate** gain the strip, per-photo delete, Add more and Start over. A one-photo
session keeps feature 001's look.

## Technical Context

**Language/Version**: TypeScript 6 (strict), React 19, Vite 8. These are unchanged from
feature 001.

**Primary Dependencies**: The existing ones only (Radix wrappers, Sonner via `notify`, lucide via
`icons.ts`, Tailwind v4). **No new runtime dependencies.**

**Storage**: N/A. The session lives in memory, and object URLs are revoked on final delete, start
over and unmount.

**Testing**: Vitest + RTL with fake timers (scheduler) and fake decoders (processor), and
Playwright with the fake camera (hold, tap, delete, isolation, session full).

**Target Platform**: The same as feature 001: Chrome for Android and desktop, Safari on iOS 17 and
later, all in a secure context.

**Project Type**: Single-project frontend SPA (extends feature 001's layout).

**Performance Goals**:
- About 3 fps burst cadence.
- No main-thread task over about 50 ms during a burst.
- The preview never visibly freezes.
- Strip selection updates within 0.1 s.
- Release responds within 0.2 s.

**Constraints**: Constitution VIII hard caps (3 s, 10 frames per burst, 20 photos, 150 MB held,
sequential capture, no pixel analysis during a burst), constitution II as amended (burst frames
at stream resolution), and feature 001 behavior unchanged for a single tap.

**Scale/Scope**: At most 20 photos per session, about 15 new or changed modules, and 3 screens
updated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.1.0.

| Principle | Gate | Pre | Post | Evidence |
|---|---|---|---|---|
| I. Core First | Enhancements tagged; core not regressed; a tap stays a single capture | ✅ | ✅ | Every spec story is `enhancement`. The tap path calls the unchanged `capture()` (burst contract). FR-032 and R10 keep the one-photo look. SC-009 requires all feature 001 tests to pass. |
| II. Capture Fidelity | Single captures use `takePhoto()`; burst frames at full stream resolution; truthful per-photo resolution | ✅ | ✅ | R4: `captureFrame()` uses a canvas at `videoWidth × videoHeight` and records its size. The `captureMethod: 'burst'` tag and per-photo quality panel show the actual resolution. |
| III. Truthful State | Stream released after the burst; burst stops on release, cancel, hide, interrupt or limit; reason shown | ✅ | ✅ | Burst contract: stops and stop-reason copy table, `camera.stop()` after the burst settles, torch reset on stop (feature 001's `useTorch`). Error boundaries are unchanged per step. |
| IV. Resolution-Independent Annotations | One photo per annotation; isolation; deleting a photo deletes its annotations | ✅ | ✅ | R2: `annotations: Record<photoId, AnnotationState>`, with routing by `photoId`. Undo captures the `photoId`. Each photo's geometry is in its own intrinsic pixels (feature 001's SVG `viewBox` per photo). |
| V. Touch-First UX | One Pointer Events path; 300 ms threshold; long-press suppressed; counter and progress; keyboard burst; delete safety | ✅ | ✅ | R7 and R8: `ShutterButton` handlers with `contextmenu` prevented and `touch-callout: none`, `BurstProgress`, `BurstButton` with an accessible name and live region, confirm-or-undo on photo delete, a 56 px strip with a roving tabindex. |
| VI. Modular, Testable | Scheduler and limits pure; media APIs only in hooks; libraries wrapped | ✅ | ✅ | `session/lib/{limits,burstScheduler,sessionSelectors,photoProcessor}` are React-free (lint rule). `captureFrame` lives in `useCamera`. Toasts go through `notify`, icons through `icons.ts`. |
| VII. Documented Decisions | README and technical notes updated | ✅ | ✅ | Plan phase "Docs" updates the README (feature, limits, single-photo "Add more" note, known limitations) and TECHNICAL_NOTES (burst strategy, processor, memory accounting). |
| VIII. Burst Resource Safety | Caps as constants; sequential; no analysis during a burst; main-thread budget; release | ✅ | ✅ | Data model §1 (`limits.ts`). Scheduler guarantees 1–6. The processor pauses during a burst, decodes once, and releases on finalize. Canvas `toBlob` encoding is asynchronous; R4 records a worker fallback if profiling shows jank. |
| Tech constraints | Quality indicator per visible photo; lazy per-photo analysis; thumbnails | ✅ | ✅ | R5: `useQualityAssessment` is backed by the processor (selected photo first); the strip uses 160 px thumbnails. |
| Workflow gates | New required tests; Check against I–VIII | ✅ | ✅ | R12 and the quickstart coverage map list every required test category. |

**Result**: PASS. There are no violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-burst-multi-image-capture/
├── plan.md              # This file
├── research.md          # R1–R12
├── data-model.md        # limits, Photo, SessionState, Burst, PhotoProcessing
├── quickstart.md        # B1–B16 + automated coverage map
├── contracts/
│   ├── session-store.md
│   ├── burst.md
│   └── photo-processing-and-strip.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (changes to the feature 001 layout)

```text
src/
├── app/
│   ├── appReducer.ts            # NEW: replaces appFlowReducer.ts (step + session; routes ANNOTATION)
│   ├── appReducer.test.ts       # NEW: replaces appFlowReducer.test.ts
│   ├── AppContext.tsx           # NEW: replaces AppFlowContext.tsx (useApp, useSession, URL release)
│   ├── App.tsx                  # CHANGED: provider above all steps; annotation adapter for review/annotate
│   └── screens.tsx              # CHANGED: Review/Annotate screens use the selected photo + PhotoStrip
├── features/
│   ├── session/                 # NEW feature folder
│   │   ├── lib/limits.ts, sessionSelectors.ts, burstScheduler.ts, photoProcessor.ts (+ tests)
│   │   ├── hooks/usePhotoInfo.ts
│   │   └── components/PhotoStrip.tsx, PhotoThumb.tsx (+ tests)
│   ├── camera/
│   │   ├── hooks/useCamera.ts   # CHANGED: + captureFrame() (stream stays live)
│   │   ├── hooks/useBurst.ts    # NEW: tap/hold controller over burstScheduler
│   │   └── components/ShutterButton.tsx (CHANGED: hold), BurstButton.tsx, BurstProgress.tsx (NEW),
│   │                  CameraView.tsx (CHANGED: wires useBurst, full-session state)
│   ├── review/components/ReviewView.tsx   # CHANGED: strip, delete, Add more, Start over, Continue
│   ├── annotation/
│   │   ├── state/AnnotationProvider.tsx   # CHANGED: adapter over the session slice (no props)
│   │   ├── hooks/useAnnotations.ts        # CHANGED: undo binds photoId
│   │   └── components/AnnotateView.tsx    # CHANGED: strip + canvas keyed by selectedId
│   ├── quality/
│   │   ├── lib/measure.ts       # CHANGED: analysis split so the processor can reuse one decode
│   │   └── hooks/useQualityAssessment.ts  # CHANGED: reads from photoProcessor
│   └── upload/components/ChoosePhotoButton.tsx  # CHANGED: multiple files + limit summary
tests/e2e/burst.spec.ts          # NEW
```

**Structure Decision**: Multi-photo concerns get their own `features/session/` folder, with pure
`lib/` code and UI `components/` kept apart (constitution VI). Feature 001's annotation, quality
and camera code is extended in place, with no forks:
- `annotationReducer` is reused unchanged.
- `useAnnotations` keeps its API.
- `measure.ts` is split only so one decode can feed both analysis and the thumbnail.
- The app-level reducer and context are replaced (by new files) because their single-image shape
  can't hold a session.

## Implementation Phasing (input for /speckit-tasks)

1. **Foundation**: `limits.ts`; `appReducer` with the session slice, selectors and tests; and
   `AppContext` replacing `AppFlowContext`. Then update every import, keeping all feature 001
   tests passing with one-photo sessions.
2. **Per-photo annotation (US3 core)**: the `AnnotationProvider` adapter, `useAnnotations` undo
   bound to `photoId`, and an isolation test.
3. **Photo processor and strip (US2/US3 shared)**: the processor (with tests), `usePhotoInfo`, the
   `useQualityAssessment` migration, and `PhotoStrip` (with tests).
4. **Review (US2)**: delete with confirm and undo, Add more, Start over, Continue, single-photo
   compatibility.
5. **Burst (US1 + US4)**: `burstScheduler` (with tests), `captureFrame`, `useBurst`, the
   `ShutterButton` hold behavior, `BurstProgress`, the session-full state, and stop-reason toasts
   and announcements.
6. **Annotate (US3 UI)**: the strip in Annotate, the canvas keyed per photo, counts.
7. **Accessibility burst (US5)**: `BurstButton` and the live region.
8. **Multiple uploads (US6, P3)**.
9. **E2E + polish**: `burst.spec.ts`, responsive checks at the 3 breakpoints, axe, the feature 001
   e2e suite, profiling a burst on a phone (main-thread long tasks), README and TECHNICAL_NOTES
   updates, then deploy and verify on the reference Android phone.

## Complexity Tracking

> No Constitution Check violations, so no entries are needed.
