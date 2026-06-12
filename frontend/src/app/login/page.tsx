"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
      // login() handles redirect
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] px-4">
      <div className="card w-full max-w-md p-8" style={{ boxShadow: "var(--shadow-2)" }}>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
          Sign in
        </h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Welcome back to BEAM Analytics.
        </p>

        {error && (
          <div
            className="mb-4 rounded-[var(--radius-sm)] border px-3 py-2 text-sm"
            style={{
              background: "var(--error-bg)",
              borderColor: "var(--error-border)",
              color: "var(--error-fg)",
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          <Link
            href="/forgot-password"
            className="block text-right text-xs font-medium hover:underline"
            style={{ color: "var(--link)" }}
          >
            Forgot password?
          </Link>

          <button type="submit" disabled={loading} className="btn btn-primary mt-2 w-full">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium hover:underline"
            style={{ color: "var(--link)" }}
          >
            Create your account
          </Link>
        </p>
      </div>
    </main>
  );
}
