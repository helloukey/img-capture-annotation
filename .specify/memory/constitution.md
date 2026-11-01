# Image Capture & Annotation Constitution

## Core Principles

### I. Core Requirements First

The assignment's required features MUST be complete and working end-to-end before any optional
enhancement is started. The required features are:
camera preview, capture/preview/retake, torch toggle, permission and unsupported-device handling,
the quality indicator, and bounding-box annotation (draw/select/move/resize/delete/label/list).

- Every feature spec MUST tag each user story as `core` (traceable to an assignment requirement)
  or `enhancement`.
- Enhancements (filters, export formats, undo history, animations beyond feedback, etc.) MUST NOT
  be implemented while any `core` story is incomplete or failing.
- Scope cuts made to fit the one-week timeline MUST be recorded as known limitations in the README.

Rationale: The work is evaluated against a fixed one-week brief that explicitly rewards finishing
the core before extras.

### II. Maximum Capture Fidelity

Captured images MUST come from the camera at the highest resolution the device and browser
actually provide, never at the size of the on-screen preview.

- Camera streams MUST be requested via `navigator.mediaDevices.getUserMedia` with `ideal`
  (not `exact`) high-resolution width/height constraints, preferring the rear camera on mobile
  (`facingMode: "environment"`), and MUST fall back to looser constraints on `OverconstrainedError`.
- Capture MUST use `ImageCapture.takePhoto()` where it is supported, and otherwise draw the frame
  to a canvas sized to the track's real `videoWidth`/`videoHeight`.
- The captured image MUST NOT be downscaled, cropped, or re-encoded at a lossy quality below 0.92
  before quality assessment and annotation. Any display scaling happens only in CSS/render.
- The actual resolution obtained (from track settings or the decoded image) MUST be what the UI
  reports, not the resolution that was requested.

Rationale: Capture quality and correct camera API usage are the top evaluation criterion.

### III. Graceful Degradation & Truthful State

Every browser and device capability MUST be detected before use, and every failure MUST produce
a specific, actionable UI state. The app MUST never show a blank screen or an uncaught error.

- These states MUST be handled distinctly, each with its own message and recovery action:
  permission denied, permission dismissed or pending, no camera found, camera in use by another
  app, insecure context (non-HTTPS), and `getUserMedia` unsupported.
- Torch support MUST be detected via `track.getCapabilities().torch`. When it is unsupported, the
  toggle MUST be hidden or disabled with an explanation, not shown as a control that does nothing.
- The torch UI state MUST reflect what the track reports (`track.getSettings().torch`) after
  `applyConstraints` resolves. It MUST NOT be updated optimistically, and it MUST reset when the
  stream stops or restarts.
- Media tracks MUST be stopped when the camera view unmounts, after capture, and when the page
  is hidden, so the camera is never left running.
- A React error boundary MUST wrap each top-level view (camera, review, annotation).

Rationale: The evaluation explicitly covers permissions, unsupported devices, failure scenarios,
and a torch UI that "reflects the actual torch state."

### IV. Resolution-Independent Annotations

Annotation geometry MUST be stored in the image's intrinsic pixel coordinates (or normalized 0–1
coordinates relative to the intrinsic size), and never in screen or CSS pixels.

- Converting between screen and image space MUST happen in a single pure, unit-tested module
  that is used for both rendering and pointer input.
- Rendered boxes MUST stay aligned with image content after any container resize, orientation
  change, or zoom. Layout changes MUST be observed with `ResizeObserver`.
- Boxes MUST be clamped to image bounds and MUST enforce a minimum size. Coordinates are
  normalized so that width and height are always positive, whichever direction the box was drawn.
- Each annotation MUST have a stable id, a label (it may be empty but can be edited), and geometry.
  The annotation list and the canvas MUST read from the same source of truth.

Rationale: The brief evaluates accuracy and "alignment across image sizes." Storing geometry in
image space makes alignment correct by construction.

### V. Touch-First, Responsive UX

Every interaction MUST work with mouse, touch, and pen on mobile, tablet, and desktop viewports.

- Input MUST use Pointer Events, with `touch-action` set on the interactive surfaces. Separate
  mouse-only or touch-only code paths are prohibited.
- Interactive targets (buttons, resize handles) MUST have a hit area of at least 44×44 CSS px,
  even when the visible handle is smaller.
- Layouts MUST be verified at roughly 360px (phone), 768px (tablet), and 1280px or wider (desktop),
  in both portrait and landscape orientation.
- Every user action (capture, retake, torch toggle, delete, label save) MUST give visible
  feedback within 100 ms. Long operations MUST show progress.
- Destructive actions (retake while annotations exist, delete all) MUST be confirmable or undoable.
- Controls MUST be keyboard-reachable and labeled for assistive technology. Annotations MUST be
  deletable with the Delete or Backspace key on desktop.

