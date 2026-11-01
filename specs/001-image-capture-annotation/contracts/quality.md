# Contract: Quality Assessment

**Module**: `src/features/quality/` · **Implements**: FR-014–FR-020 · **Research**: R8

## Pure API (`lib/`, no React and no DOM except in `measureImage`)

```ts
type QualityRating = "good" | "fair" | "poor";
type QualityCheckId = "resolution" | "fileSize" | "brightness" | "sharpness";

interface ImageMetrics {
  width: number; height: number; byteSize: number;
  brightnessPct: number | null;   // null if pixel analysis failed
  sharpness: number | null;       // Laplacian variance on 512px-long-side grayscale
}

// thresholds.ts — single source of truth (Constitution: Technical Constraints)
export const QUALITY_THRESHOLDS: QualityThresholds;

// metrics.ts — pure, operate on raw RGBA buffers (unit-tested with synthetic data)
meanLuma(rgba: Uint8ClampedArray): number;                       // 0–100
laplacianVariance(gray: Float32Array, w: number, h: number): number;
toGrayscale(rgba: Uint8ClampedArray): Float32Array;

// measure.ts — DOM-dependent: decode → downscale canvas → metrics
measureImage(image: CapturedImage): Promise<ImageMetrics>;

// assess.ts — pure
assessQuality(metrics: ImageMetrics, t?: QualityThresholds,
  ctx?: { torchSupported?: boolean }): QualityAssessment;
worstRating(ratings: QualityRating[]): QualityRating;
formatBytes(n: number): string;         // "3.4 MB", "820 KB"
formatResolution(w: number, h: number): string; // "12.2 MP (4032 × 3024)"
```

**Rules**

- Boundaries are inclusive at the "good" edge. For example, exactly 5.0 MP is `good` and exactly
  2.0 MP is `fair`. Unit tests cover each boundary on both sides.
- A `null` brightness or sharpness value produces a check with rating `fair`, message
  "Couldn't analyze …", and no tip. This prevents a false "Poor" rating.
- The tip text for brightness mentions the torch only when `ctx.torchSupported` is true.
- The verdict is `worstRating` over the 4 checks.

## Hook

```ts
useQualityAssessment(image: CapturedImage | null): QualityAssessment | null; // status pending→ready
```

The hook memoizes per `image.id` and does not repeat the analysis when moving between Review
and Annotate.

## UI

- **`<QualityIndicator variant="full">`** (Review): a verdict badge (color, icon and text, so it
  never relies on color alone), a resolution and size line, and one row per check that shows its
  value and, when not good, the message and tip. Container `role="status"` and
  `aria-live="polite"`.
- **`<QualityIndicator variant="compact">`** (Annotate toolbar): a badge plus the MP and size.
  Tapping it opens the full variant in a popover or sheet.
