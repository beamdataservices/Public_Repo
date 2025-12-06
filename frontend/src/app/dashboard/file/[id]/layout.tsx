// src/app/dashboard/file/[id]/layout.tsx
"use client";

import React from "react";

export default function FileInsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-full h-full bg-slate-950 text-slate-100 overflow-hidden">

      {/* Top Header Section */}
      <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-cyan-300">
          BEAM Insight Dashboard
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Automated analytics & visualizations from your uploaded dataset
        </p>
      </div>

      {/* Main Content Row */}
      <div className="flex flex-row flex-1 overflow-hidden">

        {/* Left Sidebar Placeholder (Filters etc.) */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-slate-900/40 backdrop-blur p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Filters & Controls
          </h2>

          <p className="text-xs text-slate-500">
            (Dynamic filter components will be placed here soon.)
          </p>
        </aside>

        {/* Main Insights Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>

    </div>
  );
}
