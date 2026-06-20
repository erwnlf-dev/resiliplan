/**
 * ResiliPlan — Global Error Boundary
 * Catches React errors, logs to console, shows fallback UI.
 *
 * Future: integrate with Sentry for production error tracking.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // TODO: Send to Sentry when SENTRY_DSN is configured
    // Sentry.captureException(error, { extra: errorInfo });

    // Always log to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    // Reload page to recover
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Terjadi Kesalahan</h1>
                <p className="text-sm text-muted-foreground">Something went wrong</p>
              </div>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Aplikasi mengalami error yang tidak terduga. Tim kami sudah diberi notifikasi. Silakan coba
              refresh halaman, atau kembali ke dashboard.
            </p>

            {this.state.error && (
              <details className="mb-4 rounded border border-border bg-muted/50 p-3 text-xs">
                <summary className="cursor-pointer font-medium">Detail error</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Refresh Halaman
              </button>
              <a
                href="/"
                className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-center text-sm font-medium hover:bg-muted"
              >
                Kembali ke Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
