# Feature Specification: Image Capture & Annotation

**Feature Branch**: `001-image-capture-annotation`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Frontend Engineering Assignment: Image Capture & Annotation. Build an
application that captures high-quality images using the device's camera and allows users to annotate
the captured images: live camera preview, highest practical resolution, capture/preview/retake,
graceful permission and unsupported-device handling, torch toggle reflecting actual state, visible
image quality indicator with resolution, file size and thresholds, rectangular bounding-box
annotation (select, move, resize, delete, label) that stays aligned when the image is resized,
annotation management, and a responsive, touch-friendly UI across desktop, tablet and mobile.
Deliverables: source repository, README, demo, technical notes; bonus for public hosting."

## User Scenarios & Testing *(mandatory)*

Each story is tagged **core** (it traces directly to an assignment requirement) or **enhancement**,
as the project constitution (Principle I) requires. All core stories must work end to end before
any enhancement is started.

### User Story 1 - Capture and review a high-quality photo (Priority: P1) · core

A user opens the app, grants camera access, sees a live preview from the camera, and captures a
photo. The captured photo is shown for review at full quality. The user can either retake it
(back to the live preview) or accept it and continue to annotation.

**Why this priority**: Nothing else in the app works without a captured image. This is the first
evaluation criterion (capture quality and resolution handling).

**Independent Test**: On a device with a camera, open the app, allow access, capture a photo,
confirm the review screen shows it, retake, capture again, and accept. This delivers value on its
own: a full-resolution photo captured in the browser.

**Acceptance Scenarios**:

1. **Given** the user has granted camera access, **When** the camera screen opens, **Then** a live
   preview appears within 3 seconds and fills the available space without distortion.
2. **Given** a live preview is showing, **When** the user taps Capture, **Then** visible
   confirmation (for example a shutter flash) appears immediately and the review screen shows the
   captured photo.
3. **Given** a photo was captured, **When** its resolution is inspected, **Then** it matches the
   highest resolution the device and browser actually delivered, not the size of the on-screen
   preview.
4. **Given** the review screen is showing, **When** the user taps Retake, **Then** the photo is
   discarded and the live preview resumes.
5. **Given** the review screen is showing, **When** the user taps Use Photo, **Then** the app
   moves to the annotation screen with that photo.
6. **Given** the device has more than one camera, **When** the camera screen opens, **Then** the
   rear-facing camera is used by default, and the user can switch cameras if more than one is
   available.

---

### User Story 2 - Draw and edit bounding-box annotations (Priority: P1) · core

On the annotation screen, the user draws rectangular boxes around areas of interest with a
mouse, finger, or pen. They can select a box, move it, resize it from its corners or edges, give
it a text label, and delete it.

**Why this priority**: Annotation is the second half of the product's purpose and a major
evaluation area (accuracy, editing operations).

**Independent Test**: Load any captured or provided photo on the annotation screen. Draw three
boxes, label each one, move one, resize another, delete the third, and confirm the results look
right on both a touch device and a desktop.

**Acceptance Scenarios**:

1. **Given** a photo is on the annotation screen, **When** the user presses on an empty area of the
   image and drags, **Then** a rectangle follows the pointer, and when they release, a new
   annotation is created and selected.
2. **Given** an annotation exists, **When** the user taps or clicks it, **Then** it becomes
   selected, with visible resize handles and a distinct highlight. Any other selection is cleared.
3. **Given** an annotation is selected, **When** the user drags its body, **Then** it moves with
   the pointer and cannot be dragged outside the image.
4. **Given** an annotation is selected, **When** the user drags a corner or edge handle, **Then**
   it resizes from that handle, stays inside the image, and cannot shrink below the minimum size.
5. **Given** an annotation is selected, **When** the user enters or edits its label and confirms,
   **Then** the label is shown attached to the box on the image.
