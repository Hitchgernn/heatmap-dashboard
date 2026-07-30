import { useLanguage } from "../context/language";
import StupaMark from "./StupaMark";

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
        <StupaMark size={16} className="shrink-0" />
        {t("loading.loading")}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-gray-500 dark:text-gray-400">
      <StupaMark size={14} className="shrink-0" />
      {t("status.refreshing")}
    </span>
  );
}
