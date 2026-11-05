# Feature Specification: Burst Capture & Multi-Image Sessions

**Feature Branch**: `002-burst-multi-image-capture`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "User should be able to hold the capture button that will burst click
and capture multiple images in that holding period timeline. It will then in the review screen
provide with all the captured images, one can delete the captured images individually. In the
annotation screen, one should also add annotation per image from the captured images list. Add a
limit of burst time to which ever time limit you think should be ideal so that it doesn't freeze
the browser with resources usage."

## Context

Feature 001 delivered a one-photo-per-session flow: Capture → Review → Annotate. This feature turns
the session into a **set of photos**. Holding the shutter takes a rapid series of photos (a
"burst"). Review shows every photo in the session and lets the user delete any of them. Annotate
lets the user move between photos and annotate each one separately.

Per the project constitution (Principle I), every story here is an **enhancement**: none of them
is in the assignment's required scope, which feature 001 already completes. This feature MUST NOT
change what a single tap on the shutter does. The resource limits come from constitution
Principle VIII and are restated here as user-visible behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hold the shutter to take a burst (Priority: P1) · enhancement

The user points the camera at a moving or changing scene, presses and holds the shutter, and the
app keeps taking photos until they let go. A counter shows how many photos have been taken, and a
ring around the shutter fills up toward the burst time limit. When they release (or a limit is
reached), the app moves to Review with all the new photos.

**Why this priority**: This is the headline of the feature. Without it there is nothing to
review or annotate as a set.

**Independent Test**: On a phone, hold the shutter for about 2 seconds and release. Review must
show several photos (one per burst frame), each at the camera's full live resolution. A quick tap
must still produce exactly one photo, as before.

**Acceptance Scenarios**:

1. **Given** the live preview is showing, **When** the user taps the shutter (press shorter than
   0.3 seconds), **Then** exactly one photo is taken and Review opens, exactly as in feature 001.
2. **Given** the live preview is showing, **When** the user presses and holds the shutter for
   longer than 0.3 seconds, **Then** a burst starts: photos are taken one after another at about
   3 per second, a live counter shows the number taken, and a ring around the shutter shows
   progress toward the 3-second limit.
3. **Given** a burst is in progress, **When** the user releases the shutter, **Then** the burst
   stops, every photo taken so far is kept, and Review opens showing them.
4. **Given** a burst is in progress, **When** it reaches 3 seconds or 10 photos, **Then** it stops
   on its own, keeps the photos, and tells the user the limit was reached.
5. **Given** a burst is in progress, **When** the app is backgrounded, the system cancels the
   touch (for example, an incoming call), or the camera disconnects, **Then** the burst stops,
   keeps the photos taken so far, and explains why it stopped.
6. **Given** a burst is in progress, **When** the user's finger slides off the shutter while still
   pressing, **Then** the burst continues. Releasing anywhere on the screen ends it, as in common
   camera apps.
7. **Given** the user holds the shutter on a touch device, **When** the long-press lasts several
   seconds, **Then** no system menu, text selection or image-save prompt appears.
8. **Given** each photo in a burst, **When** it is shown in Review, **Then** its quality panel
   shows its own actual resolution and file size.

---

### User Story 2 - Review all photos and delete individual ones (Priority: P1) · enhancement

After capturing, Review shows a strip of thumbnails for every photo in the session, with the
selected photo shown large alongside its quality panel. The user removes unwanted photos one at a
time, can add more photos by going back to the camera, and continues to Annotate with the photos
they kept.

**Why this priority**: A burst always produces near-duplicates and some blurry frames. Picking
the keepers is the reason to burst at all.

**Independent Test**: Take a burst of 6 photos. In Review, select each thumbnail and confirm that
the large view and quality panel switch to it. Delete 2 photos, undo one deletion, and confirm 5
remain. Continue to Annotate and confirm only those 5 are available.

**Acceptance Scenarios**:

1. **Given** a session with several photos, **When** Review opens, **Then** a thumbnail strip shows
   every photo in capture order, the newest burst's first photo is selected, and the selected photo
   is shown large with its own quality panel.
2. **Given** the strip, **When** the user selects a thumbnail, **Then** the large view and the
   quality panel switch to that photo within 100 ms of the tap. The quality result may still be
   loading.
