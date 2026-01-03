"use client";

import React, { useState } from "react";
import AIInsights from "./AIInsights";

export default function AIWidget({
  fileId,
  initialSummary,
  token,
}: {
  fileId: string;
  initialSummary: string | null;
  token: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating AI Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-full w-16 h-16 shadow-xl transition-transform"
        type="button"
      >
        AI
      </button>

      {/* Slide-up Panel */}
      <div
        className={`fixed right-6 bottom-24 w-96 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden transition-all duration-300 ${
          open
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6 pointer-events-none"
        }`}
        style={{
          // makes it feel like it "fits" content but never grows beyond viewport
          maxHeight: "70vh",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
          <div className="text-sm font-semibold text-slate-200">AI Insights</div>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-200 text-xs"
            type="button"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <AIInsights fileId={fileId} initialSummary={initialSummary} token={token} />
        </div>
      </div>
    </>
  );
}
