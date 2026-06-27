interface TopHeaderProps {
  /** Page title shown on the left. */
  title: string;
  /** Live/refreshing/error status pill. */
  status: "live" | "refreshing" | "error";
}

function StatusPill({ status }: { status: TopHeaderProps["status"] }) {
  const config = {
    live: { dot: "bg-emerald-500", text: "Live", tone: "text-emerald-600" },
    refreshing: { dot: "bg-gray-400 animate-pulse", text: "Refreshing", tone: "text-gray-500" },
    error: { dot: "bg-red-500", text: "Disconnected", tone: "text-red-600" },
  }[status];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-xs font-medium">
      <span className={"h-2 w-2 rounded-full " + config.dot} />
      <span className={config.tone}>{config.text}</span>
    </span>
  );
}

/**
 * Top bar: page title, search input (placeholder only — no backend search),
 * status pill, and decorative action icons.
 */
export default function TopHeader({ title, status }: TopHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6">
      <h2 className="font-display text-xl text-gray-900">{title}</h2>

      <div className="relative mx-auto w-full max-w-md">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search area, hotspot, or zone..."
          aria-label="Search"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <div className="flex items-center gap-3">
        <StatusPill status={status} />
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
      </div>
    </header>
  );
}
