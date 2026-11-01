export type QualityRating = 'good' | 'fair' | 'poor';
export type QualityCheckId = 'resolution' | 'fileSize' | 'brightness' | 'sharpness';

export interface ImageMetrics {
  width: number;
  height: number;
  byteSize: number;
  /** Mean Rec. 709 luma, 0–100. Null if pixel analysis failed. */
  brightnessPct: number | null;
  /** Variance of the Laplacian on a 512px-long-side grayscale copy. Null if analysis failed. */
  sharpness: number | null;
}

export interface QualityCheck {
  id: QualityCheckId;
  label: string;
  rating: QualityRating;
  value: number | null;
  display: string;
  message?: string;
  tip?: string;
}

export interface QualityAssessment {
  checks: QualityCheck[];
  verdict: QualityRating;
  status: 'pending' | 'ready' | 'error';
}
