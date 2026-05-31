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

  return <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-8"><h1 className="text-2xl font-semibold">Choose a new password</h1>{message && <p className="mt-4 rounded-md border border-cyan-500/30 p-3 text-sm">{message}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-sm" placeholder="New password" /><input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-sm" placeholder="Confirm password" /><button className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-[var(--dark-text)]">Update password</button></form><Link href="/login" className="mt-4 block text-center text-xs text-cyan-300 hover:underline">Back to sign in</Link></div>;
}

export default function ResetPasswordPage() { return <main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]"><Suspense fallback={<p>Loading...</p>}><ResetPasswordForm /></Suspense></main>; }
