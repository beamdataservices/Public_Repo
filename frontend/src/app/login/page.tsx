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
    } catch (err: any) {
      setError(err?.message || "Login failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold text-white">Sign in</h1>
        <p className="mb-6 text-sm text-slate-400">
          Welcome back to BEAM Analytics.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="mb-1 block text-sm text-slate-200">
              Email address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-sm text-slate-200">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Register link */}
        <p className="mt-4 text-center text-xs text-slate-400">
          Don't have an account?{" "}
          <Link href="/register" className="text-cyan-300 hover:underline">
            Create your account
          </Link>
        </p>
      </div>
    </main>
  );
}
