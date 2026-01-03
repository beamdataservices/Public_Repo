"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import PresetFilterSidebar from "./PresetFilterSidebar";

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showPresetFilters, setShowPresetFilters] = useState(true);

  return (
    <div className="flex min-h-screen bg-[#0A0F1D] text-slate-100">

      {/* RIGHT SIDE — PRESET FILTER SIDEBAR */}
      <div
        className={cn(
          "transition-all duration-300 border-r border-slate-800 bg-[#0B1221]",
          showPresetFilters ? "w-64" : "w-8"
        )}
      >
        <button
          onClick={() => setShowPresetFilters(!showPresetFilters)}
          className="w-full py-2 text-xs bg-slate-900 hover:bg-slate-800"
        >
          {showPresetFilters ? "<<<" : ">>>"} 
        </button>

        {showPresetFilters && (
          <div className="p-4 text-sm">
            <PresetFilterSidebar />
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
