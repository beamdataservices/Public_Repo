"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SelectAccountPage() {
  const { accountSelection, loading, selectAccount, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !accountSelection) router.replace("/login");
  }, [accountSelection, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] px-4 text-[var(--text-main)]">
      <div className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Choose an account</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Select which BEAM Analytics account you want to open.</p>
        <div className="mt-6 space-y-3">
          {accountSelection?.accounts.map((account) => (
            <button
              key={account.membership_id}
              type="button"
              disabled={loading}
              onClick={() => void selectAccount(account.membership_id)}
              className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[color:var(--bg-panel-2)] px-4 py-3 text-left transition-colors duration-150 hover:border-[var(--focus-ring)] disabled:opacity-60"
            >
              <span>
                <span className="block font-semibold">{account.account_name}</span>
                <span className="text-xs capitalize text-[var(--text-muted)]">{account.role}</span>
              </span>
              <span className="text-sm" style={{ color: "var(--link)" }}>Open</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={logout} className="mt-6 text-sm font-medium hover:underline" style={{ color: "var(--link)" }}>Back to sign in</button>
      </div>
    </main>
  );
}
