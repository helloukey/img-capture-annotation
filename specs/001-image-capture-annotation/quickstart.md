# Quickstart & Validation Guide: Image Capture & Annotation

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

This guide is for running the app and proving that each user story works. Interfaces are
defined in [contracts/](./contracts/) and state in [data-model.md](./data-model.md).

## Prerequisites

- Node.js 22 LTS and npm 10 or later.
- A device with a camera. For full coverage you need an Android phone with Chrome (torch), an
  iPhone with Safari, and a laptop with a webcam.
- Phone and computer on the same Wi-Fi network for LAN testing, or use the hosted URL.

## Setup & run

```bash
npm install
npm run dev            # http://localhost:5173 — camera works (localhost is a secure context)
npm run dev:https      # https://<lan-ip>:5173 — open on phone, accept the self-signed cert warning
```

## Quality gates (must all pass before a task is "done")

```bash
npm run lint
npm run typecheck
npm test               # Vitest unit + component tests
npm run test:e2e       # Playwright (Chromium fake camera; desktop + mobile-touch projects)
npm run build && npm run preview
```

Expected result: zero lint and type errors, and all tests green. The e2e run includes the
`desktop-chrome` and `pixel-7` (touch) projects.

## Validation scenarios

Each scenario maps to a spec user story. Run them on the reference devices (SC-002).

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| V1 | US1 Capture | Open the app → allow camera → Capture → Retake → Capture → Use Photo | The preview appears in under 3 s. A shutter flash shows on capture. Review shows the full frame. The resolution shown equals the device maximum (compare it with the native camera app or `track.getCapabilities()` in devtools). |
| V2 | US1 Switch | On a phone, tap switch camera | The front camera appears, and tapping again returns to the rear camera. |
| V3 | US5 Denied | Block camera in site settings → reload | The "Camera access blocked" view appears with re-enable steps, **Try again** and **Choose a photo**. |
| V4 | US5 No camera | Desktop with no webcam (or the camera disabled in the OS) | The "No camera found" view appears. Choosing a photo leads to Review. |
| V5 | US5 Busy | Open the camera in another app (Windows), then load the app | The "Camera is in use" view appears. Close the other app → Try again → live. |
| V6 | US5 Insecure | Open `http://<lan-ip>:5173` (non-HTTPS) on a phone | The secure-connection explanation appears, with the upload fallback. |
| V7 | US5 Interrupted | Unplug a USB webcam while it is live | The "Camera disconnected" view appears with Reconnect. |
| V8 | US6 Torch | Android Chrome, rear camera: toggle the torch 10 times | The light matches the toggle every time, and the pending state shows briefly. |
| V9 | US6 Unsupported | iPhone Safari or a laptop | The torch is disabled or hidden with the "not supported" explanation (or works, if iOS reports the capability). |
| V10 | US4 Quality good | Capture in good light, holding steady | Verdict **Good**. Resolution and size are visible without scrolling. |
| V11 | US4 Quality poor | Capture in a dark room, and a deliberately shaken shot | Verdict Fair or Poor, with "Too dark" or "Blurry" plus a tip. Retake is emphasized. |
| V12 | US2 Draw/edit | Draw 3 boxes → label them → move one → resize one from a corner and an edge → delete one → Undo | Every operation works on touch and mouse, boxes stay inside the image, and Undo restores the box. |
| V13 | US2 Tiny drag | Tap on an empty area | No box is created. |
| V14 | US3 Alignment | Draw a box tightly around an object → resize the browser from 1440 → 360 px → rotate a tablet | The box still tightly outlines the object at every size. |
| V15 | US7 List | Create 5 boxes → open the list → select, rename and delete from the list → Clear all → confirm | The canvas reflects every action immediately, and the empty state shows afterwards. |
| V16 | Edge: retake | With boxes present, tap Retake | A confirmation dialog appears, and cancelling keeps the annotations. |
| V17 | Responsive | DevTools at 360×740, 768×1024 and 1280×800, in portrait and landscape | No clipping, overlap or horizontal scroll (SC-009). |
| V18 | US8 Export *(enhancement)* | Export data | The JSON validates against [export-format.schema.json](./contracts/export-format.schema.json), with coordinates in full-resolution pixels. |

## Calibration task (sharpness thresholds)

Capture 10 sharp and 10 deliberately blurred photos on each reference device. Record the
Laplacian variance of each from the technical details panel or a console log. If needed, adjust
`QUALITY_THRESHOLDS.sharpness` so that SC-007 holds (at least 9 of 10 correct per class). Then
update the README thresholds table.

## Deployment (bonus)

```bash
npm run build          # outputs dist/
npx vercel --prod      # or connect the repo in the Vercel dashboard; HTTPS is automatic
```

Repeat V1, V8, V10 and V14 against the public URL on a real phone, and add the URL to the README.
