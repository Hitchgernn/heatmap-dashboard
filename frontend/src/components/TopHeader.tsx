import { useLanguage } from "../context/language";

interface TopHeaderProps {
  /** Page title shown on the left (section name — untranslated). */
  title: string;
  /** Live/refreshing/error status pill. */
  status: "live" | "refreshing" | "error";
  /** Whether to show the search input (map pages only — not the Dashboard). */
  showSearch?: boolean;
}

function StatusPill({ status }: { status: TopHeaderProps["status"] }) {
  const { t } = useLanguage();
  const config = {
    live: { dot: "bg-emerald-500", text: t("status.live"), tone: "text-emerald-600 dark:text-emerald-400" },
    refreshing: { dot: "bg-gray-400 animate-pulse", text: t("status.refreshing"), tone: "text-gray-500 dark:text-gray-400" },
    error: { dot: "bg-red-500", text: t("status.disconnected"), tone: "text-red-600 dark:text-red-400" },
  }[status];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-xs font-medium dark:border-gray-700 dark:bg-gray-800">
      <span className={"h-2 w-2 rounded-full " + config.dot} />
      <span className={config.tone}>{config.text}</span>
    </span>
  );
}

/**
 * Top bar: page title, search input (placeholder only — no backend search),
 * status pill, and decorative action icons.
 */
export default function TopHeader({ title, status, showSearch = false }: TopHeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="font-display text-xl text-gray-900 dark:text-white">{title}</h2>

      {showSearch ? (
        <div className="relative mx-auto w-full max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            placeholder={t("header.searchPlaceholder")}
            aria-label={t("header.searchPlaceholder")}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-gray-600 dark:focus:bg-gray-800 dark:focus:ring-gray-700"
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-3">
        <StatusPill status={status} />
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
      </div>
    </header>
  );
}
