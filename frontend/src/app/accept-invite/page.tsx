"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type InvitePreview = {
  email: string;
  account_name: string;
  existing_user: boolean;
};

function AcceptInviteForm() {
  const token = useSearchParams().get("token") ?? "";
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/auth/invitations/preview?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null) as InvitePreview | { detail?: string } | null;
        if (!res.ok) throw new Error((body as { detail?: string } | null)?.detail ?? "Could not load invitation.");
        setPreview(body as InvitePreview);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load invitation."));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) return setError("This invitation link is incomplete.");
    if (!preview?.existing_user && password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const endpoint = preview?.existing_user ? "accept-existing" : "accept";
      const res = await fetch(`${API_BASE_URL}/auth/invitations/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? "Could not accept invitation.");
      }
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invitation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold text-[var(--text-main)]">Join BEAM Analytics</h1>
        {complete ? (
          <>
            <p className="mb-6 text-sm text-[var(--text-muted)]">Invitation accepted. Sign in and choose {preview?.account_name ?? "the new account"}.</p>
            <Link href="/login" className="block w-full rounded-md bg-cyan-500 px-3 py-2 text-center text-sm font-semibold text-[var(--dark-text)] hover:bg-cyan-400">Go to sign in</Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              {preview ? `You were invited to ${preview.account_name}.` : "Loading invitation..."}
            </p>
            {error && <div className="mb-4 rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              {preview?.existing_user && <p className="rounded-md border border-[var(--border)] p-3 text-xs text-[var(--text-muted)]">This email already has a BEAM login. Enter the password for {preview.email} to accept this invitation.</p>}
              <label className="block">
                <span className="mb-1 block text-sm text-[var(--text-main)]">{preview?.existing_user ? "Existing password" : "Password"}</span>
                <input type="password" required minLength={preview?.existing_user ? undefined : 8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
              </label>
              {!preview?.existing_user && (
                <label className="block">
                  <span className="mb-1 block text-sm text-[var(--text-main)]">Confirm password</span>
                  <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
                </label>
              )}
              <button type="submit" disabled={loading || !preview} className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-[var(--dark-text)] hover:bg-cyan-400 disabled:opacity-60">
                {loading ? "Accepting..." : preview?.existing_user ? "Sign in and accept" : "Create account"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] text-sm text-[var(--text-muted)]">Loading invitation...</main>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