6. **Given** an annotation is selected, **When** the user chooses Delete (a button, or the
   Delete/Backspace key on desktop), **Then** the annotation is removed and the user can undo the
   removal for at least 5 seconds.
7. **Given** a drag is shorter than the minimum box size, **When** the user releases, **Then** no
   annotation is created. This means a tap is treated as a selection or deselection, not a box.

---

### User Story 3 - Annotations stay aligned at any size (Priority: P1) · core

The user rotates the device, resizes the browser window, or opens the same photo on a smaller
screen, and every box still outlines exactly the same area of the photo.

**Why this priority**: The assignment calls out alignment across image sizes explicitly, and
misaligned boxes make the annotations worthless.

**Independent Test**: Draw a box tightly around a recognizable object. Resize the window from
desktop width to phone width, and rotate a tablet between portrait and landscape. The box must
still tightly outline the object at every size.

**Acceptance Scenarios**:

1. **Given** annotations exist, **When** the displayed image size changes for any reason (window
   resize, orientation change, panel opening or closing), **Then** every box keeps its position
   and size relative to the image content.
2. **Given** an annotation was drawn on a small screen, **When** its stored coordinates are
   compared to the full-resolution image, **Then** they map to the same region of the photo,
   within 1% of the image dimensions.

---

### User Story 4 - See and act on image quality (Priority: P2) · core

After capturing, the user sees a quality indicator on the review and annotation screens. It shows
the photo's resolution, file size, and an overall verdict (Good / Fair / Poor). If the photo
falls short of a threshold, it explains what is wrong and how to improve the photo (for example,
"Image is too dark — turn on the torch or move to better light"), so the user can decide whether
to retake.

**Why this priority**: The quality indicator is a required feature, but the core loop of capture
and annotate is viable without it.

**Independent Test**: Capture one photo in good light and one in a dark room, with the lens
partly covered or the camera moving. The first must show "Good". The second must show a lower
verdict with specific, actionable messages.

**Acceptance Scenarios**:

1. **Given** a photo has been captured, **When** the review screen appears, **Then** the quality
   indicator is visible without scrolling and shows the actual pixel dimensions (for example
   "4032 × 3024 · 12.2 MP") and the file size (for example "3.4 MB").
2. **Given** a photo is below a quality threshold (see FR-020), **When** the indicator is shown,
   **Then** it shows a lower verdict, names each failed check, and offers one improvement tip per
   failed check.
3. **Given** a photo is rated Poor, **When** the user looks at the review screen, **Then** Retake
   is visually emphasized, but the user can still choose to continue with the photo.
4. **Given** the user is on the annotation screen, **When** they look for quality information,
   **Then** a compact version of the indicator is still visible and can be expanded for details.

---

### User Story 5 - Clear guidance when the camera is unavailable (Priority: P2) · core

When the camera can't be used, because permission was denied, there is no camera, the camera is
busy, the browser is unsupported, or the page isn't secure, the user sees a clear explanation of
what happened and what they can do. They are never left with a blank or frozen screen. As a
fallback, they can choose an existing photo from the device and continue to quality review and
annotation.

**Why this priority**: Error handling is a stated evaluation criterion, and a dead end blocks
users from the whole product. It is P2 only because the happy path has to exist first.

**Independent Test**: Deny the permission prompt, then revoke an earlier permission, then use a
desktop with no camera, then open the camera in another app. Each case must show its own
explanation with a working next step.

**Acceptance Scenarios**:

1. **Given** the user has not yet decided on permission, **When** the camera screen opens,
   **Then** a short explanation of why camera access is needed is shown alongside the browser's
   prompt.
2. **Given** the user denies camera permission, **When** the denial is detected, **Then** the app
   explains that access was blocked, describes how to re-enable it, and offers "Try again" and
   "Choose a photo instead".
3. **Given** no camera is available, **When** the camera screen opens, **Then** the app says no
   camera was found and offers "Choose a photo instead".
