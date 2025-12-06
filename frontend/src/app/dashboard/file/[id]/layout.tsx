"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

// Components
import SidebarFiles from "@/components/dashboard/SidebarFiles";
import PresetFilterSidebar from "./PresetFilterSidebar";

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // Sidebar visibility states
  const [showFileSidebar, setShowFileSidebar] = useState(true);
  const [showPresetFilters, setShowPresetFilters] = useState(true);

  // Required for SidebarFiles
  const [reloadFlag, setReloadFlag] = useState(0);

  return (
    <div className="flex min-h-screen bg-[#0A0F1D] text-slate-100">

      {/* ---------------------------------- */}
      {/* FILE SIDEBAR (left-most panel)      */}
      {/* ---------------------------------- */}
      <div
        className={cn(
          "transition-all duration-300 border-r border-slate-800 bg-[#0D1324]",
          showFileSidebar ? "w-60" : "w-8"
        )}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setShowFileSidebar(!showFileSidebar)}
          className="w-full py-2 text-xs bg-slate-900 hover:bg-slate-800"
        >
          {showFileSidebar ? "<<<" : ">>>"}
        </button>

        {showFileSidebar && (
          <div className="p-2">
            {/* 🔥 FIX: SidebarFiles now receives required prop */}
            <SidebarFiles reloadFlag={reloadFlag} />
          </div>
        )}
      </div>

      {/* ---------------------------------- */}
      {/* PRESET FILTER SIDEBAR               */}
      {/* ---------------------------------- */}
      <div
        className={cn(
          "transition-all duration-300 border-r border-slate-800 bg-[#0B1221]",
          showPresetFilters ? "w-64" : "w-8"
        )}
      >
        {/* Toggle Button */}
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

      {/* ---------------------------------- */}
      {/* MAIN PAGE CONTENT                   */}
      {/* ---------------------------------- */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
