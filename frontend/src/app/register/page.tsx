"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const { register, loading } = useAuth();

  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await register(email, password, tenantName);
      // register() handles redirect
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] px-4">
      <div className="card w-full max-w-md p-8" style={{ boxShadow: "var(--shadow-2)" }}>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
          Create your account
        </h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Set up BEAM Analytics for your company or personal workspace.
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
            <label htmlFor="tenant" className="field-label">
              Company name
              <span className="ml-1 text-xs text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              id="tenant"
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              className="input"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Leave blank to use the first part of your email as your workspace name.
            </p>
          </div>

          <div>
            <label htmlFor="email" className="field-label">
              Admin email
            </label>
            <input
              id="email"
              type="email"
              required
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary mt-2 w-full">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium hover:underline"
            style={{ color: "var(--link)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
