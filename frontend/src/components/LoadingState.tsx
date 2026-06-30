import { useLanguage } from "../context/language";

interface LoadingStateProps {
  /** "loading" = first load (prominent), "refreshing" = subtle background poll. */
  mode: "loading" | "refreshing";
}

/** Lightweight loading/refreshing indicator for the dashboard shell. */
export default function LoadingState({ mode }: LoadingStateProps) {
  const { t } = useLanguage();

  if (mode === "loading") {
    return (
      <div className="flex items-center gap-2.5 text-sm text-gray-500 dark:text-gray-400">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gray-900 dark:bg-white" />
        {t("loading.loading")}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-gray-500 dark:text-gray-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-900 dark:bg-white" />
      {t("status.refreshing")}
    </span>
  );
}
