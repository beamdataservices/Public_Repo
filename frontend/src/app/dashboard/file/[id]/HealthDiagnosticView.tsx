"use client";

/**
 * HealthDiagnosticView
 *
 * Fetches and renders the data health diagnostic for a single file.
 * Results are cached in component state so switching tabs doesn't re-run
 * the full analysis.
 *
 * Design principles:
 *  - No jargon visible to the user
 *  - Score + grade shown prominently with a plain-language label
 *  - Issues sorted by severity with a clear recommended action each
 *  - Per-column table open by default for small datasets (≤ 15 cols)
 */

import React, { useEffect, useRef, useState } from "react";
import DedupePanel from "./DedupePanel";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types (mirror HealthOut from backend)
// ---------------------------------------------------------------------------

type IssueOut = {
  key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  plain_message: string;
  recommendation: string;
};

type ColumnDetail = {
  name: string;
  null_rate: number;
  null_count: number;
  distinct_count: number;
  total_count: number;
  inferred_type: string;
  cardinality_class: string;
  min_value: number | null;
  max_value: number | null;
  mean_value: number | null;
  median_value: number | null;
  std_dev: number | null;
  pct_25: number | null;
  pct_75: number | null;
  skewness: number | null;
  outlier_count: number | null;
  top_values: { value: string; count: number }[];
};

type HealthResponse = {
  score: number;
  grade: string;
  score_label: string;
  category_scores: Record<string, number>;
  category_labels: Record<string, string>;
  scoring_explanation: Record<string, string>;
  issues: IssueOut[];
  column_details: ColumnDetail[];
  total_rows: number;
  total_columns: number;
  duplicate_count: number;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Score thresholds resolve to theme tokens so light/dark both stay AA
function scoreColor(score: number): string {
  return score >= 90 ? "var(--score-excellent)"
    : score >= 80 ? "var(--score-good)"
    : score >= 70 ? "var(--score-fair)"
    : score >= 60 ? "var(--score-poor)"
    : "var(--score-bad)";
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = scoreColor(score);
  const size = 136;
  const strokeW = 11;
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)", display: "block" }}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke="var(--bg-panel-2)"
            strokeWidth={strokeW}
          />
          {/* Progress arc */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1), stroke 0.4s ease",
              filter: `drop-shadow(0 0 6px ${color}60)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-4xl font-bold tabular-nums leading-none" style={{ color: "var(--text-main)" }}>
            {score}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-muted)] mt-0.5 tracking-wide uppercase">/ 100</p>
        </div>
      </div>
      <p className="text-xl font-bold tracking-tight" style={{ color }}>Grade {grade}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    critical: { cls: "badge-error", label: "Action Required" },
    warning: { cls: "badge-warning", label: "Warning" },
    info: { cls: "badge-info", label: "Note" },
  };
  const { cls, label } = map[severity] ?? map.info;
  return <span className={`badge ${cls}`}>{label}</span>;
}

async function streamSSE(
  url: string,
  body: unknown,
  token: string,
  onToken: (text: string) => void,
  onError: (msg: string) => void,
  onDone: () => void,
  signal: AbortSignal,
) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) { onError("Request failed"); onDone(); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "token") onToken(evt.content);
            else if (evt.type === "error") onError(evt.content);
            else if (evt.type === "done") onDone();
          } catch { /* ignore malformed */ }
        }
      }
    }
  } catch (err: unknown) {
    if ((err as Error).name !== "AbortError") onError("Could not reach the AI. Please try again.");
    onDone();
  }
}

function IssueCard({
  issue,
  fileId,
  token,
  totalRows,
  totalColumns,
}: {
  issue: IssueOut;
  fileId: string;
  token: string;
  totalRows: number;
  totalColumns: number;
}) {
  const railColor =
    issue.severity === "critical" ? "var(--error-fg)"
    : issue.severity === "warning" ? "var(--warning-fg)"
    : "var(--info-fg)";

  const [explainState, setExplainState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [explanation, setExplanation] = useState("");
  const abortRef = React.useRef<AbortController | null>(null);

  function handleExplain() {
    if (explainState === "loading") return;
    setExplanation("");
    setExplainState("loading");

    const controller = new AbortController();
    abortRef.current = controller;

    streamSSE(
      `${API_BASE_URL}/api/files/${fileId}/explain-issue`,
      { issue: { key: issue.key, severity: issue.severity, title: issue.title, plain_message: issue.plain_message, recommendation: issue.recommendation }, total_rows: totalRows, total_columns: totalColumns },
      token,
      (text) => setExplanation((prev) => prev + text),
      (msg) => { setExplanation(msg); setExplainState("error"); },
      () => setExplainState((s) => s !== "error" ? "done" : "error"),
      controller.signal,
    );
  }

  function handleDismiss() {
    abortRef.current?.abort();
    setExplainState("idle");
    setExplanation("");
  }

  return (
    <div
      className="card space-y-2 p-4"
      style={{ boxShadow: `inset 3px 0 0 ${railColor}, var(--shadow-1)` }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <SeverityBadge severity={issue.severity} />
        <p className="font-semibold text-[var(--text-main)] text-sm leading-snug flex-1">{issue.title}</p>
        {explainState === "idle" && (
          <button type="button" onClick={handleExplain} className="btn btn-accent-outline btn-sm shrink-0">
            ✦ Explain this
          </button>
        )}
        {(explainState === "done" || explainState === "error") && (
          <button type="button" onClick={handleDismiss} className="btn btn-ghost btn-sm shrink-0">
            Hide
          </button>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{issue.plain_message}</p>
      <div className="rounded-[var(--radius-sm)] bg-[color:var(--bg-panel-2)] border border-[var(--border-subtle)] px-3 py-2">
        <p className="text-xs font-semibold text-[var(--text-main)] mb-0.5">Next step</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{issue.recommendation}</p>
      </div>

      {explainState !== "idle" && (
        <div
          className="rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm leading-relaxed"
          style={
            explainState === "error"
              ? { background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }
              : { background: "var(--info-bg)", borderColor: "var(--info-border)", color: "var(--text-main)" }
          }
        >
          <p className="mb-1 text-xs font-semibold" style={{ color: "var(--info-fg)" }}>
            ✦ AI Explanation
          </p>
          {explainState === "loading" && !explanation && (
            <span className="inline-flex gap-1 items-center h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s`, background: "var(--info-fg)" }}
                />
              ))}
            </span>
          )}
          {explanation && <span className="whitespace-pre-wrap">{explanation}</span>}
        </div>
      )}
    </div>
  );
}

