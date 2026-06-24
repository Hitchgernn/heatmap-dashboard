interface LoadingStateProps {
  /** "loading" = first load (prominent), "refreshing" = subtle background poll. */
  mode: "loading" | "refreshing";
}

/** Lightweight loading/refreshing indicator. */
export default function LoadingState({ mode }: LoadingStateProps) {
  if (mode === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="h-3 w-3 animate-pulse rounded-full bg-slate-400" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
      Refreshing…
    </span>
  );
}
