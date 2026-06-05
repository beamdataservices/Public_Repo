"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { FILES_CHANGED_EVENT, notifyFilesChanged } from "@/lib/file-events";

type FileSummary = {
  id: string;
  original_name: string;
  uploaded_at: string;
  status: string;
  size_bytes: number | null;
};

type FileSettings = {
  confirm_file_delete: boolean;
  recycle_bin_retention_days: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  processing: "Processing...",
  error: "Error",
  pending: "Pending",
  uploaded: "Ready",
};

function friendlyStatus(status: string): string {
  return STATUS_LABELS[status?.toLowerCase()] ?? status;
}

export default function SidebarFiles({ reloadFlag }: { reloadFlag: number }) {
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fileSettings, setFileSettings] = useState<FileSettings>({
    confirm_file_delete: true,
    recycle_bin_retention_days: 30,
  });

  const pathname = usePathname();
  const router = useRouter();
  const { tokens } = useAuth();

  const loadFiles = useCallback(async () => {
    if (!tokens?.accessToken) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/files/`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!res.ok) throw new Error(`Failed to load files: ${res.status}`);
      setFiles((await res.json()) as FileSummary[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [tokens?.accessToken]);

  const loadFileSettings = useCallback(async () => {
    if (!tokens?.accessToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/file-settings`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (res.ok) setFileSettings((await res.json()) as FileSettings);
    } catch {
      // Keep confirmation enabled if preferences cannot be loaded.
    }
  }, [tokens?.accessToken]);

  async function downloadFile(file: FileSummary) {
    if (!tokens?.accessToken) {
      setError("Not authenticated");
      return;
    }

    try {
      setError(null);
      setDownloadingId(file.id);
      const res = await fetch(`${API_BASE_URL}/api/files/${file.id}/download/`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_name || `file-${file.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  async function deleteFile(file: FileSummary) {
    if (!tokens?.accessToken) {
      setError("Not authenticated");
      return;
    }
    let shouldConfirm = fileSettings.confirm_file_delete;
    try {
      const settingsRes = await fetch(`${API_BASE_URL}/api/file-settings`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (settingsRes.ok) {
        const latestSettings = (await settingsRes.json()) as FileSettings;
        setFileSettings(latestSettings);
        shouldConfirm = latestSettings.confirm_file_delete;
      }
    } catch {
      // Use the most recently loaded preference.
    }
    if (
      shouldConfirm &&
      !window.confirm("Are you sure you wish to delete this file?")
    ) {
      return;
    }

    try {
      setError(null);
      setDeletingId(file.id);
      const res = await fetch(`${API_BASE_URL}/api/files/${file.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setFiles((current) => current.filter((item) => item.id !== file.id));
      notifyFilesChanged();
      if (pathname === `/dashboard/file/${file.id}`) router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadFiles();
    loadFileSettings();
  }, [loadFileSettings, loadFiles, reloadFlag]);

  useEffect(() => {
    window.addEventListener(FILES_CHANGED_EVENT, loadFiles);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, loadFiles);
  }, [loadFiles]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-(--text-muted) uppercase tracking-wide">
          Files
        </span>
      </div>

      {loading && <div className="px-4 py-2 text-xs text-(--text-muted)">Loading files...</div>}
      {error && !loading && <div className="px-4 py-2 text-xs text-red-500">{error}</div>}
      {!loading && !error && files.length === 0 && (
        <div className="px-4 py-2 text-xs text-(--text-muted)">No files uploaded yet.</div>
      )}

      <nav className="mt-1 space-y-1 px-2 pb-4">
        {files.map((file) => {
          const href = `/dashboard/file/${file.id}`;
          const isActive = pathname === href;
          const uploaded = new Date(file.uploaded_at);
          const dateLabel = uploaded.toLocaleDateString();
          const timeLabel = uploaded.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const isDownloading = downloadingId === file.id;
          const isDeleting = deletingId === file.id;

          return (
            <div
              key={file.id}
              className={[
                "group rounded-md px-2 py-2 text-sm",
                "border border-transparent",
                "hover:bg-(--bg-panel-2) hover:border-(--border)",
                "flex items-start gap-2",
                isActive
                  ? "bg-(--bg-panel-2) border-(--accent) text-(--text-main)"
                  : "text-(--text-main)",
              ].join(" ")}
            >
              <Link href={href} className="flex-1 min-w-0">
                <div className="truncate">{file.original_name}</div>
                <div className="mt-0.5 text-xs text-(--text-muted) flex justify-between">
                  <span>{friendlyStatus(file.status)}</span>
                  <span>{dateLabel} &bull; {timeLabel}</span>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col gap-1 mt-0.5">
                <button
                  type="button"
                  className={[
                    "h-7 w-7 rounded border border-(--border)",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    "hover:bg-(--bg-panel) text-(--text-main)",
                    isDownloading ? "opacity-100 cursor-wait" : "",
                  ].join(" ")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDownloading) downloadFile(file);
                  }}
                  title={isDownloading ? "Downloading..." : "Download"}
                  aria-label={`Download ${file.original_name}`}
                  disabled={isDownloading}
                >
                  {isDownloading ? "..." : <>&#11015;</>}
                </button>
                <button
                  type="button"
                  className={[
                    "h-7 w-7 rounded border border-(--border)",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    "hover:bg-red-950/30 text-red-400",
                    isDeleting ? "opacity-100 cursor-wait" : "",
                  ].join(" ")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDeleting) deleteFile(file);
                  }}
                  title={isDeleting ? "Deleting..." : "Delete"}
                  aria-label={`Delete ${file.original_name}`}
                  disabled={isDeleting}
                >
                  {isDeleting ? "..." : <>&#128465;</>}
                </button>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
