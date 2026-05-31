"use client";

import React from "react";

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-main)", color: "var(--text-main)" }}>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>

      {/* Temporarily hidden until the right-side tools are needed again.
      <div
        className={`${showRightPanel ? "w-80" : "w-10"} bg-[color:var(--bg-panel)] border-l border-[var(--border)] transition-all duration-300 flex flex-col`}
        style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setShowRightPanel(!showRightPanel)}
          className="flex h-10 w-full items-center justify-center border-b border-[var(--border)] text-sm font-semibold tracking-wide text-[var(--text-muted)] hover:text-[var(--text-main)]"
          type="button"
        >
          {showRightPanel ? "Collapse →" : "←"}
        </button>

        {showRightPanel && <div className="p-4">{rightPanel}</div>}
      </div>
      */}
    </div>
  );
}
