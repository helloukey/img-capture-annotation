# Implementation Plan: Image Capture & Annotation

**Branch**: `001-image-capture-annotation` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-image-capture-annotation/spec.md`

## Summary

This plan covers a client-only React single-page app with a three-step flow: **Capture →
Review → Annotate**.

- **Capture** negotiates the highest-resolution camera stream, starting with `ideal` constraints
  and then upgrading to the track's capabilities. It takes stills with
  `ImageCapture.takePhoto()` at the maximum photo resolution and falls back to a full-resolution
  canvas frame. Every camera failure is mapped to a specific, recoverable UI state, and there is
  a photo-upload fallback.
- **Torch** control is detected from track capabilities, and the toggle shows only the state the
  hardware confirms.
- **Review** shows a quality indicator that rates resolution, file size, brightness (mean luma)
  and sharpness (variance of the Laplacian) against centralized thresholds, with actionable tips.
- **Annotate** uses a custom SVG overlay whose `viewBox` equals the image's intrinsic size.
  Boxes are stored in image pixels, so alignment at any display size is correct by construction.
  Pointer Events give unified mouse, touch and pen editing, and an annotation list shares the
  same reducer state.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on Node.js 22 LTS (tooling); ES2022 browser target

**Primary Dependencies**:
- React 19, Vite (latest stable), Tailwind CSS v4
- Radix UI primitives (Dialog, Toggle, Tooltip, Popover), Sonner (toasts), lucide-react (icons),
  clsx. All of these are wrapped in `src/shared/ui/` (Constitution VI)
- Dev-only: fast-check (property tests), ajv (export schema test, US8), @axe-core/playwright
- No camera or annotation library: browser Media Capture APIs plus custom SVG (research R2, R3,
  R6)

**Storage**: N/A. All state is held in memory for the session. Object URLs are revoked when the
image is discarded.

**Testing**:
- Vitest with React Testing Library, user-event and jsdom for unit and component tests
- Playwright (Chromium fake media device; desktop and touch-emulated mobile projects) for
  end-to-end tests

**Target Platform**: Modern evergreen browsers in a secure context.
- Reference browsers: Chrome on Android, Safari on iOS 17 and later, and desktop Chrome and
  Safari.
- Firefox is best-effort.

**Project Type**: Single-project frontend web application (static SPA)

**Performance Goals**:
- Preview visible in under 3 s after permission is granted
- Feedback for any interaction in under 100 ms
- 60 fps while dragging or resizing boxes
- Quality results within 1 s for images up to 12 MP (SC-008)

**Constraints**:
- Secure context required (HTTPS or localhost)
- No server and no uploads (FR-035)
- Full-resolution image preserved; lossy encoding at quality 0.92 or higher (0.95 is used)
- Touch targets of at least 44 px; layouts verified at 360, 768 and 1280 px in both orientations
- Initial JS bundle target under 200 KB gzipped

**Scale/Scope**: A single user and a single image per session, typically fewer than 50
annotations, 3 screens, and roughly 40 source modules. Delivered within one week.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design | Evidence |
|-----------|------|--------------|-------------|----------|
| I. Core Requirements First | Stories tagged core or enhancement; enhancements deferred | ✅ | ✅ | Spec US1–US7 are core and US8 export is an enhancement. FR-036 is marked "MAY, after core". Tasks will order all core work first. |
| II. Maximum Capture Fidelity | `ideal` high-resolution constraints with fallback; `takePhoto` or a native-size canvas; JPEG ≥ 0.92; report actual resolution | ✅ | ✅ | Research R2 and R3; [contracts/camera.md](./contracts/camera.md) guarantees 2 and 3; data-model `CapturedImage.width/height` come from the decoded blob. |
| III. Graceful Degradation & Truthful State | Distinct error states; torch capability detection; torch state read back; tracks stopped; error boundaries | ✅ | ✅ | Research R4 and R5; the camera contract's UI states table and `useTorch` guarantees; AppFlow `RESET`; error boundary for each view (Project Structure). |
| IV. Resolution-Independent Annotations | Geometry in image space; one transform module; `ResizeObserver`; clamping and minimum size; single source of truth | ✅ | ✅ | Research R6 (SVG viewBox equals the intrinsic size); `geometry.ts` contract with property-test invariants; `ResizeObserver` measures `displayScale` for handle and minimum sizes; one reducer feeds both the canvas and the list. |
| V. Touch-First, Responsive UX | Pointer Events only; `touch-action`; 44 px targets; 3 breakpoints; feedback within 100 ms; confirm or undo destructive actions; keyboard and a11y | ✅ | ✅ | Annotation canvas contract (handles with 44 px hit areas, multi-pointer cancel); research R13 layouts; undo toast; confirm dialogs; Radix primitives; jsx-a11y lint. |
| VI. Modular, Testable Architecture | Hooks wrap browser APIs; pure domain logic; libraries wrapped; lint and type checks clean | ✅ | ✅ | `useCamera` and `useTorch` are the only callers of the media APIs; pure `lib/` modules per feature; `src/shared/ui` wrappers; ESLint, `tsc --noEmit` and Prettier gates (R12). |
| VII. Documented Decisions | README and technical notes cover capture, quality, annotation, libraries, thresholds and limitations | ✅ | ✅ | research.md is the source for the technical notes; README tasks map to FR-037 and FR-038; the threshold calibration step is in quickstart. |
| Tech constraints | React with TS strict; secure context; centralized thresholds; client-only; Chrome and Safari tested; HTTPS hosting | ✅ | ✅ | Technical Context above; `thresholds.ts`; `dev:https`; Vercel deployment. |
| Workflow gates | Required unit, component and e2e tests; lint, type and test gates; touch check | ✅ | ✅ | Research R11 maps to every test category listed in the constitution; quickstart's quality gates. |

**Result**: PASS. There are no violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-image-capture-annotation/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R13
├── data-model.md        # Phase 1 — entities, reducers, state machines
├── quickstart.md        # Phase 1 — run + validation scenarios V1–V18
├── contracts/
│   ├── camera.md                  # useCamera / useTorch / error taxonomy / UI states
│   ├── quality.md                 # metrics, thresholds, assessQuality, indicator UI
│   ├── annotation-store.md        # geometry, reducer, canvas & list contracts
│   └── export-format.schema.json  # enhancement (US8)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — created by /speckit-tasks
```

