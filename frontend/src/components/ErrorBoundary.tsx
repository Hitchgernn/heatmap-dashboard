import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/runtime errors in the subtree and shows a recoverable message
 * instead of a blank white screen (React unmounts the whole tree on an uncaught
 * error otherwise). Resets on "Try again"; a full reload is the fallback.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it in the console for debugging (dev + prod).
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div>
            <h2 className="font-display text-2xl text-gray-900 dark:text-white">Something broke</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
              A component hit an error and stopped rendering. Your session is fine — try again, or
              reload the page.
            </p>
            <p className="mt-2 font-mono text-xs text-red-600 dark:text-red-400">
              {this.state.error.message}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
