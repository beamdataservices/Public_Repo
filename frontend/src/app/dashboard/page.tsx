"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AuthGuard>
      <div className="px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-main)]">
            Tenant Dashboard
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Tenant ID:{" "}
            <span className="font-mono text-xs text-cyan-300">
              {user?.tenant_id ?? "—"}
            </span>
          </p>
        </div>

        {/* Placeholder */}
        <div className="rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-6 text-[var(--text-muted)]">
          Select a file from the sidebar to view insights.
        </div>
      </div>
    </AuthGuard>
  );
}
