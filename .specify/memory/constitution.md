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
- An enhancement MUST NOT regress any `core` flow. In particular, a single tap on the shutter MUST
  keep capturing exactly one photo; multi-image capture (burst) is additive.

Rationale: The work is evaluated against a fixed one-week brief that explicitly rewards finishing
the core before extras.

### II. Maximum Capture Fidelity

Captured images MUST come from the camera at the highest resolution the device and browser
actually provide, never at the size of the on-screen preview.

- Camera streams MUST be requested via `navigator.mediaDevices.getUserMedia` with `ideal`
  (not `exact`) high-resolution width/height constraints, preferring the rear camera on mobile
  (`facingMode: "environment"`), and MUST fall back to looser constraints on `OverconstrainedError`.
- Single captures MUST use `ImageCapture.takePhoto()` where it is supported, and otherwise draw the
  frame to a canvas sized to the track's real `videoWidth`/`videoHeight`.
- Burst frames MAY use the canvas path at the stream's full `videoWidth`/`videoHeight` instead of
  `takePhoto()`, because `takePhoto()` latency (often 300–1000 ms, sometimes with refocus or flash)
  cannot sustain a burst cadence. Burst frames MUST NOT be captured below the stream resolution.
- The captured image MUST NOT be downscaled, cropped, or re-encoded at a lossy quality below 0.92
  before quality assessment and annotation. Any display scaling happens only in CSS/render.
- The actual resolution obtained (from track settings or the decoded image) MUST be what the UI
  reports, not the resolution that was requested. In a multi-image session this applies to every
  image individually, because burst frames and single captures can differ in resolution.

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
- Media tracks MUST be stopped when the camera view unmounts, after capture or after a burst ends,
  and when the page is hidden, so the camera is never left running.
- A burst MUST stop immediately, keeping the frames already captured, on pointer release, pointer
  cancel, page hide, stream interruption, or when any Principle VIII limit is reached. The UI MUST
  say why a burst stopped early when it was not the user releasing the button.
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
- Every annotation MUST belong to exactly one image, and its geometry MUST be in that image's own
  intrinsic coordinates. Switching between images MUST never show, move or edit another image's
  annotations. Deleting an image MUST delete its annotations with it.

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
- Destructive actions (retake while annotations exist, delete all, delete an image) MUST be
  confirmable or undoable. Deleting an image that has annotations MUST say how many will be lost.
- Hold-to-burst MUST use one Pointer Events path for touch, mouse and pen. A press shorter than
  300 ms is a single capture; holding longer starts a burst. Long-press side effects (context menu,
  text selection, haptic menus) MUST be suppressed on the shutter.
- During a burst the UI MUST show a live frame counter and progress toward the time limit, and
  give per-frame feedback within 100 ms.
- Burst MUST have a keyboard-accessible alternative that does not rely on holding a pointer, with
  an accessible name that explains it.
- Controls MUST be keyboard-reachable and labeled for assistive technology. Annotations MUST be
  deletable with the Delete or Backspace key on desktop.

Rationale: UI/UX, responsiveness, and touch interactions are explicit evaluation criteria.

### VI. Modular, Testable React Architecture

Browser APIs, domain logic, and presentation MUST be kept separate.

- Camera, torch, and media access MUST be encapsulated in custom hooks or services
  (e.g. `useCamera`, `useTorch`). Components MUST NOT call `getUserMedia` or `applyConstraints`
  directly.
- Quality assessment, annotation geometry, the burst scheduler, and the session limits of
  Principle VIII MUST be pure functions or state machines that do not depend on React and are
  covered by unit tests (with fake timers for the burst cadence).
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

### VIII. Bounded Burst Capture & Resource Safety

Burst capture MUST never freeze the browser or exhaust device memory. Every limit below is a hard
cap, enforced in code, with all values defined as named constants in one module.

- **Burst duration**: at most **3 seconds** of holding per burst.
- **Frames per burst**: at most **10**, at a target cadence of about **3 frames per second**
  (one frame every ~333 ms).
- **Images per session**: at most **20** images in total, across all bursts and single captures.
  When the session is full, the shutter MUST explain why it is disabled.
- **Memory budget**: at most **150 MB** of encoded image data held per session. A burst MUST stop
  before a frame would exceed the budget.
- **Sequential capture**: a frame MUST NOT start until the previous frame has finished encoding.
  Frames MUST never be queued or captured concurrently, so slow devices take fewer frames instead
  of falling behind.
- **Main-thread budget**: no task on the main thread during a burst MAY exceed about 50 ms.
  Encoding MUST be asynchronous (`toBlob`, `OffscreenCanvas` or a worker), and pixel analysis MUST
  NOT run while a burst is in progress.
- **Release**: object URLs and decoded bitmaps MUST be revoked or closed when an image is deleted,
  when the session is cleared, and on unmount.

Rationale: At 12 MP, a single JPEG is about 3–4 MB and its decoded bitmap is about 48 MB. These caps
keep the worst case near 40 MB of encoded data per burst, well inside mobile browser limits, while
still giving a useful sequence of shots. Sequential capture turns device slowness into fewer
frames rather than a frozen tab.

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
  annotation views, for the image currently shown. It MUST show at least the actual resolution,
  the file size, and an overall quality verdict.
- **Multi-image sessions**: Quality analysis MUST be computed per image, lazily (for the image
  being viewed first, then the rest one at a time when the browser is idle), and cached by image
  id. Image lists and strips MUST render downscaled thumbnails, never several full-resolution
  images at once.
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
  Principles I–VIII.
- **Testing**:
  - Unit tests are REQUIRED for the coordinate transforms, box clamping and normalization,
    quality threshold evaluation, and capability-detection logic.
  - Component or integration tests are REQUIRED for the camera error states (with mocked
    `mediaDevices`), the torch states, and the annotation create/move/resize/delete/label flow.
  - For multi-image capture, these are REQUIRED:
    - Unit tests for the burst scheduler (300 ms tap/hold threshold, cadence, every Principle VIII
      limit, sequential capture, and each early-stop reason).
    - Component tests for per-image delete (including its confirmation or undo) in the review
      step, and for annotations staying isolated per image when switching images.
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
  MUST NOT be weakened for `core` features, and Principle VIII MUST NOT be weakened for any
  feature that captures more than one image.

**Version**: 1.1.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-04
