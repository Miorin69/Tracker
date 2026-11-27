import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

function formatFriendlyErrorMessage(rawMessage: string): string {
  return rawMessage?.trim() || 'An unexpected display error occurred.';
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: formatFriendlyErrorMessage(error?.message || ''),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application error caught by ErrorBoundary:', error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleResetAndReload = () => {
    try {
      window.localStorage.removeItem('wtm_active_plan_v1');
      window.sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0716] text-[#f6f2ff] flex items-center justify-center p-6">
          <div
            role="alert"
            className="max-w-md w-full bg-[#150f29] border border-[#35285b] rounded-lg p-6 shadow-2xl space-y-4"
          >
            <div className="space-y-1">
              <h1 className="font-display text-xl font-bold uppercase tracking-wider text-[#faf7ff]">
                Something went wrong
              </h1>
              <p className="text-xs text-[#c5b8e3] leading-relaxed">
                {this.state.errorMessage}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-3.5 h-9 text-xs font-bold rounded-md vice-sunset-btn transition-all cursor-pointer"
              >
                Recover View
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="px-3.5 h-9 text-xs font-medium text-[#e6ddf8] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] transition-colors cursor-pointer"
              >
                Reset Local Plan &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