### Source Code (repository root)

```text
index.html
vite.config.ts            # react plugin, tailwind, basic-ssl (dev:https), vitest config
playwright.config.ts      # desktop-chrome + pixel-7 projects, fake media flags
eslint.config.js
tsconfig.json
README.md
docs/
└── TECHNICAL_NOTES.md    # capture strategy, quality assessment, annotation approach

src/
├── main.tsx
├── app/
│   ├── App.tsx                 # step router (camera | review | annotate) + Toaster
│   ├── appFlowReducer.ts       # AppFlow state machine (data-model §6)
│   ├── AppFlowContext.tsx
│   └── StepIndicator.tsx
├── features/
│   ├── camera/
│   │   ├── components/   # CameraView, CameraPreview, ShutterButton, TorchToggle,
│   │   │                 # SwitchCameraButton, CameraErrorState, PermissionPrimer
│   │   ├── hooks/        # useCamera.ts, useTorch.ts, usePageVisibility.ts
│   │   └── lib/          # constraints.ts, capture.ts, cameraErrors.ts, decodeImage.ts
│   ├── review/
│   │   └── components/   # ReviewView
│   ├── upload/
│   │   ├── components/   # ChoosePhotoButton
│   │   └── lib/          # fileToCapturedImage.ts
│   ├── quality/
│   │   ├── components/   # QualityIndicator (full | compact), QualityCheckRow
│   │   ├── hooks/        # useQualityAssessment.ts
│   │   └── lib/          # thresholds.ts, metrics.ts, measure.ts, assess.ts, format.ts
│   └── annotation/
│       ├── components/   # AnnotateView, AnnotationCanvas, AnnotationBox, ResizeHandles,
│       │                 # DraftBox, AnnotationList, AnnotationListItem, AnnotationToolbar
│       ├── hooks/        # useAnnotations.ts, usePointerGesture.ts, useDisplayScale.ts
│       ├── state/        # AnnotationProvider.tsx
│       └── lib/          # geometry.ts, annotationReducer.ts, exportAnnotations.ts (US8)
├── shared/
│   ├── ui/               # Button, IconButton, Sheet, ConfirmDialog, Toggle, Popover (Radix wrappers),
│   │                     # toast.ts (Sonner wrapper), icons.ts (lucide re-exports)
│   ├── components/       # ErrorBoundary, ErrorFallback
│   ├── hooks/            # useResizeObserver.ts, useMediaQuery.ts, useObjectUrl.ts
│   └── types.ts          # CapturedImage, shared types
└── styles/
    └── index.css         # tailwind @import + @theme tokens, reduced-motion rules

tests/
├── setup.ts                    # RTL, jest-dom, mediaDevices/MediaStreamTrack fakes
├── fakes/                      # fakeMediaDevices.ts, fakeTrack.ts, fakeImageCapture.ts
└── e2e/
    ├── capture-to-annotate.spec.ts
    ├── alignment.spec.ts
    └── permission-denied.spec.ts
# Unit/component tests colocated: src/**/*.test.ts(x)
```

**Structure Decision**: The project is a single frontend at the repository root, organized
**by feature**: camera, review, upload, quality and annotation. Each feature keeps its React
code (`components/`, `hooks/`) apart from its pure logic (`lib/`). This puts Constitution VI
into the folder layout: `lib/` modules import nothing from React, and only `camera/hooks`
touches the media APIs. Unit tests sit next to the code they test. Shared test fakes and the
Playwright e2e specs live under `tests/`. There is no backend, in line with FR-035.

## Implementation Phasing (input for /speckit-tasks)

1. **Setup**: Vite, TypeScript, Tailwind, lint, Vitest and Playwright scaffold; HTTPS dev;
   Vercel project.
2. **Foundation**: shared types, AppFlow reducer, error boundary, UI wrappers, test fakes.
3. **US1 + US5** (capture and errors, P1/P2 core): constraints, capture, error classifier,
   `useCamera`, CameraView, error states, upload fallback, ReviewView.
4. **US2 + US3** (annotation and alignment, P1 core): geometry with property tests, reducer,
   canvas, pointer gestures, label editing, undo.
5. **US4** (quality, P2 core): metrics, assess, indicator, then threshold calibration on devices.
6. **US6** (torch, P2 core): `useTorch`, TorchToggle, device verification.
7. **US7** (list, P2 core): AnnotationList with synchronized selection and Clear all.
8. **Polish and delivery**: responsive pass at 3 breakpoints, a11y pass, README,
   TECHNICAL_NOTES, deployment, then demo recording (manual).
9. **US8 export** (enhancement): only once steps 1–8 are green.

## Complexity Tracking

> No Constitution Check violations, so no entries are needed.
