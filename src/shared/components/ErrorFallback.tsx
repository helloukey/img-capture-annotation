import { Button } from '@/shared/ui/Button';
import { TriangleAlert } from '@/shared/ui/icons';

export interface ErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <TriangleAlert size={40} className="text-fair" aria-hidden />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted">This step hit an unexpected error. Your camera has been released.</p>
      <details className="w-full rounded-lg bg-surface-raised p-3 text-left text-xs text-muted">
        <summary className="cursor-pointer">Technical details</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
      </details>
      <Button variant="primary" onClick={onReset}>
        Start over
      </Button>
    </div>
  );
}
