import { useState } from "react";
import { generateMockData } from "../lib/api";
import type { GenerateMockResult } from "../lib/api";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: GenerateMockResult }
  | { kind: "error"; message: string };

const SOURCES: { value: string; label: string }[] = [
  { value: "mock", label: "Mock" },
  { value: "mobile_app", label: "Mobile App" },
];

// Backend guard rails (mock.routes.ts): visitor_count 1–5000, points 1–500.
const MAX_VISITORS = 5000;
const MAX_POINTS = 500;

/** Labelled number input with min/max, used for the two count fields. */
function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 tabular-nums focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-gray-600 dark:focus:ring-gray-700"
      />
      <span className="mt-1 block font-mono text-[11px] text-gray-500 dark:text-gray-400">
        {min}–{max}
      </span>
    </label>
  );
}

/** Inline toast (success or error) shown under the form after a run. */
function Toast({ status }: { status: Status }) {
  if (status.kind === "success") {
    const { inserted, source } = status.result;
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>
          Generated and inserted <strong className="tabular-nums">{inserted.toLocaleString()}</strong>{" "}
          location points (source: <span className="font-mono">{source}</span>).
        </span>
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>{status.message}</span>
      </div>
    );
  }
  return null;
}

/**
 * Admin page to generate mock visitor data via POST /api/mock/generate.
 * Lets an admin pick visitor count, points per visitor, and source, then shows
 * a loading state, a success/error toast, and a summary of the last run.
 */
export default function MockGeneratorView() {
  const [visitorCount, setVisitorCount] = useState(50);
  const [pointsPerVisitor, setPointsPerVisitor] = useState(20);
  const [source, setSource] = useState("mock");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const loading = status.kind === "loading";

  const invalid =
    !Number.isInteger(visitorCount) ||
    visitorCount < 1 ||
    visitorCount > MAX_VISITORS ||
    !Number.isInteger(pointsPerVisitor) ||
    pointsPerVisitor < 1 ||
    pointsPerVisitor > MAX_POINTS;

  const estimatedPoints = invalid ? null : visitorCount * pointsPerVisitor;

  async function handleGenerate() {
    if (invalid || loading) return;
    setStatus({ kind: "loading" });
    try {
      const result = await generateMockData({ visitorCount, pointsPerVisitor, source });
      setStatus({ kind: "success", result });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Generation failed" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-6">
      <section aria-labelledby="mock-generator-title" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 id="mock-generator-title" className="font-display text-lg text-gray-900 dark:text-white">Mock Generator</h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Generate clustered visitor data around Borobudur for testing.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            id="visitor-count"
            label="Visitor count"
            value={visitorCount}
            min={1}
            max={MAX_VISITORS}
            onChange={setVisitorCount}
            disabled={loading}
          />
          <NumberField
            id="points-per-visitor"
            label="Points per visitor"
            value={pointsPerVisitor}
            min={1}
            max={MAX_POINTS}
            onChange={setPointsPerVisitor}
            disabled={loading}
          />
        </div>

        <label htmlFor="source" className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Source</span>
          <select
            id="source"
            value={source}
            disabled={loading}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-gray-600 dark:focus:ring-gray-700"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {estimatedPoints !== null ? (
              <>
                ≈ <span className="font-mono tabular-nums">{estimatedPoints.toLocaleString()}</span> points
              </>
            ) : (
              <span className="text-red-500 dark:text-red-400">Values out of range</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={invalid || loading}
            className="tap inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {loading && (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
            )}
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </section>

      <Toast status={status} />
    </div>
  );
}
