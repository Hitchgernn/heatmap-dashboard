interface ShowSidebarButtonProps {
  onClick: () => void;
}

/** Floating button shown on full-map pages when the sidebar is hidden. */
export default function ShowSidebarButton({ onClick }: ShowSidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Show sidebar"
      className="absolute left-3 top-3 z-[700] inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 shadow-md transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <span aria-hidden="true">&raquo;</span>
    </button>
  );
}
