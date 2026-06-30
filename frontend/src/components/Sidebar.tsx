import type { Page } from "../types/nav";
import { useLanguage } from "../context/language";

interface SidebarProps {
  active: Page;
  onNavigate: (page: Page) => void;
  /** When false, the sidebar collapses to zero width (animated). */
  visible: boolean;
  /** Collapse button (only shown on pages that allow hiding). */
  onCollapse?: () => void;
}

interface NavItem {
  id: Page;
  /** Section name — intentionally untranslated (proper noun, see i18n.ts). */
  label: string;
  /** Whether this page is wired to a real view. */
  enabled: boolean;
  icon: React.ReactNode;
}

const ICON = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  heatmap: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  hotspots: (
    <>
      <circle cx="12" cy="12" r="2" />
      <circle cx="5" cy="6" r="1.5" />
      <circle cx="19" cy="6" r="1.5" />
      <circle cx="19" cy="18" r="1.5" />
      <path d="m10.4 10.6-4-3.2M13.6 10.6l4-3.2M13.6 13.4l4 3.2" />
    </>
  ),
  visitor: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", enabled: true, icon: ICON.dashboard },
  { id: "heatmap", label: "Heatmap", enabled: true, icon: ICON.heatmap },
  { id: "hotspots", label: "Hotspots", enabled: true, icon: ICON.hotspots },
  { id: "visitor", label: "Visitor View", enabled: false, icon: ICON.visitor },
  { id: "settings", label: "Settings", enabled: true, icon: ICON.settings },
];

/**
 * Left navigation rail: branding, nav items, collapse control, admin profile.
 *
 * The rail stays mounted and animates its width between 16rem and 0 so the
 * collapse / return glides instead of snapping. The inner content keeps a fixed
 * width and is clipped during the transition so labels don't reflow.
 */
export default function Sidebar({ active, onNavigate, visible, onCollapse }: SidebarProps) {
  const { t } = useLanguage();

  return (
    <aside
      aria-hidden={!visible}
      className={
        "h-full shrink-0 overflow-hidden border-r bg-white transition-[width] duration-300 ease-in-out motion-reduce:transition-none dark:border-gray-800 dark:bg-gray-900 " +
        (visible ? "w-64 border-gray-200" : "w-0 border-transparent")
      }
    >
      <div
        className={
          "flex h-full w-64 flex-col transition-opacity duration-200 ease-in-out motion-reduce:transition-none " +
          (visible ? "opacity-100" : "opacity-0")
        }
      >
        {/* Branding */}
        <div className="px-6 pb-5 pt-6">
          <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
            Borobudur
          </h1>
          <p className="mt-1 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t("sidebar.tagline")}
          </p>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              tabIndex={visible ? 0 : -1}
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
            >
              <span aria-hidden="true">&laquo;</span> {t("sidebar.collapse")}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.enabled && item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.enabled}
                tabIndex={visible ? 0 : -1}
                onClick={() => item.enabled && onNavigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 " +
                  (isActive
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : item.enabled
                      ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                      : "cursor-not-allowed text-gray-300 dark:text-gray-600")
                }
                title={item.enabled ? undefined : t("sidebar.comingSoon")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Admin profile */}
        <div className="border-t border-gray-100 px-4 py-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
              AU
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {t("sidebar.adminName")}
              </p>
              <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                {t("sidebar.adminRole")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
