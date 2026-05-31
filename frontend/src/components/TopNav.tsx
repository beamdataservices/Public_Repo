"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import SettingsToggle from "@/components/SettingsToggle";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
type AISettings = { tenant_ai_enabled: boolean; user_ai_enabled: boolean; effective_ai_enabled: boolean };
type FileSettings = { confirm_file_delete: boolean; recycle_bin_retention_days: number; theme_preference: "light" | "dark" };

export default function TopNav() {
  const { user, tokens, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [openSettings, setOpenSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [fileSettings, setFileSettings] = useState<FileSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const envBadge = useMemo(() => process.env.NEXT_PUBLIC_ENV?.toUpperCase() ?? null, []);

  useEffect(() => {
    if (!tokens.accessToken) return;
    const headers = { Authorization: `Bearer ${tokens.accessToken}` };
    Promise.all([
      fetch(`${API_BASE_URL}/api/ai-settings`, { headers }),
      fetch(`${API_BASE_URL}/api/file-settings`, { headers }),
    ])
      .then(async ([aiRes, fileRes]) => {
        if (!aiRes.ok || !fileRes.ok) throw new Error("Could not load settings");
        setAiSettings(await aiRes.json() as AISettings);
        const loadedFileSettings = await fileRes.json() as FileSettings;
        setFileSettings(loadedFileSettings);
        setTheme(loadedFileSettings.theme_preference);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load settings"));
  }, [setTheme, tokens.accessToken]);

  useEffect(() => {
    if (!openSettings) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setOpenSettings(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [openSettings]);

  async function update(path: string, payload: object, apply: (value: AISettings | FileSettings) => void) {
    if (!tokens.accessToken) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { method: "PUT", headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Could not update settings");
      apply(await res.json() as AISettings | FileSettings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="flex w-full items-center justify-between px-6 py-4" style={{ background: "var(--header-bg)", borderBottom: "4px solid var(--header-border)", color: "var(--header-text)" }}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 overflow-hidden rounded-lg"><Image src="/beam-favicon-20260531-noborder.png" alt="BEAM" width={40} height={40} className="h-10 w-10 object-cover" priority /></div>
        <div className="leading-tight"><div className="font-semibold" style={{ fontSize: "1.15rem" }}>BEAM Analytics</div><div className="text-xs opacity-80">Data Quality Platform</div></div>
        {envBadge && <span className="ml-3 rounded-md border border-white/25 bg-black/15 px-2 py-1 text-xs font-semibold">{envBadge}</span>}
      </div>

      {user && <div className="relative flex items-center gap-3 text-sm">
        <div className="mr-1 text-right font-medium">{user.email}</div>
        <Link href="/dashboard" aria-label="Home" title="Home" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-white/25 bg-black/15 hover:bg-white/10">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
        </Link>
        <div ref={settingsRef}>
          <button type="button" aria-label="Settings" title="Settings" onClick={() => setOpenSettings((value) => !value)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-white/25 bg-black/15 hover:bg-white/10">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[21px] w-[21px] fill-current"><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.7-.99L14.5 2.42A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.62.26-1.19.59-1.7.99l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.51.4 1.08.73 1.7.99l.38 2.65c.04.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65a7.3 7.3 0 0 0 1.7-.99l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.12-1.65ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" /></svg>
          </button>
          {openSettings && <div className="absolute right-0 top-12 w-60 rounded-xl border border-[var(--border)] bg-[color:var(--bg-panel)] p-3 text-[var(--text-main)] shadow-[var(--shadow)]">
            <div className="mb-2 text-sm font-semibold">Settings</div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Theme</label>
            <select value={theme} onChange={(e) => { const nextTheme = e.target.value as "light" | "dark"; setTheme(nextTheme); void update("/api/file-settings/me", { theme_preference: nextTheme }, (value) => setFileSettings(value as FileSettings)); }} className="w-full cursor-pointer rounded-md border border-[var(--border)] bg-[color:var(--bg-panel-2)] px-2 py-2 text-sm"><option value="light">Light</option><option value="dark">Dark</option></select>
            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
              <div className="font-semibold">AI access</div>
              {user.role === "admin" && <SettingRow label="Account AI"><SettingsToggle label="Account AI" checked={aiSettings?.tenant_ai_enabled ?? true} disabled={saving || !aiSettings} onChange={(checked) => void update("/api/ai-settings/tenant", { ai_enabled: checked }, (value) => setAiSettings(value as AISettings))} /></SettingRow>}
              <SettingRow label="My AI"><SettingsToggle label="My AI" checked={aiSettings?.user_ai_enabled ?? true} disabled={saving || !aiSettings} onChange={(checked) => void update("/api/ai-settings/me", { ai_enabled: checked }, (value) => setAiSettings(value as AISettings))} /></SettingRow>
            </div>
            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs"><div className="font-semibold">File deletion</div><SettingRow label="Confirm before delete"><SettingsToggle label="Confirm before delete" checked={fileSettings?.confirm_file_delete ?? true} disabled={saving || !fileSettings} onChange={(checked) => void update("/api/file-settings/me", { confirm_file_delete: checked }, (value) => setFileSettings(value as FileSettings))} /></SettingRow></div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            {user.role === "admin" && <MenuLink href="/dashboard/admin/users" close={() => setOpenSettings(false)}>Add Users</MenuLink>}
            {user.role === "admin" && <MenuLink href="/dashboard/admin/llm-usage" close={() => setOpenSettings(false)}>AI Usage</MenuLink>}
            <MenuLink href="/dashboard/recycle-bin" close={() => setOpenSettings(false)}>Recycle Bin</MenuLink>
            <MenuLink href="/dashboard/settings" close={() => setOpenSettings(false)}>All Settings</MenuLink>
            <button type="button" onClick={logout} className="mt-3 w-full cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--bg-panel-2)]">Logout</button>
          </div>}
        </div>
      </div>}
    </header>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex items-center justify-between gap-3"><span className="text-[var(--text-muted)]">{label}</span>{children}</div>; }
function MenuLink({ href, close, children }: { href: string; close: () => void; children: React.ReactNode }) { return <Link href={href} onClick={close} className="mt-3 block w-full cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-center text-xs font-medium hover:bg-[color:var(--bg-panel-2)]">{children}</Link>; }
