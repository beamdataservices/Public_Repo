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
      } bg-[color:var(--bg-panel)] border-r border-[var(--border)] transition-all duration-300 flex flex-col`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-2 border-b border-[var(--border)]"
      >
        {open ? "<<<" : ">>>"}
      </button>

      {/* Sidebar Content (hidden when collapsed) */}
      {open && <SidebarContent />}
    </aside>
  );
}
