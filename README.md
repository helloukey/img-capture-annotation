# Snap & Annotate

A React app that captures photos at the highest resolution your device's camera offers, scores their quality, and lets you annotate them with labeled bounding boxes on desktop, tablet, and phone. It handles touch as well as mouse and pen.

**Live demo:** https://img-capture-annotation.netlify.app/
**Demo video:** _TODO: add a link once recorded._

## Features

| Area | What you get |
|---|---|
| **Camera** | Live preview from the rear camera by default, with camera switching. The app negotiates the highest available resolution, then captures at the maximum *photo* resolution using `ImageCapture.takePhoto()`, with a full-resolution canvas fallback. You can capture, review, and retake. |
| **Torch** | The flashlight toggle appears only when the camera reports support. Its on/off state is read back from the hardware, so it never shows "on" while the light is off. |
| **Error handling** | Each failure has its own screen and recovery action: permission denied, prompt dismissed, no camera, camera busy, insecure page, unsupported browser, and stream interrupted. A **Choose a photo** fallback is always available. |
| **Quality indicator** | Shows resolution, file size, brightness, and sharpness, with a Good / Fair / Poor verdict and a specific tip for each failed check. It's prominent on Review and appears as a compact badge on Annotate. |
| **Annotation** | Draw boxes with mouse, touch, or pen. You can select, move, resize from 8 handles, label (up to 50 characters), and delete them, with a 5-second undo. Boxes are stored in image pixels, so they stay aligned at any screen size. |
| **Annotation list** | Selection stays in sync with the canvas, and you can rename, delete, or Clear all (with confirmation). It's a side panel on tablet and desktop and a bottom sheet on phones. |
| **Export** *(enhancement)* | Download JSON with full-resolution pixel coordinates, or a JPEG with the boxes drawn on it. |
| **Privacy** | Everything runs in the browser. Photos never leave the device, and an e2e test asserts no requests go to other origins. |

## Quick start

Requirements: **Node.js 22+** and npm 10+.

```bash
npm install          # .npmrc sets legacy-peer-deps (works around an npm arborist peer-resolution bug)
npm run dev          # http://localhost:5173. The camera works because localhost is a secure context.
```

### Testing on a phone

Browsers only allow camera access on HTTPS pages (or localhost):

```bash
npm run dev:https    # https://<your-LAN-IP>:5173 with a self-signed certificate
```

Open the URL on a phone connected to the same Wi-Fi network and accept the certificate warning. As an alternative, you can tunnel the plain dev server (`npx cloudflared tunnel --url http://localhost:5173`) or use the deployed URL.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `dev:https` | Dev server (HTTP on localhost, or HTTPS on the LAN) |
| `npm run build` / `preview` | Type-check, build the production bundle, and serve it |
| `npm run lint` | ESLint (typescript-eslint strict, react-hooks, jsx-a11y) |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm test` | Vitest unit and component tests (167 tests) |
| `npm run test:e2e` | Playwright on a real Chromium fake camera, with desktop and Pixel 7 (touch) projects |

The first time you run the e2e tests, install the browser with `npx playwright install chromium`. To run the suite against a deployed site instead of the local dev server, set `E2E_BASE_URL`, for example `E2E_BASE_URL=https://img-capture-annotation.netlify.app npm run test:e2e`.

## Architecture

The code is organized by feature. Each feature separates React code (`components/`, `hooks/`) from pure, React-free logic (`lib/`), and ESLint enforces that boundary.

```text
src/
├── app/                 App shell, Capture → Review → Annotate state machine, step indicator
├── features/
│   ├── camera/          useCamera / useTorch hooks (the only code that calls media APIs), capture, error taxonomy
│   ├── review/          Review screen
│   ├── upload/          "Choose a photo" fallback
│   ├── quality/         Pixel metrics, thresholds, assessment, indicator UI
│   └── annotation/      Geometry, reducer, SVG canvas, gestures, list, export
└── shared/              Types, hooks, error boundary, UI wrappers (Radix, Sonner, lucide)
tests/fakes/             Fake MediaStreamTrack / mediaDevices / ImageCapture for jsdom
tests/e2e/               Playwright specs
```