Rationale: UI/UX, responsiveness, and touch interactions are explicit evaluation criteria.

### VI. Modular, Testable React Architecture

Browser APIs, domain logic, and presentation MUST be kept separate.

- Camera, torch, and media access MUST be encapsulated in custom hooks or services
  (e.g. `useCamera`, `useTorch`). Components MUST NOT call `getUserMedia` or `applyConstraints`
  directly.
- Quality assessment and annotation geometry MUST be pure functions that do not depend on React
  and are covered by unit tests.
- Components MUST be focused on one job. Shared state MUST flow through a clearly owned store or
  context, never through prop-drilling chains deeper than three levels.
- Third-party libraries (UI kits, canvas or annotation libraries, animation) are allowed, but
  each one MUST be justified in the README and wrapped so it can be replaced.
- Code MUST pass lint and type checks with zero errors before it is merged.

Rationale: Code quality, modularity, and meaningful tests are evaluated directly. Isolating the
browser APIs also makes the hardware-dependent logic testable with mocks.

### VII. Documented Decisions & Trade-offs

Documentation is a deliverable, not an afterthought.

- The README MUST include setup and run instructions (including HTTPS for testing on devices), the
  implementation decisions, the library choices with reasons, the quality thresholds with their
  justification, browser and device support notes, and the known limitations.
- The technical notes MUST explain the image capture strategy, the quality assessment method, and
  the annotation approach.
- Every significant decision made during planning MUST be traceable from the plan artifacts to
  the README or technical notes.

Rationale: Reviewers will ask for the key decisions to be explained, and the brief requires these
documents.

## Technical Constraints

- **Framework**: React (function components and hooks). TypeScript in strict mode SHOULD be used.
  If plain JavaScript is chosen instead, the reason MUST be documented.
- **Runtime context**: The app MUST run in a secure context (HTTPS or localhost) because the camera
  APIs require one. The development server MUST support HTTPS or a documented tunnel so it can be
  tested on real mobile devices.
- **Quality thresholds**: All thresholds (minimum resolution and megapixels, file-size bounds, and
  any sharpness or brightness heuristics) MUST be defined as named constants in one module. Each
  MUST have a severity level (e.g. good / warning / poor) and a user-facing message that says how
  to improve the image.
- **Quality indicator**: The indicator MUST always be visible on the captured-image review and
  annotation views. It MUST show at least the actual resolution, the file size, and an overall
  quality verdict.
- **Privacy**: Images and annotations MUST stay on the client by default. Nothing is uploaded unless
  the user explicitly asks for it.
- **Browser support**: The app MUST be tested in current Chrome (Android and desktop) and Safari
  (iOS). Capability gaps (for example, no torch on iOS Safari) MUST be handled under Principle III
  and documented.
- **Hosting (bonus)**: If the app is deployed, it MUST be served over HTTPS at a public URL that is
  listed in the README.

## Development Workflow & Quality Gates

- **Spec-driven flow**: Features MUST go through `/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. Every plan MUST include a Constitution Check against
  Principles I–VII.
- **Testing**:
  - Unit tests are REQUIRED for the coordinate transforms, box clamping and normalization,
    quality threshold evaluation, and capability-detection logic.
  - Component or integration tests are REQUIRED for the camera error states (with mocked
    `mediaDevices`), the torch states, and the annotation create/move/resize/delete/label flow.
  - Tests MUST be meaningful: they assert behavior, not implementation details or snapshots
    alone.
- **Gates before a task is marked done**: lint passes, type check passes, tests pass, and the
  feature has been checked manually on at least one touch device or in touch emulation.
- **Commits**: Commits MUST be small and focused, with descriptive messages. The repository history
  is part of the deliverable.
- **Demo readiness**: At the end of each `core` milestone, the full capture → quality → annotate
  flow MUST be demonstrable.

## Governance

This constitution supersedes ad-hoc preferences for this project. Where a spec, plan, or task
conflicts with it, the constitution wins, unless the conflict is resolved by amending the
constitution.

- **Amendments**: To amend the constitution, propose the change through `/speckit-constitution`,
  record the reason in the Sync Impact Report, and update the dependent plans or tasks that the
  change affects.
- **Versioning**: Semantic versioning applies.
  - MAJOR: a principle is removed or redefined in a way that is not backward compatible.
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications and wording changes.
- **Compliance**: Every `/speckit-plan` MUST pass a Constitution Check. Any deviation MUST be
  listed in the plan's Complexity Tracking table, with a justification and the simpler
  alternative that was rejected. Reviews MUST verify compliance before work is merged.
- **Deadline pressure**: Under time pressure, Principle I decides what to cut. Principles II–IV
  MUST NOT be weakened for `core` features.

**Version**: 1.0.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
