/**
 * Admin login page — shown when there's no active session.
 *
 * Matches the dashboard's existing design system: DM Sans typography,
 * gray palette, dark mode via Tailwind class strategy, subtle entrance
 * animations. The Borobudur branding anchors the left context panel while
 * the form occupies the right on desktop (stacked on mobile).
 */

import { useState, type FormEvent } from "react";
import { useAuth } from "../context/auth";

export default function LoginPage() {
  const { signin, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError ?? authError;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      await signin(email.trim(), password);
    } catch {
      // Error is surfaced through authError from context.
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200">
      {/* Left branding panel — hidden on mobile */}
      <div 
        className="login-brand-enter relative hidden w-[45%] overflow-hidden bg-gray-900 bg-cover bg-center lg:flex lg:flex-col lg:justify-between"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Monitoring System
          </div>
          <h1 className="font-display text-5xl leading-tight text-white xl:text-6xl">
            Borobudur
          </h1>
          <p className="mt-1 font-display text-2xl italic text-white/80 xl:text-3xl">
            Heatmap Dashboard
          </p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/90">
            Real-time visitor density monitoring and spatial analytics for
            the Borobudur Temple Compounds.
          </p>
        </div>

        <div className="relative z-10 px-12 pb-8 xl:px-16">
          <div className="text-xs text-white/70">
            Precision Monitoring · Aggregated Analytics
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-form-enter flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile branding (hidden on desktop) */}
          <div className="mb-10 lg:hidden">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-900 dark:text-gray-100/80">
              Monitoring System
            </div>
            <h1 className="font-display text-3xl text-gray-900 dark:text-white">
              Borobudur
            </h1>
            <p className="font-display text-lg italic text-gray-500 dark:text-gray-400">
              Heatmap Dashboard
            </p>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Sign in
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter your admin credentials to access the dashboard.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-gray-100 dark:focus:ring-gray-100/20"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-3.5 pr-10 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-gray-100 dark:focus:ring-gray-100/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 active:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 dark:active:bg-gray-200"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
