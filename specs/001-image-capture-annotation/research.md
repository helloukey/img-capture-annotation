# Phase 0 Research: Image Capture & Annotation

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-11-01

Each entry gives the decision, the reason for it, and the alternatives that were considered.
All `NEEDS CLARIFICATION` items from the Technical Context are resolved here.

---

## R1. Application framework, language & build

- **Decision**: React 19 + TypeScript (strict) + Vite, as a single-page app with no router. The
  three steps (Capture → Review → Annotate) are handled by an in-app flow state machine.
- **Rationale**: The assignment requires React. TypeScript strict mode satisfies Constitution VI
  and the code-quality criterion. Vite gives fast HMR and a simple static build that deploys
  anywhere. A router adds nothing here because the flow is linear, all its state lives in memory,
  and deep links to "review" without an image would make no sense.
- **Alternatives considered**: Next.js was rejected because SSR and server components bring no
  value to a camera app that runs only on the client and add hosting complexity. Create React App
  is deprecated. React Router was rejected because it would allow invalid states such as
  `/annotate` with no image.

## R2. Camera stream acquisition at maximum resolution

- **Decision**: Acquire the stream in two stages.
  1. Call `getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 4096 },
     height: { ideal: 4096 } }, audio: false })`. The constraints use `ideal`, never `exact`, so
     the browser picks the closest mode it supports instead of failing.
  2. Read `track.getCapabilities()`. If `width.max` or `height.max` is higher than the current
     `getSettings()` values, call `track.applyConstraints({ width: { ideal: max }, height:
     { ideal: max } })` to push the stream to the sensor's best video mode. Wrap this in
     try/catch and keep the stage-1 stream if it fails.
  3. If stage 1 throws `OverconstrainedError`, retry with `{ video: { facingMode: "environment" } }`
     and then with `{ video: true }`.
  4. Switching cameras uses `deviceId: { exact: id }` with the same resolution preferences.
     Device labels become available once permission has been granted.
- **Rationale**: Square `ideal` values let the browser choose the sensor's native aspect ratio
  in either orientation. Using `ideal` avoids the hard failures that `exact` and `min` cause
  (Constitution II). The capability upgrade in step 2 catches devices that start at 720p/1080p
  even though they support more.
- **Alternatives considered**: Probing a list of fixed resolutions (`exact` 4K, then 1080p, and
  so on) was rejected because it is slow, prompts repeatedly on some browsers, and misses
  non-standard sensor sizes. Library wrappers (react-webcam) were rejected because they hide the
  track, which torch control and `ImageCapture` need, and they default to preview-sized captures.

## R3. Still capture strategy

