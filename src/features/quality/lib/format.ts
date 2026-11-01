/** Decimal units, matching the thresholds (1 MB = 1,000,000 B). */
export function formatBytes(n: number): string {
  if (n < 1000) return `${n} B`;
  if (n < 1_000_000) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1_000_000).toFixed(1)} MB`;
}

export function formatMegapixels(width: number, height: number): string {
  return `${((width * height) / 1_000_000).toFixed(1)} MP`;
}

export function formatResolution(width: number, height: number): string {
  return `${formatMegapixels(width, height)} (${width} × ${height})`;
}

export const RATING_TEXT = { good: 'Good', fair: 'Fair', poor: 'Poor' } as const;