4. **Given** the camera is in use by another application, **When** access fails, **Then** the app
   says so and offers "Try again".
5. **Given** the browser does not support camera access or the page isn't secure, **When** the app
   loads, **Then** it explains the limitation and offers the photo-upload fallback.
6. **Given** the camera stream stops unexpectedly (device unplugged, permission revoked mid-use),
   **When** the interruption happens, **Then** the preview is replaced by an explanatory message
   with a "Reconnect" action.

---

### User Story 6 - Control the torch on supported devices (Priority: P2) · core

On a phone whose camera has a flashlight, the user taps a torch toggle on the camera screen to
light the scene. The toggle always shows the torch's real state. On devices or browsers where
the torch can't be controlled, the toggle is clearly unavailable, not a button that silently does
nothing.

**Why this priority**: The torch toggle is a required feature, but it only affects some devices and
doesn't block the core flow.

**Independent Test**: On an Android phone with Chrome, toggle the torch on and off and confirm the
light matches the control every time. On iOS Safari or a desktop, confirm the toggle is shown as
unavailable with an explanation.

**Acceptance Scenarios**:

1. **Given** the active camera supports torch control, **When** the camera screen is showing,
   **Then** an enabled torch toggle is visible.
2. **Given** the torch is off, **When** the user taps the toggle, **Then** the toggle shows "on"
   only after the device confirms that the torch is lit. A pending indicator shows while the user
   waits for that confirmation.
3. **Given** turning the torch on fails, **When** the failure happens, **Then** the toggle stays
   "off" and a brief message explains that the torch could not be turned on.
4. **Given** the active camera doesn't support torch control, **When** the camera screen is
   showing, **Then** the toggle is disabled or hidden, and an explanation such as "Flash isn't
   supported on this device or browser" is shown.
5. **Given** the torch is on, **When** the user captures a photo, switches cameras, or leaves the
   camera screen, **Then** the torch state shown matches the real hardware state (off whenever the
   stream stops).

---

### User Story 7 - View and manage all annotations (Priority: P2) · core

The user opens an annotation list showing every box with its label. From the list they can
select a box (highlighting it on the image), rename it, delete it, or clear all annotations.

**Why this priority**: Required by the assignment ("view and manage annotations"). It builds on
User Story 2.

**Independent Test**: Create five annotations, open the list, rename one, delete one from the list,
and select one from the list. Confirm each action is reflected on the image straight away.

**Acceptance Scenarios**:

1. **Given** annotations exist, **When** the user opens the annotation list, **Then** each one is
   listed with its label (or "Untitled" plus a number) in creation order, along with a total count.
2. **Given** the list is open, **When** the user selects an entry, **Then** the matching box is
   selected and highlighted on the image, and the reverse also holds: selecting a box on the image
   highlights its list entry.
3. **Given** the list is open, **When** the user renames or deletes an entry, **Then** the image
   updates immediately.
4. **Given** annotations exist, **When** the user chooses "Clear all", **Then** they are asked to
   confirm before everything is removed.
5. **Given** no annotations exist, **When** the list is shown, **Then** an empty state explains how
   to draw the first box.
6. **Given** the screen is phone-sized, **When** the list is opened, **Then** it appears as a panel
   (for example a bottom sheet) that can be dismissed without covering the image permanently.

---

### User Story 8 - Export the annotated result (Priority: P3) · enhancement

The user downloads the annotations as a structured data file, and optionally the photo with the
boxes drawn on it, to use elsewhere.

**Why this priority**: The assignment doesn't require this. It is useful for the demo and real
use, but must wait until all core stories are done.

**Independent Test**: Annotate a photo, export it, and confirm the downloaded data lists every box
with its label and its coordinates relative to the full-resolution image.

**Acceptance Scenarios**:

1. **Given** annotations exist, **When** the user chooses Export data, **Then** a file is
   downloaded containing the image dimensions and, for every annotation, its label and box
   coordinates in full-resolution image pixels.