- **State.** There are two pure reducers. `appFlowReducer` handles the step and image, and guards destructive transitions such as retaking while annotations exist. `annotationReducer` holds the boxes, selection, and the undo snapshot. `AnnotationProvider` sits *above* the Review and Annotate views, so your annotations are still there after you go back to Review.
- **Error boundaries.** Each view has its own error boundary, so an unexpected error shows a "Start over" screen instead of a blank page.
- **Third-party UI.** Libraries are reachable only through `src/shared/ui/`. ESLint's `no-restricted-imports` blocks direct imports of `sonner` and `lucide-react` anywhere else.

The detailed design lives in [`specs/001-image-capture-annotation/`](specs/001-image-capture-annotation/): the spec, plan, research decisions, data model, and contracts.

## Key decisions and libraries

| Decision | Choice | Why |
|---|---|---|
| Framework | React 19, TypeScript (strict), Vite | Required stack. Fast builds and a static output that deploys anywhere. |
| Camera | Browser APIs directly, no wrapper library | Wrappers such as react-webcam hide the `MediaStreamTrack`, which torch control and `ImageCapture` need, and default to preview-sized captures. |
| Annotation | Custom SVG overlay, no annotation library | `viewBox` = intrinsic image size, so alignment is correct by construction. Konva or Fabric would need manual rescaling on resize, which is exactly the class of bug under evaluation. SVG nodes are also DOM-accessible. |
| UI primitives | Radix UI (Dialog, Toggle, Popover, Tooltip) | Accessible focus management, ARIA, and keyboard support out of the box. |
| Styling | Tailwind CSS v4 | Fast, mobile-first responsive work. Container-query units size the canvas. |
| Toasts / icons | Sonner / lucide-react | Sonner provides the undo toast. Both sit behind wrappers. |
| Animation | CSS only | Only a shutter flash, sheet slide, and fades are needed. All respect `prefers-reduced-motion`. |
| Tests | Vitest, Testing Library, fast-check, Playwright, axe | Property tests for geometry, a real fake-camera pipeline in e2e, and automated accessibility checks. |

[`docs/TECHNICAL_NOTES.md`](docs/TECHNICAL_NOTES.md) explains the capture strategy, quality assessment, and annotation approach in detail.

## Quality thresholds

All thresholds are defined in one place: [`src/features/quality/lib/thresholds.ts`](src/features/quality/lib/thresholds.ts). The overall verdict is the **worst** individual rating.

| Check | Good | Fair | Poor | Rationale |
|---|---|---|---|---|
| Resolution | ≥ 5 MP | 2–5 MP | < 2 MP | 5 MP preserves fine detail such as text and small parts at typical framing. Below 2 MP (under 1080p) detail is visibly lost. |
| File size | 500 KB–15 MB | 150–500 KB, or > 15 MB | < 150 KB | At these resolutions, a very small JPEG almost always means a dark, flat, or covered frame. Over 15 MB is fine, but slow to share. |
| Brightness (mean Rec. 709 luma) | 25–80% | 15–25%, 80–90% | < 15%, > 90% | Catches under- and overexposure. The tip mentions the torch only when it's supported. |
| Sharpness (variance of Laplacian at 512 px) | ≥ 300 | 100–300 | < 100 | A standard blur measure, calibrated on a real 12.5 MP phone photo (see below). |

**Sharpness calibration:** The provisional textbook values (100 / 40) proved far too lenient: real photos scored 570–3,700, so the blur warning would never fire. Two changes fixed this:

1. **High-quality downscaling.** The 512 px analysis copy is now made with `imageSmoothingQuality: 'high'`. The browser's default "low" quality skips pixels when shrinking about 8×, and the resulting aliasing inflated sharp-photo scores about 4× (2351 vs 588 on the same image).
2. **Thresholds from measured blur.** A real 12.5 MP Android photo and Gaussian-blurred copies of it were scored with the app's exact pipeline:

| Variant | Score | Rating |
|---|---|---|
| Original | 588 | Good |
| Focus blur σ = 2 px (barely visible) | 399 | Good |
| Focus blur σ = 4 px (noticeably soft) | 196 | Fair |
| Focus blur σ = 6 px | 117 | Fair |
| Focus blur σ = 8 px (clearly blurry) | 55 | Poor |

Reproduce it with `node scripts/calibrate-sharpness.mjs <photo.jpg>`. The scores depend on scene content (plain, low-texture scenes score lower), so this is one calibration scene and should be confirmed with real handheld blurry shots.

## Browser and device support

| Platform | Capture path | Torch | Notes |
|---|---|---|---|
| Chrome / Edge (Android) | `ImageCapture.takePhoto()` at max photo resolution | ✅ on rear cameras with a flash | Best experience |
| Chrome / Edge (desktop) | `takePhoto()`, or canvas if it yields fewer pixels than the stream | ❌ (shown as unavailable) | |
| Safari (iOS / macOS) | Canvas at full stream resolution (no `ImageCapture`) | Used if Safari reports the capability, otherwise shown as unavailable | The video stream (often 4K) is the resolution ceiling |
| Firefox | Canvas at full stream resolution | ❌ | Best effort |

**Tested devices:**

| Device / browser | Result |
|---|---|
| Android phone, Chrome (live site) | ✅ Live preview, capture, review, annotation and export all work. A 12.5 MP (3072 × 4080) photo was captured, above the 4K video ceiling, so the full photo pipeline was used. Torch toggle confirmed working on real hardware. All quality checks rated Good outdoors (sharpness 2766, brightness 37%). |
| iPhone, Safari | _TODO_ |
| Laptop webcam | _TODO_ |

Automated coverage also comes from Playwright's Chromium fake camera, at desktop size and in Pixel 7 touch emulation, run both locally and against the live site.

## Known limitations and trade-offs

- **One photo per session, kept in memory.** A page reload discards the photo and its annotations. Persistence was out of scope for the one-week timeline.
- **Rectangles only.** No rotated boxes, polygons, or zoom/pan beyond the browser's own pinch-zoom.
- **The preview crops; the capture doesn't.** The live preview fills the screen (`object-fit: cover`), so its edges are cropped. The Review screen always shows the full captured frame.
- **iOS resolution ceiling.** Safari has no `ImageCapture` API, so photos are capped at the stream resolution rather than the sensor's full photo resolution.
- **Sharpness and file-size heuristics can be fooled.** A plain wall is "featureless" and can rate as soft or small. The messages explain this rather than claim a definite fault.
- **Very large photos.** Analysis runs on a 512 px copy, so it stays fast. The burned-in export is scaled to about 16.7 MP on browsers with canvas size limits (iOS).
- **Keyboard users can't resize boxes.** Boxes can be selected, labeled, and deleted from the keyboard, but resizing is pointer-only.
- **Short landscape screens.** Below 480 px of height (a phone in landscape), the app header with its step indicator is hidden to give the canvas room. The toolbar still makes the current step clear.

## Deployment

The app builds to static files and deploys for free on **Netlify** or **Cloudflare Pages**. Both provide the HTTPS that camera access requires. The repo is pre-configured:

- `.nvmrc` pins Node 22 (read by both platforms).
- `netlify.toml` holds the Netlify build settings.
- `public/_headers` sets security headers on both platforms, including `Permissions-Policy: camera=(self)`.

**Netlify:** Add new site → Import an existing project → GitHub → `img-capture-annotation`. The settings are read from `netlify.toml`, so just click Deploy.

**Cloudflare Pages:** Workers & Pages → Create → Pages → Connect to Git → `img-capture-annotation`. Choose the **Vite** framework preset (build command `npm run build`, output directory `dist`), then Save and Deploy.

Either way, every push to `main` redeploys automatically.

## Spec-driven development

This project was built with [Spec Kit](https://github.com/github/spec-kit). Every decision traces back to the documents in `specs/001-image-capture-annotation/`. `tasks.md` tracks implementation status, and the remaining manual items are device calibration, device validation, deployment, and the demo video.
