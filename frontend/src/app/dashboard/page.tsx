"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
        
        <TopNav />

        <main className="flex-1 px-6 py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold">Tenant Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">
              Tenant ID:{" "}
              <span className="font-mono text-xs text-cyan-300">
                {user?.tenant_id}
              </span>
            </p>
          </div>

          {/* Placeholder message */}
          <div className="text-slate-500">
            Select a file from the sidebar to view insights.
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