- **Decision**: Progressive enhancement.
  1. **Preferred**: Where `ImageCapture` exists (Chromium, including Android), call
     `imageCapture.getPhotoCapabilities()` and then `takePhoto({ imageWidth: caps.imageWidth.max,
     imageHeight: caps.imageHeight.max })`. This returns a JPEG `Blob`, which is often *higher*
     resolution than any video mode because it uses the sensor's photo pipeline.
  2. **Fallback**: Use this in Safari and Firefox, or whenever `takePhoto` rejects. Draw the
     current frame onto a canvas sized to `video.videoWidth × video.videoHeight` (the real stream
     resolution, never the element's CSS size). Then call `canvas.toBlob(cb, "image/jpeg", 0.95)`.
  3. Decode the resulting blob (`createImageBitmap` or an `<img>`) to read the **actual**
     `naturalWidth/naturalHeight`. These, together with `blob.size`, are the values the UI
     reports (Constitution II: report the resolution obtained, not the resolution requested).
- **Torch interaction**: On some Android devices `takePhoto()` resets the torch or its fill-light
  mode. After capture, the torch state is re-read from `track.getSettings()`. The stream is
  stopped when the app moves to Review anyway (FR-006), so the torch then reports off.
- **Rationale**: This gives the highest practical resolution on each platform, which is the top
  evaluation criterion, and keeps a universal fallback.
- **Alternatives considered**: `<input type="file" capture="environment">` was rejected for the
  primary flow. It hands off to the native camera app, so the assignment's live preview and torch
  requirements cannot be met. It is kept only as the upload fallback (R9). PNG encoding was
  rejected because its files are 5–10× larger with no visible gain for photos, which inflates the
  size shown in the quality indicator. JPEG quality 0.95 is above the constitution's 0.92 floor.

## R4. Camera error taxonomy

- **Decision**: Map failures to a closed union `CameraErrorKind`, implemented as a pure function
  `classifyCameraError(err, env)`:

  | Condition | Detection | Kind |
  |-----------|-----------|------|
  | Not HTTPS or localhost | `!window.isSecureContext` | `insecure-context` |
  | API missing | `!navigator.mediaDevices?.getUserMedia` | `unsupported` |
  | Denied or blocked | `NotAllowedError` / `SecurityError`, or Permissions API reports `denied` | `permission-denied` |
  | Prompt dismissed | `NotAllowedError` while the Permissions API reports `prompt` | `permission-dismissed` |
  | No camera | `NotFoundError` / `OverconstrainedError` after all fallbacks | `no-camera` |
  | Busy or hardware error | `NotReadableError` / `AbortError` | `camera-busy` |
  | Track ended mid-use | the track's `ended` event | `stream-interrupted` |
  | Anything else | default | `unknown` |

  The Permissions API (`navigator.permissions.query({ name: "camera" })`) is used only as a hint
  when it is available. It is not supported everywhere, so the logic never depends on it.
- **Rationale**: FR-011 requires a specific message and recovery action for each condition. A
  pure classifier can be unit-tested against mocked `DOMException`s (Constitution VI).
- **Alternatives considered**: A generic "camera error" message was rejected because it violates
  FR-011 and SC-004.

## R5. Torch control

- **Decision**: Implement a `useTorch(track)` hook.
  - **Support**: `"torch" in track.getCapabilities()` is checked whenever the active track changes.
  - **Toggle**: Set `pending`, call `await track.applyConstraints({ advanced: [{ torch: next }] })`,
    then set the UI state from `track.getSettings().torch`, never from `next`. On rejection, keep
    the previously confirmed state and show a toast.
  - **Reset**: When the track ends or is replaced, the state becomes `off` or `unsupported`.
- **Platform reality**: This works on Chrome for Android with a rear camera that has a flash. It
  is unsupported on desktop and on Firefox. Recent iOS Safari versions expose `torch` in
  capabilities on some devices. Because we detect the capability, the app will use the torch if
  iOS reports support, and otherwise shows "unsupported". The README will document the behavior
  observed on the test devices.
- **Rationale**: This meets FR-008–FR-010 and the brief's requirement that the UI reflect the
  actual torch state.
- **Alternatives considered**: Updating the toggle optimistically was rejected because the brief
  explicitly penalizes UI that diverges from hardware. `ImageCapture.setOptions({ torch })` was
  rejected because it is legacy and inconsistent across devices.

## R6. Annotation rendering & interaction approach

- **Decision**: Build a **custom SVG overlay** with `viewBox="0 0 {naturalWidth} {naturalHeight}"`.
  - The photo (`<img>`) and the `<svg>` are absolutely stacked inside a wrapper whose CSS
    `aspect-ratio` equals the image's ratio, constrained by `max-width` and `max-height`. The
    rendered image box and the SVG box are therefore always identical.
  - Annotation geometry is stored in **intrinsic image pixels**, and `<rect>` elements use those
    coordinates directly. The browser's viewBox transform scales them, so alignment at any
    display size is correct by construction (Constitution IV, FR-024, SC-003).
  - Pointer input is converted from screen to image coordinates through
    `svg.getScreenCTM().inverse()`, wrapped in a pure `geometry.ts` module. The module has a
    matrix-based fallback, `toImagePoint(clientPt, rect, natural)`, for unit tests.
  - Strokes use `vector-effect="non-scaling-stroke"`. Handle hit areas are sized in image units
    as `44 / scale` (where scale is measured with a `ResizeObserver`), so they are always 44 CSS
    px (FR-031).
  - Pointer Events cover all input types. `setPointerCapture` is used for drags. `touch-action:
    none` is set on the SVG only. Active pointers are tracked, and a second pointer cancels the
    current gesture (edge case: multi-touch).
- **Rationale**: Alignment needs no recomputation code at all. The code is small and declarative
  React, fully testable, and needs no canvas redraw loop. Keyboard and ARIA support are easy
  because SVG elements are DOM nodes.
- **Alternatives considered**:
  - **react-konva / Konva**: This is a capable canvas library. However, coordinates live in
    stage space, so manual rescaling on resize is needed, which is exactly the class of bug the
    brief tests for. It adds ~150 KB and the canvas nodes are not accessible.
  - **Fabric.js**: Its imperative object model fights React state, and it is heavy.
  - **react-image-annotate / Annotorious**: These are opinionated, offer limited touch resize
    control, are inconsistently maintained, and are harder to style for mobile.
  - **Absolutely positioned divs using percentages**: This also aligns, but handles, labels and
    hit-testing are clumsier than in SVG, with no real advantage.

## R7. Annotation state management

- **Decision**: Use a pure `annotationReducer` (create, update geometry, rename, delete, restore,
  clear, select) with `useReducer`, exposed through a context provider for the annotation feature
  only. The reducer keeps `lastDeleted` so that the 5 s undo toast can restore a deletion
  (FR-026). The canvas and the list read the same state (Constitution IV).
- **App-level flow**: A second small reducer manages `step: "camera" | "review" | "annotate"` and
  the current `CapturedImage`. It guards transitions, for example retaking while annotations
  exist dispatches a confirm request.
- **Rationale**: Pure reducers can be unit-tested without React. The state is small, so no
  external store is justified.
- **Alternatives considered**: Zustand is fine, but adds a dependency for no real gain at this
  scale. Redux Toolkit is overkill. A full undo/redo history (immer patches) is deferred as an
  enhancement.

## R8. Image quality assessment

- **Decision**: Implement a pure `assessQuality(metrics, thresholds)` plus a `measureImage(blob)`
  that computes the metrics.
  - **Resolution**: `naturalWidth × naturalHeight` gives the MP value. Good is ≥ 5 MP, Fair is
    2–5 MP, Poor is < 2 MP (FR-020).
  - **File size**: `blob.size`. Good is 500 KB–15 MB, Fair is 150–500 KB or > 15 MB, Poor is
    < 150 KB. A very small JPEG at this resolution usually means a dark, flat or featureless
    frame.
  - **Brightness**: Downscale the image to a longest side of 512 px on a canvas and compute the
    mean Rec. 709 luma (0.2126R + 0.7152G + 0.0722B) as a percentage of 255. Good is 25–80%,
    Fair is 15–25% or 80–90%, Poor is < 15% or > 90%.
  - **Sharpness**: On the same 512 px grayscale buffer, compute the **variance of the
    Laplacian** (3×3 kernel). Starting thresholds are **sharp ≥ 100** and **blurry < 40**, with
    Fair in between. These values come from the common 100 threshold in the literature for
    ~500 px images. They will be validated against 10 sharp and 10 deliberately blurred captures
    per reference device (SC-007), and the final values will be recorded in `thresholds.ts` and
    the README.
  - **Overall verdict**: the worst individual rating (FR-018).
  - Each check has a message and an improvement tip, for example "Too dark — turn on the torch or
    move to brighter light". The torch tip appears only when the torch is supported.
- **Performance**: Downscaling to 512 px keeps the analysis to about 200K pixels, under ~50 ms
  even on mid-range phones, which leaves plenty of room within SC-008's 1 s budget. Decoding the
  full image happens once and is shared with display. If profiling shows jank with very large
  (48 MP and above) images, move measurement to a Web Worker with `OffscreenCanvas`, behind the
  same interface.
- **Rationale**: These are meaningful, explainable thresholds that cover the brief's required
  resolution and file size plus the two most common capture failures (darkness and blur). All
  values live in one constants module (constitution, Technical Constraints).
- **Alternatives considered**: ML-based quality models (BRISQUE, NIMA) were rejected as too heavy
  and opaque to explain. Tenengrad or FFT sharpness measures work, but the Laplacian variance is
  the simplest to explain in review. JPEG quantization analysis was rejected as low value.

## R9. Upload fallback

- **Decision**: Use a hidden `<input type="file" accept="image/*">`, triggered from the error
  states and from desktops without a camera. The chosen file is decoded to validate it. Files that
  fail to decode show an error (edge case) and are otherwise treated as a `CapturedImage` with
  `source: "upload"`, which then goes through the same Review → Annotate flow. EXIF orientation
  is respected by decoding with `createImageBitmap(blob, { imageOrientation: "from-image" })`,
  falling back to `<img>`, which applies EXIF orientation by default in modern browsers.
- **Rationale**: FR-012 requires it. Reusing the same pipeline keeps the quality and annotation
  logic identical.

## R10. UI component, styling & animation libraries

- **Decision**:
  - **Styling**: Tailwind CSS v4. It is a utility-first, mobile-first approach to responsive
    layout, with design tokens declared through `@theme` and dark mode built in.
  - **Accessible primitives**: Radix UI (`@radix-ui/react-dialog` for confirmations and the
    mobile bottom sheet, `@radix-ui/react-toggle` for the torch, and `@radix-ui/react-tooltip`).
  - **Toasts**: Sonner, which provides accessible toasts with an action button for the undo of
    a delete.
  - **Icons**: lucide-react.
  - **Animation**: CSS transitions and keyframes only (shutter flash, sheet slide,
    quality-badge fade-in). All of them respect `prefers-reduced-motion`. No animation library.
  - Each library is used behind thin wrappers in `src/shared/ui/`, so it can be replaced
    (Constitution VI).
- **Rationale**: Radix provides focus management, ARIA and keyboard support for FR-034 at no
  cost. Tailwind speeds up building a responsive layout at three breakpoints. Keeping animation
  in CSS keeps the bundle small, and the motion needed is minimal.
- **Alternatives considered**: MUI and Chakra were rejected as heavy and hard to style for a
  camera-first UI. shadcn/ui is essentially Radix plus Tailwind, so we use the primitives
  directly without the generator. Framer Motion was rejected as unnecessary for the effects
  needed.

## R11. Testing strategy

- **Decision**:
  - **Unit (Vitest)**: `geometry.ts` (screen↔image mapping, clamping, normalization, minimum
    size, resize from each handle), `annotationReducer`, `assessQuality` and the threshold
    boundaries, the luma and Laplacian metric functions on synthetic pixel buffers,
    `classifyCameraError`, and the constraint and fallback builder.
  - **Component and integration (Vitest + React Testing Library + user-event, jsdom)**:
    - Every camera error state, rendered with a mocked `navigator.mediaDevices`.
    - Torch states (unsupported, pending, confirmed on, failure revert), with a fake
      `MediaStreamTrack`.
    - The annotation create/select/move/resize/rename/delete/undo flow, using synthetic Pointer
      Events with `getScreenCTM` stubbed.
    - Synchronized selection in the annotation list.
  - **End-to-end (Playwright, Chromium)**:
    - Run with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, which
      provides a real fake camera.
    - Covers capture → review (quality visible) → annotate (draw, label) at desktop and
      mobile-emulated (touch) viewports.
    - Checks alignment across a viewport resize by comparing the box's bounding rect to the
      image's rect.
    - Includes one permission-denied run.
- **Rationale**: This covers every testing requirement in the constitution, and the hardware
  dependence is isolated behind mocks. Playwright's fake camera lets the real capture path run in
  CI.
- **Alternatives considered**: Jest was rejected because Vitest shares Vite's configuration and
  is faster. Cypress was rejected because its fake-media and touch emulation are weaker than
  Playwright's. Snapshot-only tests were rejected because the constitution requires behavior
  assertions.

## R12. Tooling, local HTTPS & hosting

- **Decision**:
  - **Tooling**:
    - ESLint (flat config) with typescript-eslint, eslint-plugin-react-hooks and
      jsx-a11y, plus Prettier.
    - `tsc --noEmit` as the type gate.
    - npm scripts: `dev`, `dev:https`, `build`, `preview`, `lint`, `typecheck`, `test`,
      `test:e2e`.
  - **Local HTTPS**: `@vitejs/plugin-basic-ssl`, enabled by `dev:https` together with
    `--host`, so phones on the same network can open `https://<lan-ip>:5173`. The README
    documents the certificate warning. A tunnel (for example `cloudflared`) is the documented
    alternative.
  - **Hosting (bonus)**: Vercel as a static deployment, which gives automatic HTTPS (camera APIs
    need a secure context) and preview URLs. Netlify or GitHub Pages work just as well with
    `vite build`.
  - **Node**: 22 LTS.
- **Rationale**: These meet the constitution's quality gates and secure-context requirement, and
  getting a public HTTPS URL takes minimal effort.
- **Alternatives considered**: mkcert gives trusted local certificates but adds a setup step for
  reviewers. It is documented as optional.

## R13. Responsive layout & workflow UX

- **Decision**:
  - **Camera screen**: The preview fills the viewport (`object-fit: cover` for the preview
    only). Controls sit in a bottom bar in portrait and a side rail in landscape. The shutter is
    72 px, and the torch and camera-switch buttons are 48 px.
  - **Review screen**: The photo is shown with `object-fit: contain`. The quality card appears as
    a bottom sheet on phones and as a side panel at ≥ 1024 px. It offers Retake and Use Photo,
    and Retake is emphasized when the verdict is Poor.
  - **Annotate screen**: A toolbar offers a "drag to add a box" hint, Delete, the annotation list toggle and
    Back. The annotation list is a Radix Dialog bottom sheet below 768 px and a persistent side
    panel at ≥ 768 px. A compact quality badge sits in the toolbar and expands into a popover
    (FR-014).
  - **Step indicator**: Capture → Review → Annotate, shown in the header (FR-033).
  - **Preview vs capture**: The live preview uses `cover` to look good, which crops at the edges.
    The review screen shows the *full* captured frame, so nothing is silently cropped.
- **Rationale**: This meets FR-030–FR-034, keeps primary actions within thumb reach on phones,
  and gives desktop a split view.
