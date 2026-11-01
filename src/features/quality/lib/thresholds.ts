// Single source of truth for every quality threshold (spec FR-020, research R8).
// Bytes use decimal units (1 MB = 1,000,000 B) to match how file sizes are displayed.

export const QUALITY_THRESHOLDS = {
  /** Megapixels: good ≥ 5, fair ≥ 2, else poor. */
  resolutionMP: { good: 5, fair: 2 },
  /** good 500 KB–15 MB; fair 150–500 KB or > 15 MB; poor < 150 KB. */
  fileSizeBytes: { goodMin: 500_000, goodMax: 15_000_000, fairMin: 150_000 },
  /** Mean luma %: good 25–80; fair 15–25 or 80–90; poor < 15 or > 90. */
  brightnessPct: { goodMin: 25, goodMax: 80, fairMin: 15, fairMax: 90 },
  /**
   * Laplacian variance at 512px long side: good ≥ 100, fair ≥ 40, else poor.
   * Provisional starting values from the literature; calibrated on devices per quickstart (T093).
   */
  sharpness: { good: 100, fair: 40 },
} as const;

export type QualityThresholds = typeof QUALITY_THRESHOLDS;

/** Long side of the downscaled copy used for brightness/sharpness analysis. */
export const ANALYSIS_LONG_SIDE = 512;
