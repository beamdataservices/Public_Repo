"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Plot from "@/components/PlotNoTypes";
import FilterPanel from "./FilterPanel";
import AIWidget from "./AIWidget";

type InsightsResponse = {
  kpis: Record<string, any>;
  charts: Record<string, any>;
  filters: Record<string, string[]>;
  ai_summary?: string | null;
};

type FiltersState = Record<string, string | null>;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function FileInsightsPage() {
  const params = useParams<{ id: string }>();
  const fileId = params.id;
  const { tokens } = useAuth();
  const { theme } = useTheme();

  const [insights, setInsights] = useState<InsightsResponse | null>(null);

  // Applied filters (sent to backend)
  const [filtersState, setFiltersState] = useState<FiltersState>({});

  // Pending filters (UI selections)
  const [pendingFilters, setPendingFilters] = useState<FiltersState>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasToken = !!tokens?.accessToken;

  const plotTheme = useMemo(() => {
    if (typeof document === "undefined") {
      return {
        fontColor: "#e2e8f0",
        gridColor: "rgba(226, 232, 240, 0.12)",
      };
    }

    const styles = getComputedStyle(document.documentElement);
    const textMain =
      styles.getPropertyValue("--text-main").trim() || "#e2e8f0";
    const gridColor =
      theme === "dark"
        ? "rgba(226, 232, 240, 0.12)"
        : "rgba(15, 23, 42, 0.12)";

    return { fontColor: textMain, gridColor };
  }, [theme]);

  // -----------------------------------------------------
  // Fetch Insights with explicit filters (used for presets)
  // -----------------------------------------------------
  const fetchInsightsWithFilters = useCallback(
    async (nextFilters: FiltersState) => {
      if (!hasToken || !fileId) return;

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/insights`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens!.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filters: nextFilters }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Failed to load insights (${res.status}): ${text || res.statusText}`
          );
        }

        const data = (await res.json()) as InsightsResponse;
        setInsights(data);
      } catch (err: any) {
        console.error("Insights error:", err);
        setError(err.message || "Failed to load insights");
      } finally {
        setLoading(false);
      }
    },
    [hasToken, fileId, tokens]
  );

  // -----------------------------------------------------
  // Fetch Insights using current applied filters
  // -----------------------------------------------------
  const fetchInsights = useCallback(async () => {
    await fetchInsightsWithFilters(filtersState);
  }, [fetchInsightsWithFilters, filtersState]);

  // Initial fetch + whenever applied filters change
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // -----------------------------------------------------
  // Debounce pending filters -> applied filters
  // (prevents spamming backend on every dropdown change)
  // -----------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltersState(pendingFilters);
    }, 500);

    return () => clearTimeout(t);
  }, [pendingFilters]);

  // -----------------------------------------------------
  // Render Checks
  // -----------------------------------------------------
  if (!hasToken) {
    return (
      <div className="px-6 py-6 text-sm text-red-400">
        You must be authenticated to view file insights.
      </div>
    );
  }

  if (loading && !insights) {
    return (
      <div className="px-6 py-6 text-sm text-[var(--text-muted)]">
        Loading insights…
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div className="px-6 py-6 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="px-6 py-6 text-sm text-[var(--text-muted)]">No insights available.</div>
    );
  }

  const { kpis, charts, filters } = insights;
  const anyFilters = Object.keys(filters || {}).length > 0;

  const handleFilterChange = (key: string, value: string | null) => {
    setPendingFilters((prev) => ({
      ...prev,
      [key]: value === "" ? null : value,
    }));
  };

  const clearAll = () => {
    setPendingFilters({});
    setFiltersState({});
    // Optional immediate refresh on clear:
    fetchInsightsWithFilters({});
  };

  // -----------------------------------------------------
  // Presets (stub logic now, real logic later)
  // -----------------------------------------------------
  const applyPreset = (preset: string) => {
    // NOTE: For now we don't know the dataset schema, so presets are placeholders.
    // Later we can:
    // - map presets to real filter selections
    // - or send preset name to backend (recommended long-term)

    const nextFilters: FiltersState = { ...pendingFilters };

    // Placeholder behavior: just log and force refresh using current filters
    // You can replace these with real mappings once you define them.
    if (preset === "missing_data") {
      // Example: no-op until we implement backend preset logic
    } else if (preset === "outliers") {
      // no-op
    } else if (preset === "high_value") {
      // no-op
    }

    // Keep UI consistent
    setPendingFilters(nextFilters);

    // IMMEDIATE APPLY: bypass debounce
    setFiltersState(nextFilters);
    fetchInsightsWithFilters(nextFilters);
  };

  // -----------------------------------------------------
  // MAIN UI
  // -----------------------------------------------------
  return (
    <div className="flex w-full min-h-screen">
      {/* LEFT FILTER PANEL */}
      {anyFilters && (
        <aside className="hidden lg:flex flex-col w-64 border-r border-[var(--border)] bg-[color:var(--bg-panel)] p-4 overflow-y-auto">
          <FilterPanel
            filters={filters}
            selected={pendingFilters}
            onChange={handleFilterChange}
            onClear={clearAll}
            onApply={() => {
              setFiltersState(pendingFilters);
              fetchInsightsWithFilters(pendingFilters);
            }}
            onApplyPreset={(preset) => {
              console.log("Preset Clicked:", preset);
              applyPreset(preset);
            }}
          />
        </aside>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-main)]">File Insights</h1>
            <p className="mt-1 text-xs font-mono text-[var(--text-muted)]">
              File ID: <span className="text-cyan-300">{fileId}</span>
            </p>
          </div>

          <button
            onClick={fetchInsights}
            disabled={loading}
            className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-main)] hover:bg-[color:var(--bg-panel-2)] disabled:opacity-60"
            type="button"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {/* KPI Cards */}
        {kpis && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-main)]">Key Metrics</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(kpis).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-4"
                >
                  <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-cyan-300">{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Error Banner */}
        {error && (
          <div className="rounded-md border border-red-700 bg-red-900/20 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Charts */}
        {charts && Object.keys(charts).length > 0 && (
          <section className="space-y-6">
            {Object.entries(charts).map(([name, fig]) => (
              <div
                key={name}
                className="rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-5"
              >
                <h2 className="mb-3 text-sm font-semibold text-[var(--text-main)]">
                  {name.replace(/_/g, " ")}
                </h2>

                <div className="h-[320px] w-full">
                  <Plot
                    data={fig.data}
                    layout={{
                      ...(fig.layout || {}),
                      autosize: true,
                      paper_bgcolor: "rgba(0,0,0,0)",
                      plot_bgcolor: "rgba(0,0,0,0)",
                      font: {
                        ...(fig.layout?.font || {}),
                        color: plotTheme.fontColor,
                      },
                      xaxis: {
                        ...(fig.layout?.xaxis || {}),
                        gridcolor: plotTheme.gridColor,
                        zerolinecolor: plotTheme.gridColor,
                      },
                      yaxis: {
                        ...(fig.layout?.yaxis || {}),
                        gridcolor: plotTheme.gridColor,
                        zerolinecolor: plotTheme.gridColor,
                      },
                    }}
                    config={{
                      responsive: true,
                      displaylogo: false,
                      modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"],
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              </div>
            ))}
          </section>
        )}

        {/* AI Insights Panel */}
        <AIWidget
          fileId={fileId}
          initialSummary={(insights as any).ai_summary ?? null}
          token={tokens!.accessToken ?? ""}
        />
      </main>
    </div>
  );
}
