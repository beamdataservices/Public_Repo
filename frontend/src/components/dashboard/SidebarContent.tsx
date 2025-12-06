"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiUploadFile } from "@/lib/api";
import SidebarFiles from "./SidebarFiles";

export default function SidebarContent() {
  const { tokens, loading } = useAuth();

  // Hooks MUST be at the top
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0); // 🔥 shared reload signal

  // Authentication gating
  if (loading) {
    return (
      <div className="px-4 py-2 text-xs text-slate-500">
        Checking authentication...
      </div>
    );
  }

  if (!tokens?.accessToken) {
    return (
      <div className="px-4 py-2 text-xs text-red-500">
        Not authenticated
      </div>
    );
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

      // 🔥 Trigger SidebarFiles reload
      setReloadFlag((prev) => prev + 1);

    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">

      {/* Upload Section */}
      <section className="border border-slate-800 bg-slate-900/60 p-4 rounded-lg">
        <h2 className="font-semibold text-slate-200 text-sm mb-2">
          Upload a File
        </h2>

        <form onSubmit={handleUpload} className="space-y-3">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-100 file:bg-cyan-500 file:text-slate-900 file:rounded file:px-3 file:py-1"
          />

          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded py-2 text-sm disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>

          {error && <p className="text-red-300 text-xs">{error}</p>}
        </form>
      </section>

      {/* Sidebar File List */}
      <section>
        <SidebarFiles reloadFlag={reloadFlag} />
      </section>
    </div>
  );
}
