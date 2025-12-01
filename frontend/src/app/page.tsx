"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) router.replace("/dashboard");
      else router.replace("/login");
    }
  }, [loading, user, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-100">
          BEAM Analytics
        </h1>

        <p className="mt-2 text-slate-400">
          Redirecting you to your experience...
        </p>

        <p className="mt-4 text-xs text-slate-600">
          If nothing happens, click{" "}
          <a href="/login" className="text-cyan-300 underline">
            here
          </a>
          .
        </p>
      </div>
    </main>
  );
}
