import { useEffect, useMemo, useState } from "react";
import type { Hotspot } from "../types/hotspot";
import { hotspotTier, maxPoints, TIER_META } from "../lib/hotspots";
import { useLanguage } from "../context/language";
import { isWall } from "../lib/display";

/**
 * Rows shown per page. The table renders exactly this many row slots at all
 * times (short pages are padded with blank rows) so the panel height is static
 * and the dashboard layout never reflows as you page through.
 *
 * A wall display shows more at once: nobody is standing there to press Next, so
 * pagination that a desk operator drives becomes dead weight on the wall.
 */
const PAGE_SIZE = isWall() ? 8 : 4;

interface HotspotTableProps {
  hotspots: Hotspot[];
  loading: boolean;
  /** Selected cluster id (row highlighted), synced with the map. */
  selectedId?: string | null;
  /** Called when a row is clicked. */
  onSelect?: (id: string) => void;
}

type Filter = "all" | "high";

/**
 * Bottom panel of the Dashboard: a hotspot summary table built from the
 * existing /api/hotspots data. Columns: Area/Hotspot, Density Level, Visitor
 * Points, Status. No action buttons (no dispatch/alerts) per the spec.
 */
export default function HotspotTable({ hotspots, loading, selectedId, onSelect }: HotspotTableProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const max = useMemo(() => maxPoints(hotspots), [hotspots]);

  const rows = useMemo(() => {
    const ranked = [...hotspots]
      .map((h) => ({ h, tier: hotspotTier(h.total_points, max) }))
      .sort((a, b) => b.h.total_points - a.h.total_points);
    return filter === "high" ? ranked.filter((r) => r.tier === "high") : ranked;
  }, [hotspots, max, filter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // A poll or filter change can shrink the set out from under the current page.
  // Clamp rather than reset so paging survives a refresh that keeps the page valid.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  const start = page * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  // Blank filler rows keep the panel height fixed on the last (short) page.
  const filler = Math.max(0, PAGE_SIZE - pageRows.length);

  return (
    <section aria-labelledby="hotspot-table-title" className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
        <h2 id="hotspot-table-title" className="font-display text-lg text-gray-900 wall:text-2xl dark:text-white">{t("table.title")}</h2>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {(["all", "high"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              aria-pressed={filter === f}
              className={
                "tap rounded-md px-3 py-1 text-xs font-medium transition-colors wall:px-4 wall:py-2 wall:text-sm " +
                (filter === f
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white")
              }
            >
              {f === "all" ? t("table.filterAll") : t("table.filterHigh")}
            </button>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm wall:text-lg">
          <thead>
            <tr className="border-b border-gray-100 font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-500 wall:text-sm dark:border-gray-800 dark:text-gray-400">
              <th className="px-5 py-2.5">{t("table.colArea")}</th>
              <th className="px-5 py-2.5">{t("table.colDensity")}</th>
              <th className="px-5 py-2.5 text-right">{t("table.colPoints")}</th>
              <th className="px-5 py-2.5">{t("table.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && hotspots.length === 0 ? (
              <MessageRows text={t("table.loading")} />
            ) : rows.length === 0 ? (
              <MessageRows text={t("table.empty")} />
            ) : (
              pageRows.map(({ h, tier }) => {
                const meta = TIER_META[tier];
                const isSelected = selectedId === h.cluster_id;
                return (
                  <tr
                    key={h.cluster_id}
                    onClick={() => onSelect?.(h.cluster_id)}
                    aria-selected={isSelected}
                    className={
                      "border-b border-gray-50 last:border-0 dark:border-gray-800/60 " +
                      (onSelect ? "cursor-pointer " : "") +
                      (isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50")
                    }
                  >
                    <td className="px-5 py-3">
                      <p className="break-words font-medium text-gray-900 dark:text-white">{h.label}</p>
                      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">ID: #{h.cluster_id}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                        {t(meta.labelKey)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                      {h.total_points.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className={"inline-flex rounded-full px-2.5 py-0.5 font-mono text-xs font-medium wall:px-3 wall:py-1 wall:text-base " + meta.badgeClass}>
                        {t(meta.statusKey)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
            {rows.length > 0 &&
              Array.from({ length: filler }, (_, i) => <FillerRow key={`filler-${i}`} />)}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {rows.length === 0
            ? t("table.pageStatus", { from: 0, to: 0, total: 0 })
            : t("table.pageStatus", {
                from: start + 1,
                to: start + pageRows.length,
                total: rows.length,
              })}
        </p>
        <div className="inline-flex items-center gap-1.5">
          <PageButton
            label={t("table.pagePrev")}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          />
          <span className="font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {page + 1}/{pageCount}
          </span>
          <PageButton
            label={t("table.pageNext")}
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </div>
      </footer>
    </section>
  );
}

/**
 * Blank row occupying one data-row slot. Mirrors the two-line cell structure of
 * a real row so the padded height matches exactly.
 */
function FillerRow() {
  return (
    <tr aria-hidden="true" className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
      <td className="px-5 py-3">
        <p className="font-medium">&nbsp;</p>
        <p className="font-mono text-xs">&nbsp;</p>
      </td>
      <td className="px-5 py-3" />
      <td className="px-5 py-3" />
      <td className="px-5 py-3" />
    </tr>
  );
}

/** Loading / empty message in the first slot, padded out to the full PAGE_SIZE. */
function MessageRows({ text }: { text: string }) {
  return (
    <>
      <tr className="border-b border-gray-50 dark:border-gray-800/60">
        <td colSpan={4} className="px-5 py-3 text-center text-gray-500 dark:text-gray-400">
          <p className="font-medium">{text}</p>
          <p className="font-mono text-xs">&nbsp;</p>
        </td>
      </tr>
      {Array.from({ length: PAGE_SIZE - 1 }, (_, i) => (
        <FillerRow key={`msg-filler-${i}`} />
      ))}
    </>
  );
}

/** Compact prev/next control for the table footer. */
function PageButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 wall:px-4 wall:py-2 wall:text-sm dark:border-gray-700 dark:text-gray-300 dark:hover:text-white"
    >
      {label}
    </button>
  );
}
