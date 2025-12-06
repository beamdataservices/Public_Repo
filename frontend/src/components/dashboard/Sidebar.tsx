"use client";

import React from "react";
import SidebarContent from "./SidebarContent";

export default function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  return (
    <aside
      className={`${
        open ? "w-80" : "w-10"
      } bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-slate-200 p-2 border-b border-slate-800"
      >
        {open ? "<<<" : ">>>"}
      </button>

      {/* Sidebar Content (hidden when collapsed) */}
      {open && <SidebarContent />}
    </aside>
  );
}