3. **Given** each thumbnail, **When** its quality has been assessed, **Then** it shows a small
   Good/Fair/Poor marker, so blurry or dark frames are easy to spot.
4. **Given** a selected photo with no annotations, **When** the user deletes it, **Then** it is
   removed immediately, the selection moves to the next photo (or the previous one if it was the
   last), and an Undo option is offered for at least 5 seconds.
5. **Given** a selected photo that already has annotations, **When** the user deletes it,
   **Then** the app first asks for confirmation and says how many annotations will be lost.
6. **Given** the user deletes the last remaining photo, **When** the deletion completes, **Then**
   the app returns to the camera with an empty session, and Undo is still offered.
7. **Given** a session below the session limit, **When** the user chooses "Add more", **Then** the
   camera opens, and new photos (single or burst) are added to the same session, not a new one.
8. **Given** a session with two or more photos, **When** the user chooses "Start over", **Then**
   the app always asks for confirmation ("Discard all N photos and their annotations?"), and only
   after the user confirms is every photo and annotation discarded and the camera opened.

---

### User Story 3 - Annotate each photo separately (Priority: P1) · enhancement

In Annotate, the same thumbnail strip lets the user switch between photos. Each photo has its own
boxes and labels. The annotation list shows only the current photo's annotations, and each
thumbnail shows how many annotations it has.

**Why this priority**: The user explicitly asked for per-image annotation. Without it, multiple
photos can't be annotated.

**Independent Test**: With 3 photos, draw 2 boxes on photo 1, switch to photo 2 and draw 1 box,
then switch back to photo 1. Photo 1 must still show exactly its 2 boxes in the same places, and
photo 2 must still show its 1 box. The strip must show counts 2, 1 and 0.

**Acceptance Scenarios**:

1. **Given** a session with several photos, **When** Annotate opens, **Then** the photo selected in
   Review is shown, and the strip lets the user switch to any other photo.
2. **Given** photo A has annotations, **When** the user switches to photo B, **Then** only photo
   B's annotations are shown, selectable or editable. Photo A's annotations are unchanged when the
   user switches back.
3. **Given** boxes drawn on photos of different resolutions (for example a single capture and a
   burst frame), **When** each photo is shown, **Then** each box stays aligned with the content it
   was drawn on.
4. **Given** the annotation list, **When** it is open, **Then** it lists only the current photo's
   annotations, and "Clear all" clears only the current photo.
5. **Given** the strip, **When** a photo has annotations, **Then** its thumbnail shows the count.
6. **Given** an Undo is pending for a deleted annotation, **When** the user switches photos,
   **Then** the Undo still restores the annotation to the photo it came from.
7. **Given** a photo is being annotated, **When** the user deletes the photo from the strip,
   **Then** the confirmation from US2-5 applies, and the view moves to a neighbouring photo.
8. **Given** the user exports, **When** they choose Export, **Then** it applies to the current
   photo, as in feature 001.

---

### User Story 4 - Stay within safe limits (Priority: P1) · enhancement

However long the user holds the shutter and however many bursts they take, the app stays smooth
and never crashes or reloads the tab. When a limit is reached, the app says so plainly and offers
the next step.

**Why this priority**: The user explicitly asked for a limit "so that it doesn't freeze the
browser". A burst that hangs the tab is worse than having no burst.

**Independent Test**: On a mid-range phone, take bursts until the session is full (20 photos).
The live preview and controls must stay responsive throughout, each burst must stop at its
limit, and the shutter must then be disabled with an explanation. Delete 3 photos and confirm the
shutter works again.

**Acceptance Scenarios**:

1. **Given** any burst, **When** it runs, **Then** it never exceeds 3 seconds or 10 photos.
2. **Given** a slow device, **When** a burst runs, **Then** it takes fewer photos rather than
   falling behind. The preview keeps moving and the shutter stays responsive.
3. **Given** a session with 20 photos, **When** the user returns to the camera, **Then** the
   shutter is disabled and the app says "Session full (20 photos). Delete some photos to take
   more."
4. **Given** a session near the limit (for example 15 photos), **When** a burst runs, **Then** it
   stops when the session reaches 20 photos and says the session is full.