function ActionPlanSection({
  fileId,
  token,
  health,
}: {
  fileId: string;
  token: string;
  health: HealthResponse;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [plan, setPlan] = useState("");
  const abortRef = React.useRef<AbortController | null>(null);

  function handleGenerate() {
    if (state === "loading") return;
    setPlan("");
    setState("loading");

    const controller = new AbortController();
    abortRef.current = controller;

    const healthPayload = {
      score: health.score,
      grade: health.grade,
      score_label: health.score_label,
      total_rows: health.total_rows,
      total_columns: health.total_columns,
      duplicate_count: health.duplicate_count,
      issues: health.issues,
      category_scores: health.category_scores,
      category_labels: health.category_labels,
      scoring_explanation: health.scoring_explanation,
    };

    streamSSE(
      `${API_BASE_URL}/api/files/${fileId}/action-plan`,
      { health: healthPayload },
      token,
      (text) => setPlan((prev) => prev + text),
      (msg) => { setPlan(msg); setState("error"); },
      () => setState((s) => s !== "error" ? "done" : "error"),
      controller.signal,
    );
  }

  function handleReset() {
    abortRef.current?.abort();
    setState("idle");
    setPlan("");
  }

  return (
    <div className="card space-y-3 p-5" style={{ borderColor: "var(--info-border)" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-main)]">
            <span style={{ color: "var(--info-fg)" }}>✦</span> AI Action Plan
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Get 3 prioritized steps to improve this dataset
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state === "done" && (
            <button type="button" onClick={handleReset} className="btn btn-ghost btn-sm">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={state !== "loading" ? handleGenerate : undefined}
            disabled={state === "loading"}
            className="btn btn-primary btn-sm shrink-0"
          >
            {state === "loading" ? "Generating…" : state === "done" ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>

      {state !== "idle" && (
        <div
          className="rounded-[var(--radius-sm)] border px-4 py-3 text-sm leading-relaxed"
          style={
            state === "error"
              ? { background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }
              : { background: "var(--bg-panel-2)", borderColor: "var(--border-subtle)", color: "var(--text-main)" }
          }
        >
          {state === "loading" && !plan && (
            <span className="inline-flex gap-1 items-center h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s`, background: "var(--info-fg)" }}
                />
              ))}
            </span>
          )}
          {plan && <span className="whitespace-pre-wrap">{plan}</span>}
        </div>
      )}
    </div>
  );
}

