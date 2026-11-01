import { useEffect, useRef } from 'react';
import { ChoosePhotoButton } from '@/features/upload/components/ChoosePhotoButton';
import { Button } from '@/shared/ui/Button';
import { Lock, RefreshCw, TriangleAlert, VideoOff } from '@/shared/ui/icons';
import { CAMERA_ERROR_COPY, permissionHelp, type CameraAction, type CameraError } from '../lib/cameraErrors';

export interface CameraErrorStateProps {
  error: CameraError;
  onRetry(): void;
}

const ACTION_LABEL: Record<Exclude<CameraAction, 'upload'>, string> = {
  retry: 'Try again',
  allow: 'Allow camera',
  reconnect: 'Reconnect',
};

export function CameraErrorState({ error, onRetry }: CameraErrorStateProps) {
  const copy = CAMERA_ERROR_COPY[error.kind];
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the explanation so keyboard and screen-reader users land on it.
  useEffect(() => heading.current?.focus(), [error.kind]);

  const Icon =
    error.kind === 'permission-denied' || error.kind === 'insecure-context'
      ? Lock
      : error.kind === 'no-camera'
        ? VideoOff
        : TriangleAlert;

  const renderAction = (action: CameraAction, primary: boolean) =>
    action === 'upload' ? (
      <ChoosePhotoButton
        key="upload"
        variant={primary ? 'primary' : 'secondary'}
        className="w-full sm:w-auto"
      />
    ) : (
      <Button
        key={action}
        variant={primary ? 'primary' : 'secondary'}
        className="w-full sm:w-auto"
        onClick={onRetry}
      >
        <RefreshCw size={16} aria-hidden /> {ACTION_LABEL[action]}
      </Button>
    );

  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto bg-surface p-6 text-center"
    >
      <Icon size={44} className="text-fair" aria-hidden />
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
        {copy.title}
      </h2>
      <p className="max-w-md text-sm text-muted">{copy.body}</p>
      {error.kind === 'permission-denied' && (
        <p className="max-w-md rounded-lg bg-surface-raised px-4 py-3 text-sm text-slate-200">
          {permissionHelp(navigator.userAgent)}
        </p>
      )}
      <div className="mt-2 flex w-full max-w-sm flex-col gap-2 sm:w-auto sm:flex-row">
        {renderAction(copy.primary, true)}
        {copy.secondary && renderAction(copy.secondary, false)}
      </div>
      {error.kind === 'unknown' && error.cause !== undefined && (
        <details className="w-full max-w-md text-left text-xs text-muted">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{describeCause(error.cause)}</pre>
        </details>
      )}
    </div>
  );
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error || cause instanceof DOMException) return `${cause.name}: ${cause.message}`;
  return String(cause);
}
