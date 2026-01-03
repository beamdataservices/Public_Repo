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
          <h1 className="text-2xl font-semibold text-slate-50">
            Tenant Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Tenant ID:{" "}
            <span className="font-mono text-xs text-cyan-300">
              {user?.tenant_id ?? "—"}
            </span>
          </p>
        </div>

        {/* Placeholder */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-slate-400">
          Select a file from the sidebar to view insights.
        </div>
      </div>
    </AuthGuard>
  );
}
