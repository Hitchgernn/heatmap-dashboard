/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Globals set by the pre-React boot script in index.html (see lib/splash.ts). */
interface Window {
  /** Timestamp of the first painted frame — the minimum-display floor counts from here. */
  __bootAt?: number;
  /** Splash copy, picked from localStorage before the i18n context exists. */
  __bootStrings?: { loading: string; stalled: string };
  /** Timer that swaps the status line to "still connecting" after 8s. */
  __bootStallTimer?: number;
}
