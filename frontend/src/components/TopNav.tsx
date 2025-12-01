"use client";

import { useAuth } from "@/context/AuthContext";

export function TopNav() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      {/* Left side - branding */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded bg-cyan-500 flex items-center justify-center font-bold text-slate-900">
          B
        </div>
        <div>
          <div className="font-semibold text-slate-100">BEAM Analytics</div>
          <div className="text-xs text-slate-400">
            Multi-tenant ingest & insights
          </div>
        </div>
      </div>

      {/* Right side - user info + logout */}
      <div className="flex items-center gap-4 text-sm">
        {user && (
          <>
            <div className="text-right">
              <div className="font-medium text-slate-100">{user.email}</div>
              <div className="text-xs text-cyan-300">{user.role}</div>
            </div>

            <button
              onClick={logout}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
