"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Plot from "@/components/PlotNoTypes";
import { useTheme } from "@/context/ThemeContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────────

type ColType = "numeric" | "datetime" | "categorical";

type ColMeta = {
  name: string;
  inferred_type: ColType;
  null_rate: number;
  distinct_count: number;
};

type ChartType = "bar" | "line" | "scatter" | "histogram" | "box" | "pie";
type AggFunc = "count" | "sum" | "mean" | "median";

type ChartConfig = {
  id: string;
  title: string;
  chart_type: ChartType;
  x: string;
  y: string;
  agg: AggFunc;
  color_by: string;
};

type SavedReport = {
  id: string;
  file_id: string;
  name: string;
  description?: string | null;
  chart_configs: ChartConfig[];
  filters: Record<string, unknown>;
  sheet_name?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type PlotFigure = {
  data?: unknown[];
  layout?: Record<string, unknown>;
};

function reportSnapshot(name: string, charts: ChartConfig[], sheetName?: string | null) {
  return JSON.stringify({
    name: name.trim(),
    charts,
    sheet_name: sheetName ?? null,
  });
}

// ── Chart type metadata ────────────────────────────────────────────────────────

type ChartMeta = {
  label: string;
  hint: string;
  needsX: boolean;
  needsY: boolean;
  showAgg: boolean;
  showSplitBy: boolean;
  xLabel: string;
  yLabel: string;
};

const CHART_META: Record<ChartType, ChartMeta> = {
  bar: {
    label: "Bar Chart",
    hint: "Compare totals or averages across categories - great for ranking regions, products, or teams.",
    needsX: true,
    needsY: false,
    showAgg: true,
    showSplitBy: true,
    xLabel: "Category",
    yLabel: "Value to measure",
  },
  line: {
    label: "Line Chart",
    hint: "Show how a number changes over time - ideal for tracking trends week over week or month over month.",
    needsX: true,
    needsY: true,
    showAgg: true,
    showSplitBy: true,
    xLabel: "Date or sequence",
    yLabel: "Value to track",
  },
  scatter: {
    label: "Scatter Plot",
    hint: "Find correlations - do higher sales reps also have higher deal sizes? Plot two numbers to find out.",
    needsX: true,
    needsY: true,
    showAgg: false,
    showSplitBy: true,
    xLabel: "First number",
    yLabel: "Second number",
  },
  histogram: {
    label: "Distribution",
    hint: "See the spread of a number - are most values clustered together or spread wide? Great for spotting outliers.",
    needsX: true,
    needsY: false,
    showAgg: false,
    showSplitBy: false,
    xLabel: "Number to analyze",
    yLabel: "",
  },
  box: {
    label: "Range & Outliers",
    hint: "Show the typical range and spot extreme values - useful for comparing performance spread across teams or periods.",
    needsX: false,
    needsY: true,
    showAgg: false,
    showSplitBy: false,
    xLabel: "Group by (optional)",
    yLabel: "Number to measure",
  },
  pie: {
    label: "Pie Chart",
    hint: "Show how a total is divided - what share of revenue comes from each product or region?",
    needsX: true,
    needsY: false,
    showAgg: false,
    showSplitBy: false,
    xLabel: "Category (slices)",
    yLabel: "Value (optional)",
  },
};

const CHART_TYPES = Object.keys(CHART_META) as ChartType[];

const AGG_OPTIONS: { label: string; desc: string; value: AggFunc }[] = [
  { label: "Count",   desc: "Number of records",    value: "count" },
  { label: "Total",   desc: "Sum of all values",     value: "sum" },
  { label: "Average", desc: "Mean of all values",    value: "mean" },
  { label: "Median",  desc: "Middle value",          value: "median" },
];

const makeId = () => Math.random().toString(36).slice(2, 10);

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// ── Chart narrative helpers ────────────────────────────────────────────────────

async function streamSSE(
  url: string,
  body: unknown,
  token: string,
  onToken: (text: string) => void,
  onError: (msg: string) => void,
  onDone: () => void,
  signal: AbortSignal,
) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) { onError("Request failed"); onDone(); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "token") onToken(evt.content);
            else if (evt.type === "error") onError(evt.content);
            else if (evt.type === "done") onDone();
          } catch { /* ignore malformed */ }
        }
      }
    }
  } catch (err: unknown) {
    if ((err as Error).name !== "AbortError") onError("Could not reach the AI. Please try again.");
    onDone();
  }
}

