import { useCallback, type ReactNode } from 'react';
import { AnnotationProvider } from '@/features/annotation/state/AnnotationProvider';
import { CameraView } from '@/features/camera/components/CameraView';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Toaster } from '@/shared/ui/Toaster';
import { TooltipProvider } from '@/shared/ui/Tooltip';
import { AppFlowProvider, useAppFlow } from './AppFlowContext';
import { AnnotateScreen, ReviewScreen } from './screens';
import { StepIndicator } from './StepIndicator';

function Steps() {
  const { state, dispatch } = useAppFlow();
  const reset = () => dispatch({ type: 'RESET' });
  const onCountChange = useCallback(
    (count: number) => dispatch({ type: 'SET_ANNOTATION_COUNT', count }),
    [dispatch],
  );

  let view: ReactNode;
  switch (state.step) {
    case 'camera':
      view = <CameraView />;
      break;
    case 'review':
      view = state.image ? <ReviewScreen image={state.image} /> : null;
      break;
    case 'annotate':
      view = state.image ? <AnnotateScreen image={state.image} /> : null;
      break;
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="safe-top safe-x flex shrink-0 [@media(max-height:480px)]:hidden items-center justify-between gap-3 border-b border-border bg-surface/90 pb-2 backdrop-blur">
        <h1 className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight sm:text-base">
          <img src="/favicon.svg" alt="" className="h-6 w-6" aria-hidden />
          <span className="sr-only sm:not-sr-only">
            Snap <span className="text-accent">&amp;</span> Annotate
          </span>
        </h1>
        <StepIndicator current={state.step} />
      </header>
      <main className="relative min-h-0 flex-1">
        {state.image && state.step !== 'camera' ? (
          // Above both views so annotations survive Annotate → Review → Annotate (data-model §4).
          <AnnotationProvider key={state.image.id} imageId={state.image.id} onCountChange={onCountChange}>
            <ErrorBoundary key={state.step} onReset={reset}>
              {view}
            </ErrorBoundary>
          </AnnotationProvider>
        ) : (
          <ErrorBoundary key={state.step} onReset={reset}>
            {view}
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppFlowProvider>
      <TooltipProvider>
        <Steps />
        <Toaster />
      </TooltipProvider>
    </AppFlowProvider>
  );
}
