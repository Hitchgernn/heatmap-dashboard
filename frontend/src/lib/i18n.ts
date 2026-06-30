/**
 * Tiny in-app i18n dictionary. Two locales: English (`en`) and Indonesian
 * (`id`). Product/section names (Borobudur, Dashboard, Heatmap, Hotspots,
 * Visitor View, Settings) are intentionally NOT translated — they read as proper
 * nouns and sound off when localized, so they stay English in both locales and
 * live as literals in the components, not here.
 *
 * `en` is the source of truth: its keys define `TranslationKey`, and `id` must
 * cover exactly the same keys (enforced by the `Record<TranslationKey, string>`
 * type). `translate()` falls back to English, then the raw key, and supports
 * `{var}` interpolation.
 */

export type Lang = "en" | "id";

const en = {
  // Sidebar
  "sidebar.tagline": "Precision Monitoring",
  "sidebar.collapse": "Collapse",
  "sidebar.adminName": "Admin User",
  "sidebar.adminRole": "System Administrator",
  "sidebar.comingSoon": "Coming soon",
  "sidebar.settings": "Settings",

  // Top header
  "header.searchPlaceholder": "Search area, hotspot, or zone...",
  "status.live": "Live",
  "status.refreshing": "Refreshing",
  "status.disconnected": "Disconnected",

  // Dashboard cards
  "cards.activeVisitors": "Estimated Active Visitors",
  "cards.totalPoints": "Total Location Points",
  "cards.mostCrowded": "Most Crowded Area",
  "cards.showingAreaOne": "Showing {count} area",
  "cards.showingAreaMany": "Showing {count} areas",
  "cards.updatedLive": "Updated live",
  "cards.highDensity": "High density",

  // Hotspot table
  "table.title": "Hotspot Summary",
  "table.filterAll": "All Areas",
  "table.filterHigh": "High Density",
  "table.colArea": "Area / Hotspot",
  "table.colDensity": "Density Level",
  "table.colPoints": "Visitor Points",
  "table.colStatus": "Status",
  "table.loading": "Loading hotspots…",
  "table.empty": "No hotspots detected in this view.",

  // Density tiers + status badges (shared by table, legend, markers)
  "density.high": "High",
  "density.medium": "Medium",
  "density.low": "Low",
  "status.crowded": "Crowded",
  "status.moderate": "Moderate",
  "status.normal": "Normal",

  // Density legend
  "legend.title": "Visitor Density",

  // Time filter
  "time.today": "Today",

  // Full-map active indicators
  "active.heatmap": "Heatmap Active",
  "active.hotspots": "Hotspots Active",

  // Map empty state
  "map.emptyTitle": "No visitor activity",
  "map.emptyBody": "Nothing recorded in this time window yet.",

  // Loading
  "loading.loading": "Loading…",

  // Error banner
  "error.retrying": "{error}. Retrying every {seconds}s.",

  // Settings — Appearance
  "settings.appearanceTitle": "Appearance",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.themeSystem": "System",

  // Settings — Language
  "settings.languageTitle": "Language",
  "settings.langEnglish": "English",
  "settings.langIndonesia": "Indonesia",
} as const;

export type TranslationKey = keyof typeof en;

const id: Record<TranslationKey, string> = {
  // Sidebar
  "sidebar.tagline": "Pemantauan Presisi",
  "sidebar.collapse": "Ciutkan",
  "sidebar.adminName": "Pengguna Admin",
  "sidebar.adminRole": "Administrator Sistem",
  "sidebar.comingSoon": "Segera hadir",
  "sidebar.settings": "Settings",

  // Top header
  "header.searchPlaceholder": "Cari area, hotspot, atau zona...",
  "status.live": "Langsung",
  "status.refreshing": "Menyegarkan",
  "status.disconnected": "Terputus",

  // Dashboard cards
  "cards.activeVisitors": "Perkiraan Pengunjung Aktif",
  "cards.totalPoints": "Total Titik Lokasi",
  "cards.mostCrowded": "Area Paling Ramai",
  "cards.showingAreaOne": "Menampilkan {count} area",
  "cards.showingAreaMany": "Menampilkan {count} area",
  "cards.updatedLive": "Diperbarui langsung",
  "cards.highDensity": "Kepadatan tinggi",

  // Hotspot table
  "table.title": "Ringkasan Hotspot",
  "table.filterAll": "Semua Area",
  "table.filterHigh": "Kepadatan Tinggi",
  "table.colArea": "Area / Hotspot",
  "table.colDensity": "Tingkat Kepadatan",
  "table.colPoints": "Titik Pengunjung",
  "table.colStatus": "Status",
  "table.loading": "Memuat hotspot…",
  "table.empty": "Tidak ada hotspot terdeteksi pada tampilan ini.",

  // Density tiers + status badges
  "density.high": "Tinggi",
  "density.medium": "Sedang",
  "density.low": "Rendah",
  "status.crowded": "Ramai",
  "status.moderate": "Cukup Ramai",
  "status.normal": "Normal",

  // Density legend
  "legend.title": "Kepadatan Pengunjung",

  // Time filter
  "time.today": "Hari Ini",

  // Full-map active indicators
  "active.heatmap": "Heatmap Aktif",
  "active.hotspots": "Hotspot Aktif",

  // Map empty state
  "map.emptyTitle": "Tidak ada aktivitas pengunjung",
  "map.emptyBody": "Belum ada yang tercatat pada rentang waktu ini.",

  // Loading
  "loading.loading": "Memuat…",

  // Error banner
  "error.retrying": "{error}. Mencoba lagi setiap {seconds}d.",

  // Settings — Appearance
  "settings.appearanceTitle": "Tampilan",
  "settings.themeLight": "Terang",
  "settings.themeDark": "Gelap",
  "settings.themeSystem": "Sistem",

  // Settings — Language
  "settings.languageTitle": "Bahasa",
  "settings.langEnglish": "English",
  "settings.langIndonesia": "Indonesia",
};

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { en, id };

/** Translate `key` for `lang`, falling back to English then the raw key. */
export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  let str: string = dictionaries[lang][key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.replace(`{${name}}`, String(value));
    }
  }
  return str;
}
