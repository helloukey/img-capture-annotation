import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
}

/** Wraps each top-level view so an unexpected error never leaves a blank screen (FR-013). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('View crashed:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  override render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    return this.props.children;
  }
}