2. **Given** annotations exist, **When** the user chooses Export image, **Then** a full-resolution
   copy of the photo is downloaded with the boxes and labels drawn on it.

---

### Edge Cases

- **Very small or very large source images**: A photo below the minimum resolution is accepted,
  but rated Poor. A very large photo (for example 48 MP or more) must not freeze the interface, and
  a processing indicator is shown while it is prepared.
- **Unsupported resolution request**: If the device rejects the preferred high resolution, the app
  falls back automatically to the best resolution it accepts, without showing the user an error.
- **Orientation change mid-capture**: Rotating the device while the preview is showing does not
  break the preview, and the captured photo keeps the correct orientation.
- **Overlapping annotations**: When boxes overlap, a tap selects the topmost one (the smallest, or
  the most recently selected). The list gives a reliable way to select any box.
- **Drawing starts on an existing box**: Pressing on an unselected box selects it rather than
  starting a new box. Drawing always starts from an empty image area, with no mode switch
  needed between boxes.
- **Accidental gestures on touch**: Multi-touch gestures, such as a two-finger pinch or scroll, do
  not create or change annotations, and page scrolling does not happen while a box is being
  dragged.
- **Retake with annotations**: Retaking or replacing a photo that has annotations asks for
  confirmation first, because the annotations will be lost.
- **Long labels**: Labels are limited to 50 characters. Long labels are truncated with an ellipsis
  on the image and shown in full in the list.
- **Page hidden or app backgrounded**: The camera (and torch) are released when the page is
  hidden and resume when the user comes back to the camera screen.
- **Multiple cameras with mixed torch support**: Torch availability is re-evaluated whenever the
  active camera changes.
- **Upload fallback with an unsupported file**: Choosing a file that isn't an image, or that can't
  be read, shows a clear error and does not leave the app in a broken state.

## Requirements *(mandatory)*

### Functional Requirements

**Camera & capture**

- **FR-001**: The system MUST show a live camera preview after the user grants camera access.
- **FR-002**: The system MUST capture photos at the highest resolution the active camera and browser
  make available, independent of the size of the on-screen preview.
- **FR-003**: The system MUST fall back automatically to the best supported resolution when the
  preferred resolution is unavailable, without showing an error.
- **FR-004**: The system MUST prefer the rear-facing camera by default and MUST let users switch
  between cameras when more than one is available.
- **FR-005**: The system MUST show the captured photo for review, with Retake and Use Photo actions.
- **FR-006**: The system MUST release the camera when the user leaves the camera screen, after a
  photo is accepted, and when the app is hidden or backgrounded.
- **FR-007**: The system MUST preserve the captured photo at full resolution, without visible
  quality loss, throughout review and annotation.

**Torch**

- **FR-008**: The system MUST detect whether the active camera supports torch control, and MUST
  show an enabled torch toggle only when it does.
- **FR-009**: The torch toggle MUST reflect the hardware's confirmed torch state, MUST show a
  pending state while a change is being applied, and MUST revert and notify the user if a change
  fails.
- **FR-010**: Where torch control is unsupported, the system MUST show the toggle as unavailable
  with an explanation, or hide it.

**Permissions & failure handling**

- **FR-011**: The system MUST distinguish these conditions and present a specific message and
  recovery action for each: permission not yet granted, permission denied, no camera found, camera
  busy or unreadable, camera access unsupported, insecure page, and stream interrupted.
- **FR-012**: The system MUST offer a "choose a photo from the device" fallback whenever live
  capture is unavailable. Photos chosen this way MUST go through the same quality review and
  annotation flow.
- **FR-013**: The system MUST never show a blank or frozen screen. Any unexpected error MUST show a
  recoverable error view that offers to restart the current step.

**Image quality**

- **FR-014**: The system MUST show a quality indicator on the review screen (prominent) and on the
  annotation screen (compact, expandable).
