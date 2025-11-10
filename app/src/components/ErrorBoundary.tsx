'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // Add your error reporting logic here
      console.error('Production error:', error);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-green-900 px-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-lg w-full">
            <div className="text-center mb-6">
              <svg
                className="mx-auto h-16 w-16 text-red-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-2xl font-bold text-white mb-2">Oops! Something went wrong</h2>
              <p className="text-gray-300 mb-6">
                We apologize for the inconvenience. The error has been logged and we'll fix it soon.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-500/20 rounded-lg p-4 mb-6">
                <p className="text-sm font-mono text-red-200 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-red-200/80">
                    <summary className="cursor-pointer mb-2">Stack trace</summary>
                    <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-gradient-to-r from-solana-purple to-solana-green text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex-1 bg-white/20 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/30 transition"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
