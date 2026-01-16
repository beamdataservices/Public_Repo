"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If not loading AND no user, redirect to login
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || (!user && typeof window !== "undefined")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">
        Checking authentication...
      </div>
    );
  }

  return <>{children}</>;
}
