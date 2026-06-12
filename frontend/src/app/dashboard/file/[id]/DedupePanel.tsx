"use client";

import React, { useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type DedupeMode = "full_row" | "columns";
type KeepStrategy = "first" | "last";

type PreviewResult = {
  original_rows: number;
  duplicate_count: number;
  cleaned_rows: number;
  pct_removed: number;
};

export default function DedupePanel({
  fileId,
  token,
  columns,
  sheetName,
  duplicateCount,
}: {
  fileId: string;
  token: string;
  columns: string[];
  sheetName?: string | null;
  duplicateCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DedupeMode>("full_row");
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [keep, setKeep] = useState<KeepStrategy>("first");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCol(col: string) {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
    setPreview(null);
  }

  function buildPayload() {
    return {
      mode,
      columns: mode === "columns" ? selectedCols : [],
      keep,
      sheet_name: sheetName ?? null,
    };
  }

  async function runPreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/dedupe/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Could not run deduplicate preview");
      }
      setPreview((await res.json()) as PreviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run preview");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCleaned() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/dedupe/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Download failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
      const filename = match?.[1]
        ? decodeURIComponent(match[1].replace(/['"]/g, ""))
        : "deduped.csv";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const canPreview =
    mode === "full_row" || (mode === "columns" && selectedCols.length > 0);

  if (!open) {
    return (
      <div
        className="rounded-[var(--radius-md)] border p-4 flex items-center justify-between gap-4"
        style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-main)]">
            Remove duplicate rows
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {duplicateCount.toLocaleString()} duplicate{duplicateCount === 1 ? " row" : " rows"} detected —
            download a cleaned copy of your file.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm shrink-0">
          Fix duplicates
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-5" style={{ borderColor: "var(--warning-border)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">Remove duplicate rows</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setPreview(null); setError(null); }}
          className="btn btn-ghost btn-sm"
        >
          Close
        </button>
      </div>

      {/* Mode */}
      <div className="space-y-2">
        <p className="field-label">Match duplicates by</p>
        <div className="flex gap-2">
          {(["full_row", "columns"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setPreview(null); }}
              aria-pressed={mode === m}
              className="rounded-full px-3 py-1.5 text-xs font-medium border transition-colors duration-150"
              style={
                mode === m
                  ? { background: "var(--warning-bg)", borderColor: "var(--warning-fg)", color: "var(--warning-fg)" }
                  : { borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-panel)" }
              }
            >
              {m === "full_row" ? "Entire row" : "Specific columns"}
            </button>
          ))}
        </div>
        {mode === "full_row" && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Rows where every field is identical will be treated as duplicates.
          </p>
        )}
      </div>

      {/* Column selector */}
      {mode === "columns" && (
        <div className="space-y-2">
          <p className="field-label">Columns to match on</p>
          <p className="text-xs text-[var(--text-muted)]">
            Select the fields that together identify a unique record.
          </p>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {columns.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => toggleCol(col)}
                aria-pressed={selectedCols.includes(col)}
                className="rounded-full px-2.5 py-1 text-xs font-medium border transition-colors duration-150"
                style={
                  selectedCols.includes(col)
                    ? { background: "var(--warning-bg)", borderColor: "var(--warning-fg)", color: "var(--warning-fg)" }
                    : { borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-panel)" }
                }
              >
                {col}
              </button>
            ))}
          </div>
          {selectedCols.length === 0 && (
            <p className="text-xs" style={{ color: "var(--warning-fg)" }}>Select at least one column to continue.</p>
          )}
        </div>
      )}

      {/* Keep strategy */}
      <div className="space-y-2">
        <p className="field-label">When duplicates are found, keep</p>
        <div className="flex gap-2">
          {(["first", "last"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKeep(k); setPreview(null); }}
              aria-pressed={keep === k}
              className="rounded-full px-3 py-1.5 text-xs font-medium border transition-colors duration-150"
              style={
                keep === k
                  ? { background: "var(--accent-soft)", borderColor: "var(--focus-ring)", color: "var(--link)" }
                  : { borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-panel)" }
              }
            >
              {k === "first" ? "First occurrence" : "Last occurrence"}
            </button>
          ))}
        </div>
      </div>

      {/* Preview button */}
      {!preview && (
        <button
          type="button"
          onClick={runPreview}
          disabled={loading || !canPreview}
          className="btn btn-secondary w-full"
        >
          {loading ? "Calculating…" : "Preview result"}
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs" style={{ color: "var(--error-fg)" }}>{error}</p>
      )}

      {/* Preview result */}
      {preview && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[color:var(--bg-panel-2)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Original rows" value={preview.original_rows.toLocaleString()} />
            <Stat
              label="Duplicates removed"
              value={preview.duplicate_count.toLocaleString()}
              highlight={preview.duplicate_count > 0 ? "amber" : "green"}
            />
            <Stat label="Cleaned rows" value={preview.cleaned_rows.toLocaleString()} />
            <Stat
              label="Reduction"
              value={`${preview.pct_removed}%`}
              highlight={preview.pct_removed > 0 ? "amber" : "green"}
            />
          </div>

          {preview.duplicate_count === 0 ? (
            <p className="text-xs font-medium" style={{ color: "var(--success-fg)" }}>
              No duplicates found with these settings — nothing to remove.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={downloadCleaned}
                disabled={downloading}
                className="btn btn-primary flex-1"
              >
                {downloading ? "Preparing download…" : `Download cleaned file (${preview.cleaned_rows.toLocaleString()} rows)`}
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="btn btn-secondary btn-sm"
              >
                Change settings
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Your original file is never modified. The cleaned copy is downloaded to your device.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "amber" | "green";
}) {
  const color =
    highlight === "amber"
      ? "var(--warning-fg)"
      : highlight === "green"
      ? "var(--success-fg)"
      : "var(--text-main)";
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
