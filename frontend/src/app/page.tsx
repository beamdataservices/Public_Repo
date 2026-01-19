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
    <main className="flex min-h-screen items-center justify-center bg-(--bg-main)">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--text-main)">
          BEAM Analytics
        </h1>

        <p className="mt-2 text-(--text-muted)">
          Redirecting you to your experience...
        </p>

        <p className="mt-4 text-xs text-(--text-muted)">
          If nothing happens, click{" "}
          <a href="/login" className="text-(--accent) underline">
            here
          </a>
          .
        </p>
      </div>
    </main>
  );
}
