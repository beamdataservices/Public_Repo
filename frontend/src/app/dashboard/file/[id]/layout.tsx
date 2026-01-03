"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export default function InsightsLayout({
  children,
  rightPanel,
}: {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  const [showRightPanel, setShowRightPanel] = useState(true);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-main)", color: "var(--text-main)" }}>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>

      <div
        className={cn("transition-all duration-300 border-l", showRightPanel ? "w-80" : "w-10")}
        style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setShowRightPanel(!showRightPanel)}
          className="w-full py-2 text-xs"
          style={{ background: "var(--bg-panel-2)", borderBottom: "1px solid var(--border)" }}
          type="button"
        >
          {showRightPanel ? ">>>" : "<<<"}
        </button>

        {showRightPanel && <div className="p-4">{rightPanel}</div>}
      </div>
    </div>
  );
}
