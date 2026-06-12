"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type AccountLimits = {
  plan: "demo" | "premium";
  files: {
    lifetime_uploads: number;
    lifetime_upload_limit: number | null;
    lifetime_mb: number;
    lifetime_mb_limit: number | null;
  };
  users: {
    used: number;
    extra_user_limit: number | null;
  };
};

export default function DemoUpgradeBanner() {
  const { tokens, user } = useAuth();
  const [limits, setLimits] = useState<AccountLimits | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const dismissKey = useMemo(
    () => `beam_demo_banner_dismissed_${user?.active_account?.account_id ?? "unknown"}`,
    [user?.active_account?.account_id],
  );
  const dismissed = useMemo(() => {
    void dismissedVersion;
    return typeof window !== "undefined" && window.sessionStorage.getItem(dismissKey) === "1";
  }, [dismissKey, dismissedVersion]);

  useEffect(() => {
    if (!tokens.accessToken) return;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/account/limits`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data: AccountLimits | null) => {
        if (data) setLimits(data);
      })
      .catch(() => {
        // The banner is helpful, but never critical to the dashboard.
      });
    return () => controller.abort();
  }, [tokens.accessToken]);

  function dismiss() {
    if (typeof window !== "undefined") window.sessionStorage.setItem(dismissKey, "1");
    setDismissedVersion((value) => value + 1);
  }

  if (!limits || limits.plan !== "demo" || dismissed) return null;

  return (
    <section className="mb-6 rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Demo Account</div>
          <h2 className="mt-1 text-lg font-bold text-[var(--text-main)]">Unlock Premium when you are ready</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Your Demo includes {limits.files.lifetime_upload_limit} lifetime uploads, {limits.files.lifetime_mb_limit} MB total upload storage, and one extra user. Premium removes those Demo caps and keeps your account growing.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isOwner ? (
            <Link href="/dashboard/account-billing" className="btn btn-primary btn-sm">View Premium</Link>
          ) : (
            <span className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">Ask your account owner to upgrade</span>
          )}
          <button type="button" onClick={dismiss} className="btn btn-secondary btn-sm" aria-label="Dismiss Demo upgrade banner">Dismiss</button>
        </div>
      </div>
    </section>
  );
}