type PlotTrace = Record<string, unknown>;

// Session cache for AI chart narratives, keyed by chart config + data, so
// re-narrating an unchanged chart doesn't repeat the API call (and its cost).
const narrativeCache = new Map<string, string>();

function extractDataSummary(fig: PlotFigure): string {
  if (!fig.data?.length) return "";
  const trace = fig.data[0] as PlotTrace;
  const type = String(trace.type ?? "");
  const lines: string[] = [];

  if (type === "pie") {
    const labels = (trace.labels as string[]) ?? [];
    const values = (trace.values as number[]) ?? [];
    const total = values.reduce((a, b) => a + b, 0);
    lines.push(`Total: ${total.toLocaleString()}`);
    labels
      .map((l, i) => ({ l, v: values[i] ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 8)
      .forEach(({ l, v }) => {
        const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
        lines.push(`  ${l}: ${v.toLocaleString()} (${pct}%)`);
      });
  } else {
    const x = (trace.x as unknown[]) ?? [];
    const y = (trace.y as number[]) ?? [];
    const numY = y.filter((v) => typeof v === "number");
    if (numY.length) {
      const total = numY.reduce((a, b) => a + b, 0);
      const min = Math.min(...numY);
      const max = Math.max(...numY);
      lines.push(`Total: ${total.toLocaleString()}, Min: ${min.toLocaleString()}, Max: ${max.toLocaleString()}`);
      x.map((xi, i) => ({ xi: String(xi), yi: y[i] ?? 0 }))
        .sort((a, b) => b.yi - a.yi)
        .slice(0, 10)
        .forEach(({ xi, yi }) => lines.push(`  ${xi}: ${yi.toLocaleString()}`));
    } else if (x.length) {
      const nums = x.filter((v) => typeof v === "number") as number[];
      if (nums.length) {
        const sorted = [...nums].sort((a, b) => a - b);
        const mean = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
        const median = sorted[Math.floor(sorted.length / 2)];
        lines.push(`Count: ${nums.length}, Min: ${sorted[0].toLocaleString()}, Max: ${sorted[sorted.length - 1].toLocaleString()}`);
        lines.push(`Mean: ${mean}, Median: ${median.toLocaleString()}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validate(cfg: ChartConfig, numCols: string[]): string | null {
  const meta = CHART_META[cfg.chart_type];
  if (meta.needsX && !cfg.x) return `Choose a field for "${meta.xLabel}"`;
  if (meta.needsY && !cfg.y) return `Choose a field for "${meta.yLabel}"`;
  if (cfg.y && !numCols.includes(cfg.y)) return "The value field must be a number column";
  if (cfg.x && cfg.y && cfg.x === cfg.y) return "The two fields must be different";
  return null;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function friendly(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeLabel(t: ColType) {
  if (t === "numeric") return "number";
  if (t === "datetime") return "date";
  return "text";
}

// ── ColSelect ─────────────────────────────────────────────────────────────────

function ColSelect({
  label,
  value,
  onChange,
  cols,
  placeholder = "Choose field",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cols: ColMeta[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-xs uppercase tracking-wide font-medium text-[var(--text-muted)]">
        {label}
        {required && <span className="ml-0.5" style={{ color: "var(--error-fg)" }}>*</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input px-2 py-1.5"
      >
        <option value="">{placeholder}</option>
        {cols.map((c) => (
          <option key={c.name} value={c.name}>
            {friendly(c.name)} ({typeLabel(c.inferred_type)})
          </option>
        ))}
      </select>
    </label>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────

function ChartCard({
  cfg,
  cols,
  renderedFig,
  isRunning,
  onUpdate,
  onRemove,
  onGenerate,
  plotLayout,
  fileId,
  token,
}: {
  cfg: ChartConfig;
  cols: ColMeta[];
  renderedFig: PlotFigure | null;
  isRunning: boolean;
  onUpdate: (patch: Partial<ChartConfig>) => void;
  onRemove: () => void;
  onGenerate: () => void;
  plotLayout: object;
  fileId: string;
  token: string;
}) {
  const [narrateState, setNarrateState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [narrative, setNarrative] = React.useState("");
  const narrateAbortRef = React.useRef<AbortController | null>(null);

  // Reset narrative when chart is rebuilt
  React.useEffect(() => {
    setNarrateState("idle");
    setNarrative("");
  }, [renderedFig]);

  function handleNarrate(forceRefresh = false) {
    if (!renderedFig || narrateState === "loading") return;

    const dataSummary = extractDataSummary(renderedFig);
    const cacheKey = [
      fileId, cfg.chart_type, cfg.x, cfg.y, cfg.agg, cfg.color_by, dataSummary,
    ].join("::");

    if (!forceRefresh) {
      const cached = narrativeCache.get(cacheKey);
      if (cached) {
        setNarrative(cached);
        setNarrateState("done");
        return;
      }
    }

    setNarrative("");
    setNarrateState("loading");

    const controller = new AbortController();
    narrateAbortRef.current = controller;

    let streamed = "";
    let hadError = false;

    streamSSE(
      `${API_BASE_URL}/api/files/${fileId}/chart-narrative`,
      {
        chart_title: cfg.title || friendly(cfg.x || cfg.y || "Chart"),
        chart_type: cfg.chart_type,
        x_label: cfg.x ? friendly(cfg.x) : "",
        y_label: cfg.y ? friendly(cfg.y) : "",
        agg: cfg.agg,
        data_summary: dataSummary,
      },
      token,
      (text) => { streamed += text; setNarrative((prev) => prev + text); },
      (msg) => { hadError = true; setNarrative(msg); setNarrateState("error"); },
      () => {
        setNarrateState((s) => s !== "error" ? "done" : "error");
        if (!hadError && streamed) narrativeCache.set(cacheKey, streamed);
      },
      controller.signal,
    );
  }

  function handleDismissNarrative() {
    narrateAbortRef.current?.abort();
    setNarrateState("idle");
    setNarrative("");
  }
  const meta = CHART_META[cfg.chart_type];
  const numCols = cols.filter((c) => c.inferred_type === "numeric");
  const catCols = cols.filter((c) => c.inferred_type === "categorical");
  const allCols = cols;

  const xCols =
    cfg.chart_type === "scatter" || cfg.chart_type === "histogram"
      ? numCols
      : cfg.chart_type === "pie"
      ? catCols.length ? catCols : allCols
      : allCols;

  const validationError = validate(cfg, numCols.map((c) => c.name));
  const isReady = !validationError;

  return (
    <div className="card overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
        <input
          value={cfg.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="flex-1 bg-transparent text-sm font-semibold text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
          placeholder="e.g. Revenue by Region"
          maxLength={80}
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!isReady || isRunning}
            className="btn btn-primary btn-sm"
          >
            {isRunning ? "Building…" : renderedFig ? "Update Chart" : "Build Chart"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="btn btn-ghost btn-sm"
            title="Remove this chart"
            aria-label="Remove this chart"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Config ── */}
      <div className="px-4 py-3 bg-[color:var(--bg-panel-2)] border-b border-[var(--border-subtle)]">

        {/* Chart type pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CHART_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onUpdate({ chart_type: t, x: "", y: "", color_by: "" })}
              aria-pressed={cfg.chart_type === t}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 border"
              style={
                cfg.chart_type === t
                  ? {
                      background: "var(--accent-soft)",
                      borderColor: "var(--focus-ring)",
                      color: "var(--link)",
                    }
                  : {
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                      background: "var(--bg-panel)",
                    }
              }
            >
              {CHART_META[t].label}
            </button>
          ))}
        </div>

        {/* Field dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(meta.needsX || cfg.chart_type === "box") && (
            <ColSelect
              label={meta.xLabel}
              value={cfg.x}
              onChange={(v) => onUpdate({ x: v })}
              cols={xCols}
              required={meta.needsX}
            />
          )}

          {(meta.needsY || meta.showAgg) && (
            <ColSelect
              label={meta.yLabel || "Value to measure"}
              value={cfg.y}
              onChange={(v) => onUpdate({ y: v })}
              cols={numCols}
              placeholder="Choose number field"
              required={meta.needsY}
            />
          )}

          {meta.showAgg && (
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide font-medium text-[var(--text-muted)]">
                Summarize by
              </span>
              <select
                value={cfg.agg}
                onChange={(e) => onUpdate({ agg: e.target.value as AggFunc })}
                className="input px-2 py-1.5"
              >
                {AGG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} title={o.desc}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {meta.showSplitBy && (
            <ColSelect
              label="Split by (optional)"
              value={cfg.color_by}
              onChange={(v) => onUpdate({ color_by: v })}
              cols={catCols}
              placeholder="No split"
            />
          )}
        </div>

        {/* Hint */}
        <p className="mt-2.5 text-xs text-[var(--text-muted)] leading-relaxed italic">
          {meta.hint}
        </p>

        {/* Validation */}
        {validationError && (
          <div
            className="mt-2 rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs"
            style={{
              background: "var(--warning-bg)",
              borderColor: "var(--warning-border)",
              color: "var(--warning-fg)",
            }}
          >
            {validationError}
          </div>
        )}
      </div>

      {/* ── Output ── */}
      <div className="px-4 py-4 space-y-3">
        {isRunning && (
          <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)]">
            <span className="animate-pulse">Building your chart…</span>
          </div>
        )}

        {!isRunning && renderedFig && (
          <>
            <div className="h-[340px] w-full">
              <Plot
                data={renderedFig.data}
                layout={{ ...(renderedFig.layout ?? {}), ...plotLayout, title: undefined }}
                config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d", "toImage"] }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            {/* Narrative */}
            <div className="flex items-center justify-end gap-2">
              {narrateState === "idle" && (
                <button type="button" onClick={() => handleNarrate()} className="btn btn-accent-outline btn-sm">
                  ✦ Narrate
                </button>
              )}
              {narrateState === "loading" && (
                <span className="text-xs text-[var(--text-muted)] animate-pulse">Analyzing…</span>
              )}
              {narrateState === "done" && (
                <>
                  <button type="button" onClick={() => handleNarrate(true)} className="btn btn-ghost btn-sm">Refresh</button>
                  <button type="button" onClick={handleDismissNarrative} className="btn btn-ghost btn-sm">Hide</button>
                </>
              )}
              {narrateState === "error" && (
                <button type="button" onClick={handleDismissNarrative} className="btn btn-ghost btn-sm">Dismiss</button>
              )}
            </div>

            {narrateState !== "idle" && (
              <div
                className="rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm leading-relaxed"
                style={
                  narrateState === "error"
                    ? { background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }
                    : { background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--text-main)" }
                }
              >
                <p className="mb-1 text-xs font-semibold" style={{ color: "var(--info-fg)" }}>
                  ✦ AI Narrative
                </p>
                {narrateState === "loading" && !narrative && (
                  <span className="inline-flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s`, background: "var(--info-fg)" }}
                      />
                    ))}
                  </span>
                )}
                {narrative && <span className="whitespace-pre-wrap">{narrative}</span>}
              </div>
            )}
          </>
        )}

        {!isRunning && !renderedFig && isReady && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center border border-dashed border-[var(--border)] rounded-lg">
            <p className="text-xs text-[var(--text-muted)]">
              Your chart is configured - click{" "}
              <strong className="text-[var(--text-main)]">Build Chart</strong> to generate it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Suggested charts (auto-generated from column types) ────────────────────────

type Suggestion = {
  label: string;
  description: string;
  config: Omit<ChartConfig, "id">;
};

function buildSuggestions(cols: ColMeta[]): Suggestion[] {
  const numCols = cols.filter((c) => c.inferred_type === "numeric");
  const catCols = cols.filter((c) => c.inferred_type === "categorical");
  const dateCols = cols.filter((c) => c.inferred_type === "datetime");
  const suggestions: Suggestion[] = [];

  // Bar: first cat × first num
  if (catCols.length && numCols.length) {
    suggestions.push({
      label: `${friendly(numCols[0].name)} by ${friendly(catCols[0].name)}`,
      description: `Total ${friendly(numCols[0].name)} broken down by ${friendly(catCols[0].name)}`,
      config: {
        title: `${friendly(numCols[0].name)} by ${friendly(catCols[0].name)}`,
        chart_type: "bar",
        x: catCols[0].name,
        y: numCols[0].name,
        agg: "sum",
        color_by: "",
      },
    });
  }

  // Line: date × first num
  if (dateCols.length && numCols.length) {
    suggestions.push({
      label: `${friendly(numCols[0].name)} over time`,
      description: `How ${friendly(numCols[0].name)} changes over time`,
      config: {
        title: `${friendly(numCols[0].name)} over time`,
        chart_type: "line",
        x: dateCols[0].name,
        y: numCols[0].name,
        agg: "sum",
        color_by: "",
      },
    });
  }

  // Distribution of first num
  if (numCols.length) {
    suggestions.push({
      label: `Spread of ${friendly(numCols[0].name)}`,
      description: `See how ${friendly(numCols[0].name)} values are distributed`,
      config: {
        title: `Distribution of ${friendly(numCols[0].name)}`,
        chart_type: "histogram",
        x: numCols[0].name,
        y: "",
        agg: "count",
        color_by: "",
      },
    });
  }

  // Pie: first cat
  if (catCols.length) {
    suggestions.push({
      label: `Breakdown by ${friendly(catCols[0].name)}`,
      description: `Share of records for each ${friendly(catCols[0].name)}`,
      config: {
        title: `Breakdown by ${friendly(catCols[0].name)}`,
        chart_type: "pie",
        x: catCols[0].name,
        y: numCols[0]?.name ?? "",
        agg: "count",
        color_by: "",
      },
    });
  }

  return suggestions.slice(0, 3);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashboardBuilder({
  fileId,
  token,
  sheetName,
  onSheetChange,
}: {
  fileId: string;
  token: string;
  sheetName?: string | null;
  onSheetChange?: (sheetName: string | null) => void;
}) {
  const { theme } = useTheme();
  const restoringReportRef = useRef(false);

  const [cols, setCols] = useState<ColMeta[]>([]);
  const [colsLoading, setColsLoading] = useState(true);
  const [colsError, setColsError] = useState<string | null>(null);

  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [rendered, setRendered] = useState<Record<string, PlotFigure>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [runError, setRunError] = useState<string | null>(null);

  const [reports, setReports] = useState<SavedReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportName, setReportName] = useState("");
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReportSnapshot, setCurrentReportSnapshot] = useState<string | null>(null);
  const [savingReport, setSavingReport] = useState(false);

  const numCols = cols.filter((c) => c.inferred_type === "numeric");
  const catCols = cols.filter((c) => c.inferred_type === "categorical");
  const dateCols = cols.filter((c) => c.inferred_type === "datetime");

  const suggestions = useMemo(() => buildSuggestions(cols), [cols]);

  const plotLayout = useMemo(() => {
    // Read the chart tokens so Plotly tracks the active theme exactly
    const fallback =
      theme === "dark"
        ? { text: "#d0d8e8", grid: "rgba(168, 185, 214, 0.18)" }
        : { text: "#2d3a52", grid: "rgba(16, 24, 40, 0.12)" };
    const styles =
      typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
    const text = styles?.getPropertyValue("--chart-text").trim() || fallback.text;
    const grid = styles?.getPropertyValue("--chart-grid").trim() || fallback.grid;

    // Explicitly set tickfont and title.font on each axis so Plotly's own
    // default grey (#444) can't override the theme color.
    const axisFontProps = { tickfont: { color: text, size: 11 }, title: { font: { color: text, size: 12 } } };

    return {
      autosize: true,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: text, size: 12 },
      xaxis: { gridcolor: grid, zerolinecolor: grid, linecolor: grid, ...axisFontProps },
      yaxis: { gridcolor: grid, zerolinecolor: grid, linecolor: grid, ...axisFontProps },
      legend: { font: { color: text, size: 11 } },
      margin: { l: 50, r: 20, t: 20, b: 50 },
    };
  }, [theme]);

  // ── Fetch column metadata ────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileId || !token) return;
    const controller = new AbortController();
    let cancelled = false;
    setColsLoading(true);
    const url = new URL(`${API_BASE_URL}/api/files/${fileId}/insights`);
    if (sheetName) {
      url.searchParams.set("sheet_name", sheetName);
    }

    fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load file columns"))))
      .then((data) => {
        if (cancelled) return;
        setCols(data.columns ?? []);
        setColsError(null);
      })
      .catch((err) => {
        if (cancelled || err.name === "AbortError") return;
        setColsError(err.message ?? "Failed to load columns");
      })
      .finally(() => {
        if (!cancelled) setColsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fileId, sheetName, token]);

  const fetchReports = useCallback(async () => {
    if (!fileId || !token) return;
    setReportsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Could not load saved reports");
      }
      const data = (await res.json()) as SavedReport[];
      setReports(data);
      setReportError(null);
    } catch (err: unknown) {
      setReportError(errorMessage(err, "Could not load saved reports"));
    } finally {
      setReportsLoading(false);
    }
  }, [fileId, token]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (restoringReportRef.current) {
      restoringReportRef.current = false;
      return;
    }
    setCharts([]);
    setRendered({});
    setRunError(null);
    setCurrentReportId(null);
    setCurrentReportSnapshot(null);
    setReportName("");
  }, [sheetName]);

  // ── Chart management ─────────────────────────────────────────────────────────
  const addBlankChart = useCallback(() => {
    setCharts((prev) => [
      ...prev,
      {
        id: makeId(),
        title: "",
        chart_type: "bar",
        x: catCols[0]?.name ?? cols[0]?.name ?? "",
        y: numCols[0]?.name ?? "",
        agg: "count",
        color_by: "",
      },
    ]);
  }, [catCols, numCols, cols]);

  const addFromSuggestion = useCallback((s: Suggestion) => {
    setCharts((prev) => [...prev, { id: makeId(), ...s.config }]);
  }, []);

  const updateChart = useCallback((id: string, patch: Partial<ChartConfig>) => {
    setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setRendered((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const removeChart = useCallback((id: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== id));
    setRendered((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // ── Generate charts ──────────────────────────────────────────────────────────
  const generateChartConfigs = useCallback(
    async (configs: ChartConfig[], ids: string[], overrideSheetName?: string | null) => {
      const toRun = configs.filter((c) => ids.includes(c.id));
      if (!toRun.length) return;

      setRunError(null);
      setRunningIds((prev) => new Set([...prev, ...ids]));

      try {
        const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/custom-charts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            charts: toRun,
            filters: {},
            sheet_name: overrideSheetName === undefined ? sheetName : overrideSheetName,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Chart generation failed");
        }

        const data = (await res.json()) as { charts?: Record<string, PlotFigure> };
        const newFigs: Record<string, PlotFigure> = data.charts ?? {};

        setRendered((prev) => ({ ...prev, ...newFigs }));

        const missing = toRun.filter((c) => !newFigs[c.id]);
        if (missing.length) {
          setRunError(
            `${missing.length} chart${missing.length > 1 ? "s" : ""} couldn't be built - check that the selected fields are compatible with the chart type chosen.`
          );
        }
      } catch (err: unknown) {
        setRunError(errorMessage(err, "Something went wrong generating your charts. Please try again."));
      } finally {
        setRunningIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [fileId, sheetName, token]
  );

  const generateCharts = useCallback(
    async (ids: string[]) => {
      await generateChartConfigs(charts, ids);
    },
    [charts, generateChartConfigs]
  );

  const generateAll = useCallback(() => {
    const validIds = charts
      .filter((c) => !validate(c, numCols.map((n) => n.name)))
      .map((c) => c.id);
    generateCharts(validIds);
  }, [charts, numCols, generateCharts]);

  const saveReport = useCallback(
    async (mode: "save" | "save-as") => {
      const name = reportName.trim();
      if (!name) {
        setReportError("Name this report before saving.");
        return;
      }
      if (!charts.length) {
        setReportError("Add at least one chart before saving a report.");
        return;
      }

      const updating = mode === "save" && currentReportId;
      const duplicate = reports.find(
        (report) =>
          report.name.trim().toLowerCase() === name.toLowerCase() &&
          (!updating || report.id !== currentReportId)
      );
      if (duplicate) {
        setReportError(
          `A saved report named "${name}" already exists. Choose a different name or load that report and overwrite it.`
        );
        return;
      }
      setSavingReport(true);
      try {
        const res = await fetch(
          updating
            ? `${API_BASE_URL}/api/files/${fileId}/reports/${currentReportId}`
            : `${API_BASE_URL}/api/files/${fileId}/reports`,
          {
            method: updating ? "PUT" : "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
              chart_configs: charts,
              filters: {},
              sheet_name: sheetName,
            }),
          }
        );
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Could not save report");
        }
        const saved = (await res.json()) as SavedReport;
        setCurrentReportId(saved.id);
        setReportName(saved.name);
        setCurrentReportSnapshot(reportSnapshot(saved.name, saved.chart_configs, saved.sheet_name));
        setReportError(null);
        await fetchReports();
      } catch (err: unknown) {
        setReportError(errorMessage(err, "Could not save report"));
      } finally {
        setSavingReport(false);
      }
    },
    [charts, currentReportId, fetchReports, fileId, reportName, reports, sheetName, token]
  );

  const loadReport = useCallback(
    async (reportId: string) => {
      if (!reportId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/reports/${reportId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Could not load report");
        }
        const report = (await res.json()) as SavedReport;
        if (report.sheet_name !== sheetName && onSheetChange) {
          restoringReportRef.current = true;
          onSheetChange(report.sheet_name ?? null);
        }
        const nextCharts = report.chart_configs ?? [];
        setCharts(nextCharts);
        setRendered({});
        setCurrentReportId(report.id);
        setReportName(report.name);
        setCurrentReportSnapshot(reportSnapshot(report.name, nextCharts, report.sheet_name));
        setReportError(null);
        const validIds = nextCharts
          .filter((c) => !validate(c, numCols.map((n) => n.name)))
          .map((c) => c.id);
        await generateChartConfigs(nextCharts, validIds, report.sheet_name ?? null);
      } catch (err: unknown) {
        setReportError(errorMessage(err, "Could not load report"));
      }
    },
    [fileId, generateChartConfigs, numCols, onSheetChange, sheetName, token]
  );

  const deleteCurrentReport = useCallback(async () => {
    if (!currentReportId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/reports/${currentReportId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Could not delete report");
      }
      setCurrentReportId(null);
      setCurrentReportSnapshot(null);
      setReportName("");
      setReportError(null);
      await fetchReports();
    } catch (err: unknown) {
      setReportError(errorMessage(err, "Could not delete report"));
    }
  }, [currentReportId, fetchReports, fileId, token]);

  const anyRunning = runningIds.size > 0;
  const currentReportDirty =
    !!currentReportId &&
    currentReportSnapshot !== reportSnapshot(reportName, charts, sheetName);
  const validChartCount = charts.filter(
    (c) => !validate(c, numCols.map((n) => n.name))
  ).length;

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (colsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
        <span className="animate-pulse">Loading your data fields…</span>
      </div>
    );
  }

  if (colsError) {
    return (
      <div className="rounded-[var(--radius-md)] border p-5 text-sm" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }}>
        Could not load field information: {colsError}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-main)]">Build Your Charts</h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Turn your data into charts - no formulas, no SQL, no waiting on your analyst.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {charts.length > 0 && validChartCount > 0 && (
            <button
              type="button"
              onClick={generateAll}
              disabled={anyRunning}
              className="btn btn-accent-outline"
            >
              {anyRunning ? "Building…" : `Generate All (${validChartCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={addBlankChart}
            disabled={cols.length === 0}
            className="btn btn-primary"
          >
            + Add Chart
          </button>
        </div>
      </div>

      {/* Saved report controls */}
      <div className="card p-3">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_auto] lg:items-end">
          <label className="flex flex-col">
            <span className="field-label">Report name</span>
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="input"
              placeholder="e.g. Executive KPI dashboard"
              maxLength={200}
            />
          </label>

          <label className="flex flex-col">
            <span className="field-label">Load saved report</span>
            <select
              value={currentReportId ?? ""}
              onChange={(e) => {
                const reportId = e.target.value;
                if (reportId) {
                  loadReport(reportId);
                } else {
                  setCurrentReportId(null);
                  setCurrentReportSnapshot(null);
                  setReportName("");
                }
              }}
              disabled={reportsLoading}
              className="input"
            >
              <option value="">{reportsLoading ? "Loading reports..." : "Choose report"}</option>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveReport("save")}
              disabled={savingReport || !charts.length || (!!currentReportId && !currentReportDirty)}
              className="btn btn-primary"
            >
              {savingReport ? "Saving..." : currentReportId ? "Overwrite" : "Save Report"}
            </button>
            {currentReportDirty && (
              <button
                type="button"
                onClick={() => saveReport("save-as")}
                disabled={savingReport || !charts.length}
                className="btn btn-secondary"
              >
                Save As
              </button>
            )}
            {currentReportId && (
              <button
                type="button"
                onClick={deleteCurrentReport}
                className="btn btn-danger-outline"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {(runError || reportError) && (
        <div
          className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border px-4 py-2 text-xs"
          role="alert"
          style={{
            background: "var(--warning-bg)",
            borderColor: "var(--warning-border)",
            color: "var(--warning-fg)",
          }}
        >
          <span>{runError || reportError}</span>
          <button
            type="button"
            onClick={() => {
              setRunError(null);
              setReportError(null);
            }}
            className="shrink-0 font-semibold hover:opacity-70"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {charts.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-10 px-6 space-y-6">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--text-main)]">What do you want to explore?</p>
            <p className="mt-1 text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              Start with a suggested chart below, or click &quot;+ Add Chart&quot; to build your own.
            </p>
          </div>

          {/* Suggested charts */}
          {suggestions.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)] mb-2">
                Suggested for your data
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => addFromSuggestion(s)}
                    className="group rounded-[var(--radius-md)] border border-[var(--border)] bg-[color:var(--bg-panel)] p-4 text-left transition-all duration-150 hover:border-[var(--focus-ring)] hover:shadow-[var(--shadow-2)]"
                  >
                    <p className="text-sm font-semibold text-[var(--text-main)] transition-colors duration-150 group-hover:text-[var(--link)]">
                      {s.label}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                      {s.description}
                    </p>
                    <p className="mt-2 text-xs font-medium" style={{ color: "var(--link)" }}>
                      {CHART_META[s.config.chart_type].label} →
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={addBlankChart}
              className="rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)] text-sm px-4 py-2 transition-colors"
            >
              + Start from scratch
            </button>
          </div>

          {/* Field summary */}
          <div className="flex flex-wrap justify-center gap-2 pt-2 border-t border-[var(--border)]">
            {numCols.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "var(--focus-ring)" }} />
                {numCols.length} number field{numCols.length > 1 ? "s" : ""}
              </span>
            )}
            {catCols.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "var(--text-muted)" }} />
                {catCols.length} category field{catCols.length > 1 ? "s" : ""}
              </span>
            )}
            {dateCols.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "var(--score-good)" }} />
                {dateCols.length} date field{dateCols.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Chart cards ── */}
      <div className="space-y-5">
        {charts.map((cfg) => (
          <ChartCard
            key={cfg.id}
            cfg={cfg}
            cols={cols}
            renderedFig={rendered[cfg.id] ?? null}
            isRunning={runningIds.has(cfg.id)}
            onUpdate={(patch) => updateChart(cfg.id, patch)}
            onRemove={() => removeChart(cfg.id)}
            onGenerate={() => generateCharts([cfg.id])}
            plotLayout={plotLayout}
            fileId={fileId}
            token={token}
          />
        ))}
      </div>

      {/* ── Field legend (shown when charts exist) ── */}
      {charts.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] px-4 py-3">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
            Fields in this file
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
            {numCols.length > 0 && (
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "var(--focus-ring)" }} />
                Number fields ({numCols.length}) - use for values, Y axis, distribution charts
              </span>
            )}
            {catCols.length > 0 && (
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "var(--text-muted)" }} />
                Category fields ({catCols.length}) - use for grouping, X axis, pie slices
              </span>
            )}
            {dateCols.length > 0 && (
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "var(--score-good)" }} />
                Date fields ({dateCols.length}) - use on the X axis of line charts for trends
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
