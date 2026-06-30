/** Sidebar navigation pages. Dashboard/Heatmap/Hotspots/Mock are functional;
 *  the rest are visible placeholders. */
export type Page = "dashboard" | "heatmap" | "hotspots" | "mock" | "visitor" | "settings";

/** Pages that are wired to real views. */
export type ActivePage = "dashboard" | "heatmap" | "hotspots" | "mock";
