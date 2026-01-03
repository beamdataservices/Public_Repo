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
      >
        AI
      </button>

      {/* Slide-up Panel */}
      <div
        className={`fixed right-6 bottom-24 w-96 max-h-[60vh] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden transition-all duration-300 ${
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <AIInsights 
          fileId={fileId}
          initialSummary={initialSummary}
          token={token}
        />
      </div>
    </>
  );
}
