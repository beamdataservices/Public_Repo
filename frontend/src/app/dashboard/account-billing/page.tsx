"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

type Limits = {
  plan: "demo" | "premium";
  plan_label: string;
  subscription_status: string;
  files: {
    lifetime_uploads: number;
    lifetime_upload_limit: number | null;
    lifetime_mb: number;
    lifetime_mb_limit: number | null;
    per_file_mb_limit: number;
  };
  users: {
    used: number;
    extra_user_limit: number | null;
    active_extra_users: number;
    pending_invites: number;
  };
  ai: {
    premium_monthly_included: boolean;
    period_status?: string;
    demo_user_spend?: number;
    demo_user_limit?: number;
    demo_remaining?: number;
  };
};

type BillingAccount = {
  account_name: string;
  plan: "demo" | "premium";
  plan_label: string;
  subscription_status: string;
  billing_email: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_customer: boolean;
  limits: Limits;
};

export default function AccountBillingPage() {
  const { user, tokens } = useAuth();
  const [billing, setBilling] = useState<BillingAccount | null>(null);
  const [billingEmail, setBillingEmail] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(() => {
    return STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;
  }, []);

  const loadBilling = useCallback(async () => {
    if (!tokens.accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/account`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail || "Could not load account billing.");
      }
      const data = await res.json() as BillingAccount;
      setBilling(data);
      setBillingEmail(data.billing_email || user?.email || "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load account billing.");
    } finally {
      setLoading(false);
    }
  }, [tokens.accessToken, user?.email]);

  useEffect(() => {
    if (!tokens.accessToken) return;
    void loadBilling();
    if (typeof window !== "undefined" && window.location.search.includes("checkout=complete")) {
      setMessage("Thanks. Stripe is confirming your subscription, and this page will update shortly.");
      const timer = window.setTimeout(() => void loadBilling(), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [loadBilling, tokens.accessToken]);

  async function startCheckout() {
    if (!tokens.accessToken) return;
    if (!STRIPE_PUBLISHABLE_KEY) {
      setError("Stripe publishable key is missing. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to the frontend environment.");
      return;
    }
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/checkout-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ billing_email: billingEmail || user?.email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail || "Could not start Stripe Checkout.");
      }
      const data = await res.json() as { client_secret: string };
      setClientSecret(data.client_secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Stripe Checkout.");
    } finally {
      setWorking(false);
    }
  }

  async function openPortal() {
    if (!tokens.accessToken) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/portal-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail || "Could not open the billing portal.");
      }
      const data = await res.json() as { url: string };
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the billing portal.");
      setWorking(false);
    }
  }

  const isOwner = user?.role === "owner" || user?.role === "admin";

  return (
    <AuthGuard>
      <div className="mx-auto max-w-5xl space-y-5 px-6 py-6 text-[var(--text-main)]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Account Billing</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Review your plan, limits, and subscription for this account.</p>
          </div>
          <Link href="/dashboard/settings" className="btn btn-secondary btn-sm">Back to Settings</Link>
        </header>

        {!isOwner && <Notice kind="error">Only account owners can view billing details.</Notice>}
        {message && <Notice kind="info">{message}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}

        {isOwner && loading && <div className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-5">Loading billing...</div>}

        {isOwner && billing && !loading && (
          <>
            <section className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-[var(--text-muted)]">{billing.account_name}</div>
                  <h2 className="mt-1 text-3xl font-bold">{billing.plan_label}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {billing.plan === "premium"
                      ? "Premium is active for this account."
                      : "Demo includes limited lifetime uploads, one extra user, and starter AI usage."}
                  </p>
                </div>
                <div className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                  {billing.subscription_status || "none"}
                </div>
              </div>
              {billing.current_period_end && (
                <p className="mt-4 text-sm text-[var(--text-muted)]">
                  Current billing period ends {new Date(billing.current_period_end).toLocaleDateString()}.
                  {billing.cancel_at_period_end ? " Cancellation is scheduled at period end." : ""}
                </p>
              )}
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <UsageCard title="File Uploads" value={formatLimit(billing.limits.files.lifetime_uploads, billing.limits.files.lifetime_upload_limit)} detail={`Lifetime total: ${billing.limits.files.lifetime_mb} MB${billing.limits.files.lifetime_mb_limit ? ` of ${billing.limits.files.lifetime_mb_limit} MB` : ""}`} />
              <UsageCard title="Users" value={formatLimit(billing.limits.users.used, billing.limits.users.extra_user_limit)} detail={`${billing.limits.users.active_extra_users} active extra user(s), ${billing.limits.users.pending_invites} pending invite(s)`} />
              <UsageCard title="AI Access" value={billing.plan === "premium" ? "Included" : `$${(billing.limits.ai.demo_user_spend ?? 0).toFixed(4)} used`} detail={billing.plan === "premium" ? "Monthly AI credits are included with Premium." : `Demo AI remaining: $${(billing.limits.ai.demo_remaining ?? 0).toFixed(4)}`} />
            </section>

            <section className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-5">
              <h2 className="text-lg font-semibold">{billing.plan === "premium" ? "Manage Premium" : "Upgrade to Premium"}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Premium removes Demo file and user caps, keeps reasonable file-size safety limits, and includes monthly AI credits for the account.
              </p>
              <div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm">
                  <span className="field-label">Billing email</span>
                  <input value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} className="input" placeholder={user?.email} />
                </label>
                {billing.plan === "premium" ? (
                  <button type="button" onClick={() => void openPortal()} disabled={working} className="btn btn-primary">{working ? "Opening..." : "Manage Billing"}</button>
                ) : (
                  <button type="button" onClick={() => void startCheckout()} disabled={working} className="btn btn-primary">{working ? "Starting..." : "Upgrade"}</button>
                )}
              </div>
            </section>

            {clientSecret && stripePromise && (
              <section className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-4">
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </section>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}

function formatLimit(used: number, limit: number | null): string {
  return limit === null ? `${used}` : `${used} / ${limit}`;
}

function UsageCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--text-muted)]">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function Notice({ kind, children }: { kind: "info" | "error"; children: React.ReactNode }) {
  const style = kind === "error"
    ? { background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }
    : { background: "var(--bg-panel)", borderColor: "var(--border)", color: "var(--text-main)" };
  return <p className="rounded-[var(--radius-sm)] border p-3 text-sm" style={style}>{children}</p>;
}
