import { useLanguage } from "../context/language";
import { useTheme } from "../context/theme";
import type { Theme } from "../context/theme";
import type { Lang } from "../lib/i18n";
import type { TranslationKey } from "../lib/i18n";

/** A single selectable option card (radio-style) in a settings group. */
interface OptionCardProps {
  title: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
}

function OptionCard({ title, selected, onSelect, icon }: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 " +
        (selected
          ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800"
          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800")
      }
    >
      <span
        className={
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " +
          (selected
            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{title}</span>
      <span
        className={
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
          (selected ? "border-gray-900 dark:border-white" : "border-gray-300 dark:border-gray-600")
        }
        aria-hidden="true"
      >
        {selected && <span className="h-2 w-2 rounded-full bg-gray-900 dark:bg-white" />}
      </span>
    </button>
  );
}

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h3 className="font-display text-lg text-gray-900 dark:text-white">{title}</h3>
      <div role="radiogroup" aria-label={title} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

const SUN = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const MOON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
  </svg>
);
const MONITOR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);
const GLOBE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const THEME_OPTIONS: { value: Theme; titleKey: TranslationKey; icon: React.ReactNode }[] = [
  { value: "light", titleKey: "settings.themeLight", icon: SUN },
  { value: "dark", titleKey: "settings.themeDark", icon: MOON },
  { value: "system", titleKey: "settings.themeSystem", icon: MONITOR },
];

const LANG_OPTIONS: { value: Lang; titleKey: TranslationKey; icon: React.ReactNode }[] = [
  { value: "en", titleKey: "settings.langEnglish", icon: GLOBE },
  { value: "id", titleKey: "settings.langIndonesia", icon: GLOBE },
];

/**
 * Settings panel: Appearance (Light / Dark / System) and Language (English /
 * Indonesia). Both persist via their context providers (localStorage). This is
 * a presentational, client-only panel — no backend calls. Rendered inside the
 * settings Modal, so it owns its header + close button.
 */
export default function SettingsView({ onClose }: { onClose?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
        <h2 className="font-display text-xl text-gray-900 dark:text-white">Settings</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </header>

      <div className="space-y-5 p-6">
        <SettingsGroup title={t("settings.appearanceTitle")}>
          {THEME_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              title={t(opt.titleKey)}
              selected={theme === opt.value}
              onSelect={() => setTheme(opt.value)}
              icon={opt.icon}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup title={t("settings.languageTitle")}>
          {LANG_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              title={t(opt.titleKey)}
              selected={lang === opt.value}
              onSelect={() => setLang(opt.value)}
              icon={opt.icon}
            />
          ))}
        </SettingsGroup>
      </div>
    </div>
  );
}
