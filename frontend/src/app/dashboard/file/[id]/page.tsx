"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import Plot from "react-plotly.js";

type InsightsResponse = {
  kpis: Record<string, any>;
  charts: Record<string, any>;
  filters: {
    gender?: string[];
    workout_type?: string[];
    experience_level?: string[];
  };
};

export default function FileInsightsPage() {
  const { id } = useParams<{ id: string }>();
  const { tokens } = useAuth();

  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState<Record<string, any>>({});

  async function fetchInsights() {
    if (!tokens?.accessToken) return;

    setLoading(true);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/files/${id}/insights/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filters: filterState }),
      }
    );

    const data = await res.json();
    setInsights(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchInsights();
  }, [tokens?.accessToken, filterState]);

  if (loading || !insights) {
    return (
      <div className="text-slate-400 p-6">
        Loading insights…
      </div>
    );
  }

  const { kpis, charts, filters } = insights;

  return (
    <div className="px-6 py-6 space-y-10">

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {Object.entries(kpis).map(([key, val]) => (
          <div
            key={key}
            className="rounded-xl bg-slate-900/60 border border-slate-800 p-5"
          >
            <p className="text-sm text-slate-400">{key}</p>
            <p className="text-2xl font-semibold text-cyan-300">{val}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
        <h2 className="text-lg font-semibold">Filters</h2>

        {filters.gender && (
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2"
            onChange={(e) =>
              setFilterState({
                ...filterState,
                gender: e.target.value || null,
              })
            }
          >
            <option value="">All Genders</option>
            {filters.gender.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        )}

        {filters.workout_type && (
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2"
            onChange={(e) =>
              setFilterState({
                ...filterState,
                workout_type: e.target.value || null,
              })
            }
          >
            <option value="">All Workout Types</option>
            {filters.workout_type.map((wt) => (
              <option key={wt} value={wt}>{wt}</option>
            ))}
          </select>
        )}

        {filters.experience_level && (
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2"
            onChange={(e) =>
              setFilterState({
                ...filterState,
                experience_level: e.target.value || null,
              })
            }
          >
            <option value="">All Experience Levels</option>
            {filters.experience_level.map((el) => (
              <option key={el} value={el}>{el}</option>
            ))}
          </select>
        )}
      </div>

      {/* CHARTS */}
      {Object.entries(charts).map(([name, plotData]) => (
        <section
          key={name}
          className="rounded-xl bg-slate-900/60 border border-slate-800 p-6"
        >
          <h2 className="text-lg font-semibold mb-4 capitalize">{name}</h2>

          <Plot
            data={plotData.data}
            layout={{
              ...plotData.layout,
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#e2e8f0" },
            }}
            config={{ responsive: true }}
            style={{ width: "100%", height: "100%" }}
          />
        </section>
      ))}

    </div>
  );
}