- **FR-015**: The quality indicator MUST show the actual pixel dimensions, the megapixel count, the
  file size, and an overall verdict of Good, Fair, or Poor.
- **FR-016**: The system MUST evaluate each photo against the defined thresholds for resolution,
  file size, brightness (too dark or overexposed), and sharpness (blur).
- **FR-017**: For each failed check, the system MUST show a plain-language message and an
  improvement tip.
- **FR-018**: The overall verdict MUST be the worst result among the individual checks.
- **FR-019**: The system MUST visually emphasize Retake when the verdict is Poor, and MUST still
  let the user continue. In that case the continue action is labeled "Use anyway" instead of
  "Use Photo".
- **FR-020**: These quality thresholds apply. All of them MUST be documented in one place and in
  the README.

  | Check | Good | Fair | Poor |
  |-------|------|------|------|
  | Resolution | ≥ 5 MP | 2 MP – < 5 MP | < 2 MP |
  | File size | 500 KB – 15 MB | 150–500 KB, or > 15 MB | < 150 KB |
  | Brightness (mean luminance) | 25%–80% | 15%–25%, or 80%–90% | < 15% or > 90% |
  | Sharpness | at or above the "sharp" threshold | between the thresholds | below the "blurry" threshold |

  The sharpness thresholds start at provisional values and are calibrated on the reference devices
  during implementation, then documented.

**Annotation**

- **FR-021**: Users MUST be able to draw rectangular bounding boxes on the photo with mouse, touch,
  or pen.
- **FR-022**: Users MUST be able to select, move, resize (from all four corners and edges), label,
  and delete any annotation.
- **FR-023**: Annotations MUST be constrained to the image bounds and MUST NOT be smaller than a
  minimum size. The minimum is 1% of the image's shorter side, and never less than 24 CSS px on
  screen.
- **FR-024**: Annotation positions MUST be stored relative to the full-resolution image, so that
  boxes stay aligned with the same image content at every display size and orientation.
- **FR-025**: Each annotation MUST have a label of up to 50 characters. An annotation without a
  label MUST display a default name.
- **FR-026**: The system MUST let the user undo a deletion for at least 5 seconds.
- **FR-027**: The system MUST provide an annotation list showing all annotations, with
  synchronized selection, renaming, deletion, a total count, and a confirmed "Clear all".
- **FR-028**: The system MUST ask for confirmation before discarding annotations when the user
  retakes the photo or replaces it, from either the Review or the Annotate screen.
- **FR-029**: On desktop, the system MUST support keyboard shortcuts for deleting the selected
  annotation (Delete/Backspace) and deselecting it (Escape).

**UI/UX & responsiveness**

- **FR-030**: The interface MUST be fully usable at phone (around 360 px wide), tablet (around
  768 px), and desktop (1280 px and wider) sizes, in both portrait and landscape.
- **FR-031**: Every touch target MUST be at least 44 × 44 CSS px, including annotation resize
  handles.
- **FR-032**: Every user action MUST give visible feedback within 100 ms. Operations that take
  longer than 300 ms MUST show a progress or processing indicator.
- **FR-033**: The workflow MUST make the current step clear (Capture → Review → Annotate) and MUST
  let users go back a step.
- **FR-034**: All controls MUST be reachable by keyboard and have accessible names. Status messages
  (errors, quality verdicts, torch state) MUST be announced to assistive technology.
- **FR-035**: Photos and annotations MUST stay on the user's device. Nothing is uploaded to any
  server.

**Enhancement (only after all core requirements are met)**

- **FR-036**: Users MAY export annotations as a structured data file, with coordinates in
  full-resolution pixels, and MAY export the photo with the annotations drawn on it.

**Delivery requirements**

- **FR-037**: The project MUST include a README with setup instructions, implementation decisions,
  library choices, the quality thresholds and the reasons for them, supported browsers and devices,
  and known limitations.
- **FR-038**: The project MUST include technical notes explaining the image capture strategy, the
  quality assessment, and the annotation approach.
