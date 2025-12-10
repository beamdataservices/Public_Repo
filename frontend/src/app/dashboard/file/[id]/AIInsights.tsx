"use client";

import React from "react";
import { useState } from "react";
import { marked } from "marked";

type AIInsightsProps = {
  fileId: string;
  initialSummary: string | null;
  token: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AIInsights({
  fileId,
  initialSummary,
  token,
}: AIInsightsProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/ai-summary`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to regenerate AI summary");
      }

      const data = await res.json();
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Error generating summary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-[#0E152A] p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-cyan-300">
          AI-Generated Dataset Summary
        </h2>
        <button
          onClick={regenerate}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 border border-red-700 bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}

      {/* Summary Content */}
      <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-300">
        {loading && !summary && (
          <p className="text-slate-500 animate-pulse">Generating insights…</p>
        )}

        {!loading && summary && (
          <div
            dangerouslySetInnerHTML={{
              __html: marked(summary || ""),
            }}
          />
        )}

        {!loading && !summary && !error && (
          <p className="text-slate-500">No AI summary available.</p>
        )}
      </div>
    </section>
  );
}
