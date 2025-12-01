"use client";

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/context/AuthContext";
import { apiListFiles, apiUploadFile, FileItem } from "@/lib/api";

export default function DashboardPage() {
  const { tokens, user } = useAuth();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFiles() {
    if (!tokens.accessToken) return;

    setLoadingFiles(true);
    setError(null);

    try {
      const data = await apiListFiles(tokens.accessToken);
      setFiles(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load files");
    } finally {
      setLoadingFiles(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, [tokens.accessToken]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile || !tokens.accessToken) return;

    setUploading(true);
    setError(null);

    try {
      await apiUploadFile(tokens.accessToken, selectedFile);
      setSelectedFile(null);
      await loadFiles();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
        <TopNav />

        <main className="flex-1 px-6 py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold">Tenant Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">
              Tenant ID:{" "}
              <span className="font-mono text-xs text-cyan-300">
                {user?.tenant_id}
              </span>
            </p>
          </div>

          {/* Upload section */}
          <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-3 text-lg font-semibold">Upload a new file</h2>
            <p className="mb-4 text-sm text-slate-400">
              Supported: CSV, Excel (.xlsx)
            </p>

            <form
              onSubmit={handleUpload}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <input
                type="file"
                accept=".csv, .xlsx"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-900 hover:file:bg-cyan-400"
              />

              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </form>

            {error && (
              <p className="mt-3 text-sm text-red-300">{error}</p>
            )}
          </section>

          {/* File list */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Uploaded Files</h2>

              <button
                onClick={loadFiles}
                disabled={loadingFiles}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            {loadingFiles ? (
              <p className="text-sm text-slate-400">Loading files...</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-slate-400">No files uploaded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Filename</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Status</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Size</th>
                      <th className="px-3 py-2">Uploaded At</th>
                    </tr>
                  </thead>

                  <tbody>
                    {files.map((f) => (
                      <tr
                        key={f.id}
                        className="border-b border-slate-900/40 text-xs sm:text-sm"
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-50">
                            {f.original_name}
                          </span>
                        </td>

                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                            {f.status}
                          </span>
                        </td>

                        <td className="px-3 py-2 hidden sm:table-cell">
                          {f.size_bytes != null
                            ? `${(f.size_bytes / 1024).toFixed(1)} KB`
                            : "—"}
                        </td>

                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-slate-300">
                            {new Date(f.uploaded_at).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
