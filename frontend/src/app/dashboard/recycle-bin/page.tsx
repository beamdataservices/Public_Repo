"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type RecycleBinFile = {
  id: string;
  original_name: string;
  size_bytes: number | null;
  deleted_at: string;
  purge_after: string;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RecycleBinPage() {
  const { tokens } = useAuth();
  const [files, setFiles] = useState<RecycleBinFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${tokens.accessToken ?? ""}` }),
    [tokens.accessToken]
  );

  const loadFiles = useCallback(async () => {
    if (!tokens.accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/files/recycle-bin/`, { headers });
      if (!res.ok) throw new Error("Could not load deleted files.");
      setFiles((await res.json()) as RecycleBinFile[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load deleted files.");
    } finally {
      setLoading(false);
    }
  }, [headers, tokens.accessToken]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function restoreFile(file: RecycleBinFile) {
    setRestoringId(file.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/files/recycle-bin/${file.id}/restore`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Could not restore file.");
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore file.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <AuthGuard>
      <div className="px-6 py-6 space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-[var(--text-main)]">Recycle Bin</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Deleted files remain available until their retention period expires.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading deleted files...</div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)]">
            {files.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Recycle bin is empty.</div>
            ) : (
              files.map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-main)]">{file.original_name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Deleted {new Date(file.deleted_at).toLocaleString()} &bull; Purges {new Date(file.purge_after).toLocaleDateString()}
                      {file.size_bytes ? ` - ${formatSize(file.size_bytes)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreFile(file)}
                    disabled={restoringId === file.id}
                    className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:bg-[color:var(--bg-panel-2)] disabled:opacity-60"
                  >
                    {restoringId === file.id ? "Restoring..." : "Restore"}
                  </button>
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </AuthGuard>
  );
}
