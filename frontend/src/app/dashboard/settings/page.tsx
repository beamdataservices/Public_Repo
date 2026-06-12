"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import SettingsToggle from "@/components/SettingsToggle";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
type AISettings = { tenant_ai_enabled: boolean; user_ai_enabled: boolean; effective_ai_enabled: boolean };
type FileSettings = { confirm_file_delete: boolean; recycle_bin_retention_days: number; theme_preference: "light" | "dark" };

export default function SettingsPage() {
  const { user, tokens } = useAuth();
  const { theme, setTheme } = useTheme();
  const [ai, setAI] = useState<AISettings | null>(null);
  const [files, setFiles] = useState<FileSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tokens.accessToken) return;
    const headers = { Authorization: `Bearer ${tokens.accessToken}` };
    Promise.all([fetch(`${API_BASE_URL}/api/ai-settings`, { headers }), fetch(`${API_BASE_URL}/api/file-settings`, { headers })])
      .then(async ([aiRes, fileRes]) => {
        if (!aiRes.ok || !fileRes.ok) throw new Error("Could not load settings.");
        setAI(await aiRes.json() as AISettings);
        const loadedFileSettings = await fileRes.json() as FileSettings;
        setFiles(loadedFileSettings);
        setTheme(loadedFileSettings.theme_preference);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load settings."));
  }, [setTheme, tokens.accessToken]);

  async function update(path: string, payload: object, apply: (value: AISettings | FileSettings) => void) {
    if (!tokens.accessToken) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { method: "PUT", headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Could not save settings.");
      apply(await res.json() as AISettings | FileSettings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return <AuthGuard><div className="mx-auto max-w-4xl space-y-5 px-6 py-6">
    <header><h1 className="text-2xl font-bold tracking-tight">All Settings</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Choose a section to review and update your account preferences.</p></header>
    {error && <p className="rounded-[var(--radius-sm)] border p-3 text-sm" role="alert" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }}>{error}</p>}
    <SettingsSection title="Appearance" description="Choose how BEAM Analytics looks on this device." open>
      <label className="block max-w-xs text-sm"><span className="field-label">Theme</span><select value={theme} onChange={(e) => { const nextTheme = e.target.value as "light" | "dark"; setTheme(nextTheme); void update("/api/file-settings/me", { theme_preference: nextTheme }, (value) => setFiles(value as FileSettings)); }} className="input cursor-pointer"><option value="light">Light</option><option value="dark">Dark</option></select></label>
    </SettingsSection>
    <SettingsSection title="AI Access" description="Control whether AI-assisted features are available.">
      <SettingRow label="My AI access"><SettingsToggle label="My AI access" checked={ai?.user_ai_enabled ?? true} disabled={saving || !ai} onChange={(checked) => void update("/api/ai-settings/me", { ai_enabled: checked }, (value) => setAI(value as AISettings))} /></SettingRow>
      {(user?.role === "owner" || user?.role === "admin") && <SettingRow label="Account AI access"><SettingsToggle label="Account AI access" checked={ai?.tenant_ai_enabled ?? true} disabled={saving || !ai} onChange={(checked) => void update("/api/ai-settings/tenant", { ai_enabled: checked }, (value) => setAI(value as AISettings))} /></SettingRow>}
      {ai && !ai.effective_ai_enabled && <p className="text-xs text-[var(--text-muted)]">AI summaries are currently disabled for this account.</p>}
    </SettingsSection>
    <SettingsSection title="File Deletion" description="Choose how deleted files are handled.">
      <SettingRow label="Confirm before deleting a file"><SettingsToggle label="Confirm before deleting a file" checked={files?.confirm_file_delete ?? true} disabled={saving || !files} onChange={(checked) => void update("/api/file-settings/me", { confirm_file_delete: checked }, (value) => setFiles(value as FileSettings))} /></SettingRow>
      <label className="block max-w-xs text-sm"><span className="field-label">Keep deleted files for</span><select value={files?.recycle_bin_retention_days ?? 30} disabled={saving || !files} onChange={(e) => void update("/api/file-settings/me", { recycle_bin_retention_days: Number(e.target.value) }, (value) => setFiles(value as FileSettings))} className="input cursor-pointer disabled:cursor-not-allowed"><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label>
      <Link href="/dashboard/recycle-bin" className="inline-block text-sm font-medium hover:underline" style={{ color: "var(--link)" }}>Open Recycle Bin</Link>
    </SettingsSection>
    {(user?.role === "owner" || user?.role === "admin") && <SettingsSection title="Account Administration" description="Manage users, billing, and AI usage for your account."><div className="flex flex-wrap gap-3"><Link href="/dashboard/admin/users" className="btn btn-secondary btn-sm">Add Users</Link><Link href="/dashboard/admin/llm-usage" className="btn btn-secondary btn-sm">AI Usage</Link><Link href="/dashboard/account-billing" className="btn btn-secondary btn-sm">Account Billing</Link></div></SettingsSection>}
  </div></AuthGuard>;
}

function SettingsSection({ title, description, open, children }: { title: string; description: string; open?: boolean; children: React.ReactNode }) { return <details open={open} className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-4"><summary className="cursor-pointer font-semibold">{title}<span className="mt-1 block text-sm font-normal text-[var(--text-muted)]">{description}</span></summary><div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">{children}</div></details>; }
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex max-w-md items-center justify-between gap-4 text-sm"><span className="text-[var(--text-muted)]">{label}</span>{children}</div>; }
