"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="p-4 rounded-2xl bg-red-500/10 mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">Something went wrong</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-xs">
            An unexpected error occurred. Please refresh the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="orbyt-button-accent"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
