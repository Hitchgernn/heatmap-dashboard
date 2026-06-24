interface LoadingStateProps {
  /** "loading" = first load (prominent), "refreshing" = subtle background poll. */
  mode: "loading" | "refreshing";
}

/** Lightweight loading/refreshing indicator for the dark ops shell. */
export default function LoadingState({ mode }: LoadingStateProps) {
  if (mode === "loading") {
    return (
      <div className="flex items-center gap-2.5 text-sm text-slate-400">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
      Refreshing
    </span>
  );
}
