"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import SettingsToggle from "@/components/SettingsToggle";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
type AISettings = { tenant_ai_enabled: boolean; user_ai_enabled: boolean; effective_ai_enabled: boolean };
type FileSettings = { confirm_file_delete: boolean; recycle_bin_retention_days: number; theme_preference: "light" | "dark" };

export default function TopNav() {
  const { user, tokens, logout, switchAccount, createAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const [openSettings, setOpenSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [fileSettings, setFileSettings] = useState<FileSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const settingsRef = useRef<HTMLDivElement>(null);
  const accountNameRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (showCreateAccount) accountNameRef.current?.focus();
  }, [showCreateAccount]);

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

  function openCreateAccountForm() {
    setShowCreateAccount(true);
    setNewAccountName("");
    setError(null);
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accountName = newAccountName.trim();
    if (!accountName) {
      setError("Enter an account name.");
      return;
    }
    setSaving(true);
    try {
      await createAccount(accountName);
      setShowCreateAccount(false);
      setNewAccountName("");
      setOpenSettings(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <header
      className="flex w-full items-center justify-between px-6 py-4"
      style={{
        background: "linear-gradient(180deg, var(--header-bg) 0%, color-mix(in srgb, var(--header-bg) 88%, #000) 100%)",
        borderBottom: "2px solid var(--header-border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        color: "var(--header-text)",
      }}
    >
      <div className="flex items-center gap-3.5">
        <div className="h-10 w-10 overflow-hidden rounded-xl shadow-md"><Image src="/beam-favicon-20260531-noborder.png" alt="BEAM" width={40} height={40} className="h-10 w-10 object-cover" priority /></div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">BEAM Analytics</div>
          <div className="text-[11px] font-medium" style={{ color: "var(--header-text-muted)" }}>Data Quality Platform</div>
        </div>
        {envBadge && <span className="ml-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide" style={{ border: "1px solid var(--header-chip-border)", background: "var(--header-chip-bg)", color: "var(--header-text-muted)" }}>{envBadge}</span>}
      </div>

      {user && <div className="relative flex items-center gap-3 text-sm">
        <div className="mr-1 text-right">
          <div className="font-medium">{user.email}</div>
          <select
            title="Switch account"
            aria-label="Switch account"
            value={user.active_account.membership_id}
            disabled={user.available_accounts.length <= 1}
            onChange={(e) => void switchAccount(e.target.value)}
            className="mt-1 max-w-48 cursor-pointer rounded-[6px] px-2 py-1 text-xs transition-colors duration-150 disabled:cursor-default disabled:opacity-70"
            style={{ border: "1px solid var(--header-chip-border)", background: "var(--header-chip-bg)", color: "var(--header-text)" }}
          >
            {user.available_accounts.map((account) => (
              <option key={account.membership_id} value={account.membership_id} className="text-black">
                {account.account_name}
              </option>
            ))}
          </select>
        </div>
        <Link href="/dashboard" aria-label="Home" title="Home" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-150 hover:brightness-125" style={{ border: "1px solid var(--header-chip-border)", background: "var(--header-chip-bg)" }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
        </Link>
        <div ref={settingsRef}>
          <button type="button" aria-label="Settings" title="Settings" onClick={() => setOpenSettings((value) => !value)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-150 hover:brightness-125" style={{ border: "1px solid var(--header-chip-border)", background: "var(--header-chip-bg)" }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[21px] w-[21px] fill-current"><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.7-.99L14.5 2.42A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.62.26-1.19.59-1.7.99l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.51.4 1.08.73 1.7.99l.38 2.65c.04.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65a7.3 7.3 0 0 0 1.7-.99l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.12-1.65ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" /></svg>
          </button>
          {openSettings && <div className="absolute right-0 top-12 z-50 w-60 rounded-[var(--radius-md)] border border-[var(--border)] bg-[color:var(--bg-panel)] p-3 text-[var(--text-main)]" style={{ boxShadow: "var(--shadow-3)" }} role="dialog" aria-label="Settings">
            <div className="mb-2 text-sm font-semibold">Settings</div>
            <label className="field-label">Theme</label>
            <select value={theme} onChange={(e) => { const nextTheme = e.target.value as "light" | "dark"; setTheme(nextTheme); void update("/api/file-settings/me", { theme_preference: nextTheme }, (value) => setFileSettings(value as FileSettings)); }} className="input cursor-pointer px-2 py-2"><option value="light">Light</option><option value="dark">Dark</option></select>
            <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3 text-xs">
              <div className="font-semibold">AI access</div>
              {(user.role === "owner" || user.role === "admin") && <SettingRow label="Account AI"><SettingsToggle label="Account AI" checked={aiSettings?.tenant_ai_enabled ?? true} disabled={saving || !aiSettings} onChange={(checked) => void update("/api/ai-settings/tenant", { ai_enabled: checked }, (value) => setAiSettings(value as AISettings))} /></SettingRow>}
              <SettingRow label="My AI"><SettingsToggle label="My AI" checked={aiSettings?.user_ai_enabled ?? true} disabled={saving || !aiSettings} onChange={(checked) => void update("/api/ai-settings/me", { ai_enabled: checked }, (value) => setAiSettings(value as AISettings))} /></SettingRow>
            </div>
            <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3 text-xs"><div className="font-semibold">File deletion</div><SettingRow label="Confirm before delete"><SettingsToggle label="Confirm before delete" checked={fileSettings?.confirm_file_delete ?? true} disabled={saving || !fileSettings} onChange={(checked) => void update("/api/file-settings/me", { confirm_file_delete: checked }, (value) => setFileSettings(value as FileSettings))} /></SettingRow></div>
            {error && <p className="mt-2 text-xs" style={{ color: "var(--error-fg)" }}>{error}</p>}
            {(user.role === "owner" || user.role === "admin") && <MenuLink href="/dashboard/admin/users" close={() => setOpenSettings(false)}>Add Users</MenuLink>}
            {(user.role === "owner" || user.role === "admin") && <MenuLink href="/dashboard/admin/llm-usage" close={() => setOpenSettings(false)}>AI Usage</MenuLink>}
            <MenuLink href="/dashboard/recycle-bin" close={() => setOpenSettings(false)}>Recycle Bin</MenuLink>
            {!showCreateAccount && <button type="button" onClick={openCreateAccountForm} disabled={saving} className="btn btn-secondary btn-sm mt-3 w-full">Create New Account</button>}
            {showCreateAccount && <form onSubmit={(event) => void handleCreateAccount(event)} className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-3">
              <div className="text-sm font-semibold">Create New Account</div>
              <label htmlFor="topnav-account-name" className="field-label mt-3">Account name</label>
              <input
                ref={accountNameRef}
                id="topnav-account-name"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowCreateAccount(false);
                    setNewAccountName("");
                    setError(null);
                  }
                }}
                disabled={saving}
                className="input px-2 py-2"
                autoComplete="organization"
              />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { setShowCreateAccount(false); setNewAccountName(""); setError(null); }} disabled={saving} className="btn btn-secondary btn-sm flex-1">Cancel</button>
                <button type="submit" disabled={saving || !newAccountName.trim()} className="btn btn-primary btn-sm flex-1">{saving ? "Creating..." : "Create"}</button>
              </div>
            </form>}
            <MenuLink href="/dashboard/settings" close={() => setOpenSettings(false)}>All Settings</MenuLink>
            <button type="button" onClick={logout} className="btn btn-secondary btn-sm mt-3 w-full">Logout</button>
          </div>}
        </div>
      </div>}
    </header>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex items-center justify-between gap-3"><span className="text-[var(--text-muted)]">{label}</span>{children}</div>; }
function MenuLink({ href, close, children }: { href: string; close: () => void; children: React.ReactNode }) { return <Link href={href} onClick={close} className="btn btn-secondary btn-sm mt-3 w-full">{children}</Link>; }
