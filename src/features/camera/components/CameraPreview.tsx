import { cn } from '@/shared/ui/cn';

export interface CameraPreviewProps {
  videoRef: (el: HTMLVideoElement | null) => void;
  mirrored: boolean;
  className?: string;
}

/**
 * Live preview. Uses `object-fit: cover` to fill the screen; the review step shows the full,
 * uncropped captured frame (research R13).
 */
export function CameraPreview({ videoRef, mirrored, className }: CameraPreviewProps) {
  return (
    <video
      ref={videoRef}
      data-testid="camera-preview"
      aria-label="Live camera preview"
      autoPlay
      muted
      playsInline
      className={cn('h-full w-full bg-black object-cover', mirrored && '-scale-x-100', className)}
    />
  );
}
