"use client";

import React, { useState } from "react";

interface AIInsightsProps {
  fileId: string;
  initialSummary: string | null;
  token: string;
}

export default function AIInsights({ fileId, initialSummary, token }: AIInsightsProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [loading, setLoading] = useState(false);

  const regenerate = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/files/${fileId}/ai-summary`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        }
      );

      if (!res.ok) {
        throw new Error("AI summary request failed");
      }

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("AI summary error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">AI Insights</h2>

        <button
          onClick={regenerate}
          disabled={loading}
          className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Generating…" : "Regenerate"}
        </button>
      </div>

      <div className="text-sm text-slate-300 whitespace-pre-wrap">
        {summary ?? "No AI summary available yet."}
      </div>
    </div>
  );
}
