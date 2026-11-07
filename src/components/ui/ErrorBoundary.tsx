import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-100 space-y-4 max-w-2xl mx-auto my-8">
          <div className="flex items-center gap-3 text-white">
            <AlertCircle className="w-5 h-5 text-neutral-400 shrink-0" />
            <h3 className="text-sm font-semibold tracking-tight">
              {this.props.fallbackTitle || 'Component Rendering Notice'}
            </h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            An unexpected error occurred while displaying this section. Your session and backend data remain intact.
          </p>
          {this.state.error?.message && (
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 break-words">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry Section
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
