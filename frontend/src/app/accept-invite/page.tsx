"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This invitation link is incomplete.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? "Could not create account.");
      }
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
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
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Your account is ready. You can now sign in.
            </p>
            <Link href="/login" className="block w-full rounded-md bg-cyan-500 px-3 py-2 text-center text-sm font-semibold text-[var(--dark-text)] hover:bg-cyan-400">
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Choose a password to finish creating your account.
            </p>
            {error && (
              <div className="mb-4 rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-[var(--text-main)]">Password</span>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-[var(--text-main)]">Confirm password</span>
                <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
              </label>
              <button type="submit" disabled={loading} className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-[var(--dark-text)] hover:bg-cyan-400 disabled:opacity-60">
                {loading ? "Creating account..." : "Create account"}
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