function CategoryBar({ label, score, explanation }: { label: string; score: number; explanation?: string }) {
  const color = scoreColor(score);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-[var(--text-main)]">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>{score.toFixed(0)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[color:var(--bg-panel-2)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            backgroundColor: color,
            boxShadow: `0 1px 4px ${color}55`,
            transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
      {explanation && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{explanation}</p>
      )}
    </div>
  );
}

function friendlyName(col: string) {
  return col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function NullBadge({ rate }: { rate: number }) {
  if (rate === 0)
    return (
      <span className="text-xs font-medium" style={{ color: "var(--success-fg)" }}>
        Complete
      </span>
    );
  const pct = (rate * 100).toFixed(1);
  const color =
    rate > 0.2 ? "var(--error-fg)" : rate > 0.05 ? "var(--warning-fg)" : "var(--score-fair)";
  return (
    <span className="text-xs font-medium tabular-nums" style={{ color }}>
      {pct}% empty
    </span>
  );
}

function CardinalityBadge({ cls }: { cls: string }) {
  // Semantic mapping: unique IDs and constants are noteworthy; the rest are neutral-to-warning
  const map: Record<string, string> = {
    constant: "badge-neutral",
    binary: "badge-info",
    low: "badge-success",
    medium: "badge-neutral",
    high: "badge-warning",
    unique: "badge-error",
  };
  return <span className={`badge capitalize ${map[cls] ?? "badge-neutral"}`}>{cls}</span>;
}

function ColumnTable({ columns }: { columns: ColumnDetail[] }) {
  // Default open for small datasets so users discover the breakdown automatically
  const [open, setOpen] = useState(columns.length <= 15);

  const sorted = [...columns].sort((a, b) => b.null_rate - a.null_rate);

  function skewLabel(skew: number | null): string {
    if (skew == null) return "-";
    if (Math.abs(skew) < 0.5) return "Balanced";
    if (skew > 1) return "Very right-skewed";
    if (skew > 0.5) return "Right-skewed";
    if (skew < -1) return "Very left-skewed";
    return "Left-skewed";
  }

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--text-main)] transition-colors duration-150 hover:bg-[color:var(--bg-panel-2)]"
        onClick={() => setOpen((o) => !o)}
        type="button"
        aria-expanded={open}
      >
        <span>Field-by-Field Breakdown ({columns.length} fields)</span>
        <span className="text-[var(--text-muted)] text-xs">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[color:var(--bg-panel-2)]">
                {[
                  "Field", "Type", "Values", "Completeness", "Unique Count",
                  "Min", "Median", "Max", "Distribution Shape", "Unusual Values",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((col) => (
                <tr
                  key={col.name}
                  className="border-b border-[var(--border-subtle)] transition-colors duration-150 hover:bg-[color:var(--bg-panel-2)]"
                >
                  <td className="px-3 py-2.5 font-medium text-[var(--text-main)] max-w-[140px] truncate" title={col.name}>
                    {friendlyName(col.name)}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-[var(--text-secondary)]">{col.inferred_type}</td>
                  <td className="px-3 py-2.5">
                    <CardinalityBadge cls={col.cardinality_class} />
                  </td>
                  <td className="px-3 py-2.5"><NullBadge rate={col.null_rate} /></td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{col.distinct_count.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                    {col.min_value != null ? col.min_value.toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                    {col.median_value != null ? col.median_value.toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                    {col.max_value != null ? col.max_value.toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{skewLabel(col.skewness)}</td>
                  <td className="px-3 py-2.5">
                    {col.outlier_count != null && col.outlier_count > 0 ? (
                      <span style={{ color: "var(--warning-fg)" }}>{col.outlier_count.toLocaleString()}</span>
                    ) : col.outlier_count === 0 ? (
                      <span style={{ color: "var(--success-fg)" }}>None</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component - with session caching to avoid re-fetching on tab switch
// ---------------------------------------------------------------------------

// Module-level cache keyed by fileId - survives tab switches within the session
const healthCache: Record<string, HealthResponse> = {};

// Stripped-down health summary passed up to the parent for chat context.
// Excludes column_details (large) - column types are loaded separately by ChatPanel.
export type HealthSummaryForChat = {
  score: number;
  grade: string;
  score_label: string;
  total_rows: number;
  total_columns: number;
  duplicate_count: number;
  issues: HealthResponse["issues"];
  category_scores: Record<string, number>;
  category_labels: Record<string, string>;
  scoring_explanation: Record<string, string>;
};

function toHealthSummary(h: HealthResponse): HealthSummaryForChat {
  return {
    score: h.score,
    grade: h.grade,
    score_label: h.score_label,
    total_rows: h.total_rows,
    total_columns: h.total_columns,
    duplicate_count: h.duplicate_count,
    issues: h.issues,
    category_scores: h.category_scores,
    category_labels: h.category_labels,
    scoring_explanation: h.scoring_explanation,
  };
}

export default function HealthDiagnosticView({
  fileId,
  fileName,
  token,
  sheetName,
  onHealthLoaded,
}: {
  fileId: string;
  fileName?: string;
  token: string;
  sheetName?: string | null;
  onHealthLoaded?: (summary: HealthSummaryForChat) => void;
}) {
  const cacheKey = `${fileId}::${sheetName ?? "__default__"}`;
  const [health, setHealth] = useState<HealthResponse | null>(healthCache[cacheKey] ?? null);
  const [loading, setLoading] = useState(!healthCache[cacheKey]);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(!!healthCache[cacheKey]);

  useEffect(() => {
    const cached = healthCache[cacheKey] ?? null;
    setHealth(cached);
    setLoading(!cached);
    setError(null);
    hasFetched.current = !!cached;
    if (cached) onHealthLoaded?.(toHealthSummary(cached));
    // onHealthLoaded is intentionally excluded - it's a stable setter from useState
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => {
    if (!fileId || !token || hasFetched.current) return;
    hasFetched.current = true;

    let cancelled = false;

    async function fetchHealth() {
      setLoading(true);
      setError(null);
      try {
        const controller = new AbortController();
        // 90-second timeout - surface an error instead of hanging forever
        const timeout = setTimeout(() => controller.abort(), 90_000);

        const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/health`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sheet_name: sheetName }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const clean = text.replace(/^\s*\d{3}[:\s]+/, "").replace(/^"(.*)"$/, "$1") || "We couldn't analyze this file right now. Please try again.";
          throw new Error(clean);
        }

        const data = (await res.json()) as HealthResponse;
        if (!cancelled) {
          healthCache[cacheKey] = data;
          setHealth(data);
          onHealthLoaded?.(toHealthSummary(data));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error && err.name === "AbortError"
              ? "The analysis is taking longer than expected. Please try again - it may work on a second attempt."
              : err instanceof Error
              ? err.message
              : "We couldn't analyze this file right now.";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHealth();

    return () => {
      cancelled = true;
      // If the fetch was cancelled before completing (e.g. due to a token refresh),
      // reset the flag so the next render retries with the updated token.
      if (!healthCache[cacheKey]) {
        hasFetched.current = false;
      }
    };
  }, [cacheKey, fileId, sheetName, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28 text-sm text-[var(--text-muted)]">
        <div className="text-center space-y-5 max-w-xs">
          <div className="relative mx-auto w-16 h-16">
            <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="27" fill="none" stroke="var(--bg-panel-2)" strokeWidth="7" />
              <circle
                cx="32" cy="32" r="27"
                fill="none"
                stroke="var(--focus-ring)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="169.6"
                strokeDashoffset="42"
                style={{ animation: "spin 1.4s linear infinite", transformOrigin: "center" }}
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-base text-[var(--text-main)]">Analyzing your data</p>
            <p className="mt-1.5 text-xs leading-relaxed">
              Checking completeness, duplicates, formatting issues, and unusual values.
              Typically 15–30 seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-[var(--radius-md)] border p-5 space-y-2"
        style={{ background: "var(--error-bg)", borderColor: "var(--error-border)" }}
        role="alert"
      >
        <p className="font-semibold" style={{ color: "var(--error-fg)" }}>
          Could not run health check
        </p>
        <p className="text-sm" style={{ color: "var(--error-fg)" }}>{error}</p>
        <button
          type="button"
          onClick={() => {
            delete healthCache[cacheKey];
            hasFetched.current = false;
            setLoading(true);
            setError(null);
            setHealth(null);
          }}
          className="mt-1 text-xs underline"
          style={{ color: "var(--error-fg)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!health) return null;

  const criticalCount = health.issues.filter((i) => i.severity === "critical").length;
  const warningCount  = health.issues.filter((i) => i.severity === "warning").length;
  const infoCount     = health.issues.filter((i) => i.severity === "info").length;

  const issuesSectionTitle =
    criticalCount > 0
      ? "Issues Requiring Your Attention"
      : warningCount > 0
      ? "Warnings to Review"
      : "Notes";

  return (
    <div className="space-y-6">
      {/* ---- Score card ---- */}
      <div className="card p-6 animate-fade-up">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={health.score} grade={health.grade} />

          <div className="flex-1 space-y-4 min-w-0">
            {fileName && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate">{fileName}</p>
            )}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">{health.score_label}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Analyzed{" "}
                <strong className="text-[var(--text-main)]">{health.total_rows.toLocaleString()} records</strong>{" "}
                across{" "}
                <strong className="text-[var(--text-main)]">{health.total_columns} fields</strong>
                {health.duplicate_count > 0 && (
                  <span className="ml-1" style={{ color: "var(--warning-fg)" }}>
                    · {health.duplicate_count.toLocaleString()} duplicate rows found
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(health.category_scores).map(([key, score]) => (
                <CategoryBar
                  key={key}
                  label={health.category_labels[key] ?? key}
                  score={score}
                  explanation={health.scoring_explanation?.[key]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Issue count summary chips */}
        {health.issues.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-2">
            {criticalCount > 0 && (
              <span className="badge badge-error">
                ⚠ {criticalCount} critical {criticalCount === 1 ? "issue" : "issues"}
              </span>
            )}
            {warningCount > 0 && (
              <span className="badge badge-warning">
                ⚡ {warningCount} {warningCount === 1 ? "warning" : "warnings"}
              </span>
            )}
            {infoCount > 0 && (
              <span className="badge badge-info">
                ℹ {infoCount} {infoCount === 1 ? "note" : "notes"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ---- Action Plan ---- */}
      <div className="animate-fade-up-1">
        <ActionPlanSection fileId={fileId} token={token} health={health} />
      </div>

      {/* ---- Issues list ---- */}
      {health.issues.length > 0 ? (
        <div className="space-y-3 animate-fade-up-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{issuesSectionTitle}</h3>
          {(["critical", "warning", "info"] as const).flatMap((sev) =>
            health.issues
              .filter((i) => i.severity === sev)
              .map((issue) => (
                <IssueCard
                  key={issue.key}
                  issue={issue}
                  fileId={fileId}
                  token={token}
                  totalRows={health.total_rows}
                  totalColumns={health.total_columns}
                />
              ))
          )}
        </div>
      ) : (
        <div
          className="rounded-[var(--radius-md)] border p-6 text-center"
          style={{ background: "var(--success-bg)", borderColor: "var(--success-border)" }}
        >
          <p className="font-semibold text-lg" style={{ color: "var(--success-fg)" }}>
            ✓ No significant issues found
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Your dataset passed all health checks. Keep up the good work!
          </p>
        </div>
      )}

      {/* ---- Dedupe CTA ---- */}
      {health.duplicate_count > 0 && (
        <DedupePanel
          fileId={fileId}
          token={token}
          columns={health.column_details.map((c) => c.name)}
          sheetName={sheetName}
          duplicateCount={health.duplicate_count}
        />
      )}

      {/* ---- Field-by-Field Breakdown ---- */}
      {health.column_details.length > 0 && (
        <ColumnTable columns={health.column_details} />
      )}
    </div>
  );
}