- **FR-039**: The project MUST include automated tests covering the quality evaluation, annotation
  geometry and alignment, camera failure states, torch states, and the annotation editing flow.
- **FR-040** (bonus): The application SHOULD be hosted at a public, secure URL that is listed in the
  README.

### Key Entities

- **Captured Image**: A single photo being worked on. Attributes: image data, pixel width and
  height, file size, source (camera or uploaded file), capture time, and the camera used (when
  known).
- **Quality Assessment**: The result of evaluating a Captured Image. Attributes: individual check
  results (resolution, file size, brightness, sharpness), each with a measured value, a rating
  (Good / Fair / Poor) and an improvement tip, plus the overall verdict.
- **Annotation**: A labeled rectangular region on a Captured Image. Attributes: a unique
  identifier, a label, and position and size relative to the full-resolution image, in creation
  order. A Captured Image has zero or more Annotations.
- **Camera Session**: The current state of camera access. Attributes: permission status, the
  active camera, the available cameras, the delivered resolution, torch support, the confirmed
  torch state, and any error condition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can go from opening the app to a captured photo with at least one
  labeled annotation in under 60 seconds, on both a phone and a desktop.
- **SC-002**: The resolution of the captured photo equals the maximum resolution the device
  delivered to the browser in 100% of captures on the tested reference devices (at least one
  Android phone, one iPhone, and one laptop webcam).
- **SC-003**: After any resize or orientation change, every annotation stays within 1% of its
  original position and size relative to the image content.
- **SC-004**: All defined camera-failure conditions (FR-011) show a specific message and a working
  recovery action. No failure leaves the user on a blank or frozen screen.
- **SC-005**: The displayed torch state matches the physical torch in 100% of toggles on supported
  devices, and no enabled torch control appears on unsupported devices.
- **SC-006**: In a hallway test with 5 users, at least 4 can draw, move, resize, label and delete a
  box on a touch device without help, on the first attempt.
- **SC-007**: A dark or blurry photo receives a verdict below Good, with a specific tip, in at least
  9 of 10 deliberately degraded test captures. A well-lit, steady photo receives "Good" in at least
  9 of 10 captures.
- **SC-008**: Quality information appears on the review screen within 1 second of capture for
  photos up to 12 MP.
- **SC-009**: The app passes the layout checks at the three reference sizes, in both orientations,
  with no content clipped, overlapping, or requiring horizontal scrolling.
- **SC-010**: A reviewer can set up and run the project locally by following only the README, in
  under 10 minutes.

## Assumptions

- **Single-image session**: The user works on one photo at a time. Annotations live for the session
  and are not kept after a page reload. Persistence and multiple images are out of scope.
- **No accounts or backend**: The app runs entirely in the browser. There is no sign-in, server
  storage, or sharing.
- **Reference platforms**: Current Chrome on Android and desktop, and current Safari on iOS and
  macOS. Other modern browsers are supported on a best-effort basis. Torch control is expected to
  work on Chrome for Android only. iOS Safari is expected to show the torch as unsupported, which
  is acceptable.
- **Secure context**: Camera access needs a secure page (HTTPS, or local development on the same
  machine). Testing on mobile devices uses a secure local or hosted URL.
- **Labels**: Free-text labels are sufficient. There is no predefined label taxonomy, no colors per
  class, and no multi-select editing.
- **Rectangles only**: Rotated boxes, polygons, freehand drawing, and zoom or pan of the image are
  out of scope, apart from what the browser natively provides.
- **Thresholds**: The quality thresholds in FR-020 are reasonable defaults for document and object
  photography on modern devices. They can be tuned, and they are justified in the README.
- **Upload fallback**: Choosing an existing photo is in scope only as a fallback, and to support
  desktops without a camera. It is not a separate gallery feature.
- **Demo video**: Recording the demo video is a manual deliverable outside the application.
