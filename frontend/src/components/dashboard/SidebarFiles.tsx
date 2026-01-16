"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type FileSummary = {
  id: string;
  original_name: string;
  uploaded_at: string;
  status: string;
  size_bytes: number | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function SidebarFiles({ reloadFlag }: { reloadFlag: number }) {
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pathname = usePathname();
  const { tokens } = useAuth();

  async function loadFiles() {
    if (!tokens?.accessToken) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 🔥 TRAILING SLASH REQUIRED FOR AZURE ACA
      const res = await fetch(`${API_BASE_URL}/api/files/`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load files: ${res.status}`);
      }

      const data = (await res.json()) as FileSummary[];
      setFiles(data);
    } catch (err: any) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, [tokens?.accessToken, reloadFlag]); // 🔥 reload on upload

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          Files
        </span>
      </div>

      {loading && (
        <div className="px-4 py-2 text-xs text-[var(--text-muted)]">Loading files…</div>
      )}

      {error && !loading && (
        <div className="px-4 py-2 text-xs text-red-500">{error}</div>
      )}

      {!loading && !error && files.length === 0 && (
        <div className="px-4 py-2 text-xs text-[var(--text-muted)]">
          No files uploaded yet.
        </div>
      )}

      <nav className="mt-1 space-y-1 px-2 pb-4">
        {files.map((file) => {
          const href = `/dashboard/file/${file.id}`;
          const isActive = pathname === href;

          const uploaded = new Date(file.uploaded_at);
          const dateLabel = uploaded.toLocaleDateString();
          const timeLabel = uploaded.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <Link
              key={file.id}
              href={href}
              className={[
                "block rounded-md px-2 py-2 text-sm",
                "border border-transparent",
                "hover:bg-[color:var(--bg-panel-2)] hover:border-[var(--border)]",
                isActive
                  ? "bg-[color:var(--bg-panel-2)] border-sky-500 text-sky-300"
                  : "text-[var(--text-main)]",
              ].join(" ")}
            >
              <div className="truncate">{file.original_name}</div>
              <div className="mt-0.5 text-[11px] text-[var(--text-muted)] flex justify-between">
                <span>{file.status}</span>
                <span>
                  {dateLabel} • {timeLabel}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
