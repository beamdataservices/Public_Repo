"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";

// Plotly needs to run only on the client (no SSR)
import Plot from "@/components/PlotNoTypes";


type InsightsResponse = {
  kpis: Record<string, any>;
  charts: Record<string, any>;
  filters: Record<string, string[]>;
};

type FiltersState = Record<string, string | null>;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function FileInsightsPage() {
  const params = useParams<{ id: string }>();
  const fileId = params.id;
  const { tokens } = useAuth();

  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [filtersState, setFiltersState] = useState<FiltersState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasToken = !!tokens?.accessToken;

  const fetchInsights = useCallback(async () => {
    if (!hasToken || !fileId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_BASE_URL}/api/files/${fileId}/insights`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens!.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filters: filtersState }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load insights (${res.status}): ${
            text || res.statusText
          }`
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
  }, [hasToken, fileId, filtersState, tokens]);

  // Load insights on mount + whenever filters change
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // ---------- RENDER STATES ----------

  if (!hasToken) {
    return (
      <div className="px-6 py-6 text-sm text-red-400">
        You must be authenticated to view file insights.
      </div>
    );
  }

  if (loading && !insights) {
    return (
      <div className="px-6 py-6 text-sm text-slate-400">
        Loading insights…
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div className="px-6 py-6 text-sm text-red-400">
        {error || "Unable to load insights."}
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="px-6 py-6 text-sm text-slate-400">
        No insights available for this file.
      </div>
    );
  }

  const { kpis, charts, filters } = insights;

  // ---------- HELPERS ----------

  const handleFilterChange = (key: string, value: string) => {
    setFiltersState((prev) => ({
      ...prev,
      [key]: value || null,
    }));
  };

  const anyFilters = Object.keys(filters || {}).length > 0;

  // ---------- MAIN RENDER ----------

  return (
    <div className="px-6 py-6 space-y-10">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            File Insights
          </h1>
          <p className="mt-1 text-xs font-mono text-slate-400">
            File ID: <span className="text-cyan-300">{fileId}</span>
          </p>
        </div>

        <button
          onClick={fetchInsights}
          disabled={loading}
          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {/* KPI CARDS */}
      {kpis && Object.keys(kpis).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">
            Key Metrics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(kpis).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-cyan-300">
                  {typeof value === "number" ? value.toLocaleString() : value}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILTERS */}
      {anyFilters && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Filters</h2>
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setFiltersState({})}
            >
              Clear all
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(filters).map(([column, values]) => (
              <div key={column} className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {column}
                </label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  value={filtersState[column] ?? ""}
                  onChange={(e) =>
                    handleFilterChange(column, e.target.value || "")
                  }
                >
                  <option value="">All</option>
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ERROR BANNER (non-blocking) */}
      {error && (
        <div className="rounded-md border border-red-700 bg-red-900/20 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* CHARTS */}
      {charts && Object.keys(charts).length > 0 ? (
        <section className="space-y-6">
          {Object.entries(charts).map(([name, fig]: [string, any]) => (
            <div
              key={name}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <h2 className="mb-3 text-sm font-semibold text-slate-200">
                {name.replace(/_/g, " ")}
              </h2>

              <div className="h-[320px] w-full">
                <Plot
                  data={fig.data || []}
                  layout={{
                    ...(fig.layout || {}),
                    autosize: true,
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#e2e8f0" },
                    margin: { l: 40, r: 20, t: 40, b: 40, ...(fig.layout?.margin || {}) },
                  }}
                  config={{
                    responsive: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: [
                      "toImage",
                      "lasso2d",
                      "select2d",
                    ],
                  }}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
          No charts available for this file.
        </section>
      )}
    </div>
  );
}
