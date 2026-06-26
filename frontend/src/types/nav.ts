/** Sidebar navigation pages. Dashboard/Heatmap/Hotspots are functional; the
 *  rest are visible placeholders. */
export type Page = "dashboard" | "heatmap" | "hotspots" | "visitor" | "settings";

/** Pages that are wired to real views. */
export type ActivePage = "dashboard" | "heatmap" | "hotspots";
