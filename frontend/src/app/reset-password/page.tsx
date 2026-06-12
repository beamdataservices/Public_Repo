"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    const res = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const body = await res.json() as { detail: string };
    setMessage(body.detail);
  }

  return <div className="card w-full max-w-md p-8 animate-fade-up" style={{ boxShadow: "var(--shadow-2)" }}><h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>{message && <p className="mt-4 rounded-[var(--radius-sm)] border p-3 text-sm" role="status" style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}>{message}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="New password" aria-label="New password" /><input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" placeholder="Confirm password" aria-label="Confirm new password" /><button className="btn btn-primary w-full">Update password</button></form><Link href="/login" className="mt-4 block text-center text-xs font-medium hover:underline" style={{ color: "var(--link)" }}>Back to sign in</Link></div>;
}

export default function ResetPasswordPage() { return <main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]"><Suspense fallback={<p className="text-sm text-[var(--text-muted)] animate-pulse">Loading...</p>}><ResetPasswordForm /></Suspense></main>; }
