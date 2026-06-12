"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/password-reset/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await res.json().catch(() => null) as { detail?: string } | null;
      if (!res.ok) throw new Error(body?.detail ?? "Could not request a password reset.");
      setMessage(body?.detail ?? "If an active account matches that email, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a password reset.");
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]"><div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-8"><h1 className="text-2xl font-semibold">Reset password</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Enter your account email to request a reset link.</p>{message && <p className="mt-4 rounded-[var(--radius-sm)] border p-3 text-sm" style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}>{message}</p>}{error && <p className="mt-4 rounded-[var(--radius-sm)] border p-3 text-sm" role="alert" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }}>{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-sm" placeholder="you@example.com" /><button className="btn btn-primary w-full">Send reset link</button></form><Link href="/login" className="mt-4 block text-center text-xs font-medium hover:underline" style={{ color: "var(--link)" }}>Back to sign in</Link></div></main>;
}
