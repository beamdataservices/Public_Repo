"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiUploadFile } from "@/lib/api";
import SidebarFiles from "./SidebarFiles";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type AccountLimits = {
  plan: "demo" | "premium";
  files: {
    lifetime_uploads: number;
    lifetime_upload_limit: number | null;
    lifetime_mb: number;
    lifetime_mb_limit: number | null;
  };
};

export default function SidebarContent() {
  const { tokens, loading, user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [uploadLimits, setUploadLimits] = useState<AccountLimits | null>(null);
  const isOwner = user?.role === "owner" || user?.role === "admin";

  if (loading) {
    return (
      <div className="px-4 py-2 text-xs text-[var(--text-muted)]">
        Checking authentication...
      </div>
    );
  }

  if (!tokens?.accessToken) {
    return (
      <div className="px-4 py-2 text-xs" style={{ color: "var(--error-fg)" }}>
        Not authenticated
      </div>
    );
  }

  async function maybeShowUpgradePrompt(accessToken: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/account/limits`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const limits = (await res.json()) as AccountLimits;
      setUploadLimits(limits);
      if (limits.plan === "demo") setShowUpgradePrompt(true);
    } catch {
      // Upload succeeded; skip the upgrade prompt if limits cannot be loaded.
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError(null);

      const accessToken = tokens.accessToken!;
      await apiUploadFile(accessToken, selectedFile);

      setSelectedFile(null);
      setReloadFlag((prev) => prev + 1);
      await maybeShowUpgradePrompt(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
      <section className="card p-4">
        <h2 className="font-semibold text-[var(--text-main)] text-sm mb-2">
          Upload a File
        </h2>

        <form onSubmit={handleUpload} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--text-muted)]">CSV or Excel file (.xlsx), max 50 MB</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:cursor-pointer file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--text-on-accent)] file:transition-colors hover:file:bg-[var(--accent-hover)]"
            />
          </label>

          {selectedFile && (
            <p className="text-xs text-[var(--text-muted)] truncate">
              Selected: <span className="text-[var(--text-main)]">{selectedFile.name}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="btn btn-primary w-full"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </button>

          {error && (
            <p
              className="rounded-[var(--radius-sm)] border px-2 py-1.5 text-xs"
              role="alert"
              style={{
                background: "var(--error-bg)",
                borderColor: "var(--error-border)",
                color: "var(--error-fg)",
              }}
            >
              {error}
            </p>
          )}
        </form>
      </section>

      {showUpgradePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true" aria-labelledby="upgrade-after-upload-title">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-5 text-[var(--text-main)]" style={{ boxShadow: "var(--shadow-3)" }}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Upload complete</div>
            <h2 id="upgrade-after-upload-title" className="mt-2 text-xl font-bold">Keep going with Premium</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Nice, your file uploaded successfully. This account is still on Demo
              {uploadLimits?.files.lifetime_upload_limit
                ? `, with ${uploadLimits.files.lifetime_uploads} of ${uploadLimits.files.lifetime_upload_limit} lifetime uploads used`
                : ""}
              . Premium removes Demo file and user caps while keeping the same simple workflow.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowUpgradePrompt(false)} className="btn btn-secondary btn-sm">Maybe later</button>
              {isOwner ? (
                <Link href="/dashboard/account-billing" onClick={() => setShowUpgradePrompt(false)} className="btn btn-primary btn-sm">View Premium options</Link>
              ) : (
                <button type="button" onClick={() => setShowUpgradePrompt(false)} className="btn btn-primary btn-sm">Ask account owner</button>
              )}
            </div>
          </div>
        </div>
      )}

      <section>
        <SidebarFiles reloadFlag={reloadFlag} />
      </section>
    </div>
  );
}
