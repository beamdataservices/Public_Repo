"use client";

import React, { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopNav from "@/components/TopNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-main)", color: "var(--text-main)" }}>
      {/* Full-width header */}
      <TopNav />

      {/* Row: sidebar + main */}
      <div className="flex flex-1 min-w-0">
        <Sidebar open={open} setOpen={setOpen} />

        <main className="flex-1 overflow-y-auto transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