5. **Given** a session whose photos together approach the memory budget, **When** a burst would
   push it over, **Then** the burst stops before exceeding it and explains why.
6. **Given** a photo is deleted or the session is cleared, **When** the deletion is final (after
   the Undo window), **Then** the memory it used is released.
7. **Given** a burst has just finished, **When** Review opens, **Then** quality is checked first
   for the photo on screen and then for the others one at a time, and the app stays responsive
   while it does so.

---

### User Story 5 - Burst without holding (keyboard and accessibility) (Priority: P2) · enhancement

A user who can't easily press and hold, or who uses a keyboard, can start a burst with a separate
"Burst" control. It runs until the time limit or until they activate it again.

**Why this priority**: The constitution requires a burst alternative that doesn't rely on
holding (Principle V). It matters, but it is secondary to the main gesture.

**Independent Test**: Using only the keyboard, tab to the Burst button and press Enter. A burst
starts and stops by itself at 3 seconds. Start another and press Enter again after 1 second; it
stops early. Both bursts' photos appear in Review.

**Acceptance Scenarios**:

1. **Given** the camera screen, **When** the user tabs through the controls, **Then** a Burst
   control is reachable, with an accessible name that explains it ("Take a burst of photos, up to
   3 seconds").
2. **Given** the Burst button is activated, **When** the burst runs, **Then** it behaves like a
   held shutter: the same counter, progress, limits and stop reasons.
3. **Given** a running burst started from the Burst button, **When** the user activates the
   control again, **Then** the burst stops and keeps its photos.
4. **Given** a screen reader is running, **When** a burst ends, **Then** the number of photos taken
   and the reason it stopped are announced.

---

### User Story 6 - Choose several existing photos (Priority: P3) · enhancement

From the camera screen (or when the camera is unavailable), the user can choose several photos
from their device at once, and they join the session like captured photos.

**Why this priority**: It extends feature 001's upload fallback to multi-photo sessions, which is
useful on desktops without a camera. It is not essential to the burst experience.

**Independent Test**: Choose 4 photos in the file picker. All 4 appear in Review in the order
chosen, each with its own quality panel.

**Acceptance Scenarios**:

1. **Given** the file picker, **When** the user selects several image files, **Then** each valid
   image is added to the session, up to the session limit.
2. **Given** a selection that would exceed the session limit, **When** the photos are added,
   **Then** only as many as fit are added, and the app says how many were skipped and why.
3. **Given** a selection that includes a file that isn't a readable image, **When** the photos are
   added, **Then** that file is skipped with a message and the rest are still added.

---

### Edge Cases

- **Tap versus hold near the threshold**: A press of exactly 0.3 seconds or less is a tap and gives
  one photo. The burst never takes an extra photo when the user meant to tap.
- **Release before the first burst frame finishes**: The frame in progress completes and is kept.
  It is never discarded half-saved.
- **Second finger during a hold**: A second touch on the shutter doesn't start a second burst or
  stop the current one. Each burst comes from exactly one press.
- **Rotating the phone mid-burst**: The burst continues. Each photo keeps the orientation it was
  captured in.
- **Camera switched or torch toggled during a burst**: Those controls are unavailable while a burst
  runs, and become available again when it ends.
- **Torch during a burst**: If the torch was on when the burst started, it stays on until the burst
  ends.
- **Duplicate-looking frames**: The app doesn't de-duplicate. Every frame taken is shown, and the
  user deletes what they don't want.
- **Deleting the selected photo while its quality is still being checked**: The check is cancelled
  or ignored, and no result appears for a deleted photo.
- **Undo after the session filled up again**: If undoing a deletion would push the session over 20
  photos, the Undo is unavailable, and the app says why.
- **Navigating Back to Review from Annotate**: All photos and every photo's annotations are kept.
- **Page reload**: As in feature 001, the session lives only in memory, so a reload starts an empty
  session.

## Requirements *(mandatory)*

### Functional Requirements

**Burst capture**

- **FR-001**: A press on the shutter shorter than or equal to 0.3 seconds MUST take exactly one
  photo, using the same single-capture behavior as feature 001.
- **FR-002**: A press held longer than 0.3 seconds MUST start a burst that takes photos one after
  another, at a target rate of about 3 per second, until the burst stops.
- **FR-003**: A burst MUST stop when the user releases the press (anywhere on the screen), the
  system cancels the press, the app is backgrounded, the camera stream is interrupted, or any limit
  in FR-010 to FR-013 is reached. Sliding off the shutter while still pressing MUST NOT stop the
  burst. Every photo completed before the stop MUST be kept.
- **FR-004**: The next burst photo MUST NOT start until the previous one has finished saving. On
  slow devices a burst therefore takes fewer photos and never falls behind.
- **FR-005**: Burst photos MUST be captured at the camera's full live resolution, never at the
  size of the on-screen preview. Each photo MUST record and display its own actual resolution.
- **FR-006**: While a burst runs, the camera screen MUST show a live photo counter and progress
  toward the time limit. Every photo taken MUST give visible feedback within 100 ms.
- **FR-007**: When a burst stops for any reason other than the user releasing or re-activating it,
  the app MUST tell the user why (time limit, photo limit, session full, memory limit, app
  backgrounded, camera disconnected).
- **FR-008**: Long-press side effects (system context menu, text selection, image-save prompt,
  haptic menus) MUST NOT appear when holding the shutter.
- **FR-009**: Camera switching and the torch toggle MUST be unavailable during a burst. The torch
  state at burst start MUST be kept for the whole burst.

**Limits (constitution Principle VIII)**

- **FR-010**: A burst MUST last at most **3 seconds**.
- **FR-011**: A burst MUST take at most **10 photos**.
- **FR-012**: A session MUST hold at most **20 photos** in total. When it is full, the shutter and
  Burst button MUST be disabled with the message "Session full (20 photos). Delete some photos to
  take more."
- **FR-013**: A session MUST hold at most **150 MB** of photo data. A burst MUST stop before a photo
  would exceed this, and adding photos MUST be refused with an explanation once it is reached.
- **FR-014**: While a burst is running, quality analysis MUST NOT run. Analysis MUST run afterwards
  one photo at a time, starting with the photo on screen.
- **FR-015**: When a photo's deletion becomes final (after its Undo window), or the session is
  cleared, the memory held for that photo MUST be released.

**Multi-photo review**

- **FR-016**: Review MUST show a thumbnail strip of every photo in the session, in capture order,
  with the selected photo shown large together with its own quality panel.
- **FR-017**: Thumbnails MUST be small previews, never the full-resolution photos, and each MUST
  show its quality verdict once assessed.
- **FR-018**: The user MUST be able to delete any single photo. Deletion MUST be undoable for at
  least 5 seconds. Deleting a photo that has annotations MUST first ask for confirmation, stating
  how many annotations will be lost.
- **FR-019**: After a deletion, the selection MUST move to the next photo, or to the previous one if
  the deleted photo was last. Deleting the only photo MUST return the user to the camera.
- **FR-020**: Review MUST offer "Add more", which returns to the camera and adds new photos to the
  same session, and "Start over", which discards the whole session. "Start over" MUST always ask
  for confirmation, stating the number of photos (and annotations, if any) that will be discarded
  (constitution V). It is not undoable.
- **FR-021**: Review MUST offer "Continue to annotate", which opens Annotate on the selected photo.

**Per-photo annotation**

- **FR-022**: Every annotation MUST belong to exactly one photo, and its position MUST be stored
  relative to that photo's full-resolution image.
- **FR-023**: Annotate MUST show the same thumbnail strip. Switching photos MUST show only the
  selected photo's annotations, and MUST leave every other photo's annotations unchanged.
- **FR-024**: Each thumbnail MUST show the number of annotations on that photo.
- **FR-025**: The annotation list, "Clear all", keyboard shortcuts and Undo MUST act on the current
  photo only. A pending Undo MUST restore an annotation to the photo it was deleted from, even
  after the user switches photos.
- **FR-026**: Deleting a photo MUST delete its annotations with it, and undoing the photo deletion
  MUST restore them.
- **FR-027**: All feature 001 annotation behavior (draw, select, move, resize, label, delete,
  alignment at any size, list, export) MUST work unchanged for whichever photo is selected.
  Export applies to the current photo.

**Accessibility and alternatives**

- **FR-028**: The camera screen MUST provide a Burst button that starts a burst without holding,
  stops it when activated again, and follows the same limits and feedback. Its accessible name
  MUST explain what it does.
- **FR-029**: The number of photos taken and the reason a burst stopped MUST be announced to
  assistive technology.
- **FR-030**: The thumbnail strip MUST be fully keyboard-operable (move between photos, delete the
  focused photo), and every thumbnail MUST have an accessible name with its position, quality
  verdict and annotation count.

**Multiple uploads (P3)**

- **FR-031**: The "Choose a photo" option MUST accept several image files at once and add each
  readable image to the session, up to the session and memory limits. It MUST report any files
  that were skipped and why.

**Compatibility**

- **FR-032**: A session containing a single photo MUST look and behave like feature 001, apart
  from one added "Add more" link in Review. The strip MUST be hidden when there is only one photo.
- **FR-033**: All photos and annotations MUST stay on the device, as in feature 001.

### Key Entities

- **Session**: The ordered set of photos the user is working on. Attributes: photos in capture
  order, the selected photo, total photo data held, and whether it is full (by count or memory).
- **Photo**: One image in the session, from a single capture, a burst, or an upload. Attributes:
  its image data, actual resolution, file size, source, capture method, capture time, the burst it
  belongs to (if any), and its quality assessment (computed lazily). It extends feature 001's
  Captured Image.
- **Burst**: One continuous run of captures. Attributes: start time, photos taken, and the reason it
  stopped (released, time limit, photo limit, session full, memory limit, backgrounded, camera
  interrupted).
- **Annotation**: As in feature 001, plus the photo it belongs to. Geometry is relative to that
  photo's full-resolution image.
- **Pending deletion**: A deleted photo (with its annotations) that can still be restored during
  its Undo window, after which its memory is released.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the reference Android phone, holding the shutter for 3 seconds produces at least 6
  photos, each at the camera's full live resolution.
- **SC-002**: A tap on the shutter produces exactly one photo in 100% of 20 trials (no accidental
  bursts).
- **SC-003**: During any burst on the reference phone, no single blocking task takes longer than
  50 ms (so the live preview never visibly freezes), and the burst stops within 0.2 seconds of the
  user releasing the shutter.
- **SC-004**: No burst ever exceeds 3 seconds or 10 photos, and no session ever exceeds 20 photos
  or 150 MB, across 50 automated trials that include slow-device simulation.
- **SC-005**: Filling a session to 20 photos through repeated bursts on a mid-range phone never
  crashes or reloads the browser tab.
- **SC-006**: Switching between photos in Review or Annotate updates the main view within 0.1
  seconds.
- **SC-007**: Annotations never appear on, or change, a photo they don't belong to, in 100% of
  automated switch-and-edit trials.
- **SC-008**: A user can take a burst, delete 2 unwanted photos, and annotate 2 of the remaining
  photos in under 2 minutes, on both a phone and a desktop.
- **SC-009**: Every feature 001 test continues to pass unchanged, other than tests that assumed a
  one-photo session.

## Assumptions

- **Limits**: The limits (3 seconds, 10 photos per burst, 20 photos per session, 150 MB, about 3
  photos per second) come from constitution Principle VIII. They were chosen so the worst case
  (12 MP photos at about 4 MB each) stays near 40 MB per burst, well inside mobile browser memory.
- **Burst resolution**: Burst photos use the camera's full live video resolution. On phones whose
  still-photo mode is higher resolution (such as the 12.5 MP reference phone), burst photos can be
  smaller than single captures. This trade-off keeps the burst rate usable, and each photo reports
  its own resolution.
- **Session lifetime**: As in feature 001, the session exists only in memory for the current page.
  Persistence across reloads is out of scope.
- **Ordering**: Photos stay in capture order. Reordering, favourites and best-shot selection are
  out of scope.
- **Export**: Export stays per photo, as in feature 001. Exporting all photos at once is out of
  scope.
- **Undo window**: The 5-second Undo window from feature 001 applies to photo deletion too. Photo
  memory is held until the window closes.
- **Tap threshold**: 0.3 seconds is the boundary between tap and hold, matching common camera apps
  and the constitution.
