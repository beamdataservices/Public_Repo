"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type TenantUser = { id: string; email: string; role: string; is_active: boolean; created_at: string };
type UserInvite = { id: string; email: string; expires_at: string; created_at: string };
type TenantUsers = { tenant_name: string; users: TenantUser[]; pending_invites: UserInvite[] };
type CreatedInvite = UserInvite & { email_sent: boolean; invite_url?: string | null };
type AuditLog = { id: string; action: string; details: Record<string, string>; created_at: string };

export default function AdminUsersPage() {
  const { tokens, user } = useAuth();
  const [data, setData] = useState<TenantUsers>({ tenant_name: "", users: [], pending_invites: [] });
  const [auditLog, setAuditLog] = useState<AuditLog[]>([]);
  const [email, setEmail] = useState("");
  const [tenantConfirmation, setTenantConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${tokens.accessToken ?? ""}` }), [tokens.accessToken]);
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const loadUsers = useCallback(async () => {
    if (!tokens.accessToken || !isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usersRes, auditRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/users`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/tenant/audit-log`, { headers }),
      ]);
      if (!usersRes.ok || !auditRes.ok) throw new Error("Could not load account administration.");
      setData((await usersRes.json()) as TenantUsers);
      setAuditLog((await auditRes.json()) as AuditLog[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load account administration.");
    } finally {
      setLoading(false);
    }
  }, [headers, isAdmin, tokens.accessToken]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function request(path: string, method: string, body?: object) {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(result?.detail ?? "The request could not be completed.");
      }
      setError(null);
      await loadUsers();
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The request could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    setCreatedInvite(null);
    const invite = await request("/api/admin/users/invitations", "POST", { email }) as CreatedInvite | null;
    if (invite) {
      setCreatedInvite(invite);
      setEmail("");
    }
  }

  async function resendInvite(inviteId: string) {
    setCreatedInvite(await request(`/api/admin/users/invitations/${inviteId}/resend`, "POST") as CreatedInvite | null);
  }

  async function deactivateTenant() {
    if (!confirm("Deactivate this account and prevent all users from signing in? Stored data will be preserved.")) return;
    const result = await request("/api/admin/tenant", "DELETE", { confirmation: tenantConfirmation });
    if (result) window.location.href = "/login";
  }

  return (
    <AuthGuard>
      <div className="space-y-6 px-6 py-6">
        <header><h1 className="text-xl font-semibold text-[var(--text-main)]">Add Users</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Manage access to your account.</p></header>
        {!isAdmin && <Message>Admin privileges are required to manage users.</Message>}
        {error && <Message>{error}</Message>}

        {isAdmin && <section className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-4">
          <form onSubmit={createInvite} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-64 flex-1 flex-col gap-1"><span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">User email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-md border border-[var(--border)] bg-[color:var(--bg-main)] px-3 py-2 text-sm" placeholder="teammate@example.com" /></label>
            <Button type="submit" disabled={busy}>{busy ? "Working..." : "Send invite"}</Button>
          </form>
          {createdInvite && <div className="mt-4 rounded-[var(--radius-sm)] border p-3 text-xs" style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}>{createdInvite.email_sent ? <p>Invitation email sent to {createdInvite.email}.</p> : <><p>Email delivery is not configured. Share this testing link securely:</p><p className="mt-2 break-all" style={{ color: "var(--link)" }}>{createdInvite.invite_url}</p></>}</div>}
        </section>}

        {loading && isAdmin ? <p className="py-8 text-center text-sm text-[var(--text-muted)]">Loading users...</p> : isAdmin && <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Account Owner">{data.users.filter((item) => item.role === "owner" || item.role === "admin").map((item) => <UserRow key={item.id} item={item} busy={busy} request={request} />)}{data.users.some((item) => item.role !== "owner" && item.role !== "admin") && <><h3 className="pt-3 text-sm font-semibold">Users</h3>{data.users.filter((item) => item.role !== "owner" && item.role !== "admin").map((item) => <UserRow key={item.id} item={item} busy={busy} request={request} />)}</>}</Panel>
            <Panel title="Pending Invitations">{data.pending_invites.length === 0 && <p className="text-sm text-[var(--text-muted)]">No pending invitations.</p>}{data.pending_invites.map((invite) => <div key={invite.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"><p>{invite.email}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Expires {new Date(invite.expires_at).toLocaleString()}</p><div className="mt-2 flex gap-2"><Button disabled={busy} onClick={() => void resendInvite(invite.id)}>Resend</Button><Button disabled={busy} onClick={() => void request(`/api/admin/users/invitations/${invite.id}`, "DELETE")}>Revoke</Button></div></div>)}</Panel>
          </div>
          <Panel title="Recent Admin Activity">{auditLog.length === 0 && <p className="text-sm text-[var(--text-muted)]">No account activity recorded yet.</p>}{auditLog.map((entry) => <p key={entry.id} className="border-b border-[var(--border)] py-2 text-xs text-[var(--text-muted)]"><span className="text-[var(--text-main)]">{entry.action}</span>{entry.details.email ? ` - ${entry.details.email}` : ""}<span className="ml-2">{new Date(entry.created_at).toLocaleString()}</span></p>)}</Panel>
          <Panel title="Deactivate Account"><p className="text-sm text-[var(--text-muted)]">This blocks all sign-ins but preserves files and records for recovery. Type <span className="text-[var(--text-main)]">{data.tenant_name}</span> to confirm.</p><div className="mt-3 flex flex-wrap gap-3"><input value={tenantConfirmation} onChange={(e) => setTenantConfirmation(e.target.value)} className="rounded-[var(--radius-sm)] border bg-[color:var(--bg-panel-2)] px-3 py-2 text-sm" style={{ borderColor: "var(--error-border)" }} /><Button disabled={busy || tenantConfirmation !== data.tenant_name} onClick={() => void deactivateTenant()}>Deactivate account</Button></div></Panel>
        </>}
      </div>
    </AuthGuard>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-2 rounded-lg border border-[var(--border)] bg-[color:var(--bg-panel)] p-4"><h2 className="text-sm font-semibold">{title}</h2>{children}</section>; }
function UserRow({ item, busy, request }: { item: TenantUser; busy: boolean; request: (path: string, method: string, body?: object) => Promise<unknown> }) { return <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm"><div><span>{item.email}</span><span className="ml-2 text-xs text-[var(--text-muted)]">{item.role}{item.is_active ? "" : " - inactive"}</span></div>{item.role !== "owner" && item.role !== "admin" && <Button disabled={busy} onClick={() => void request(`/api/admin/users/${item.id}${item.is_active ? "" : "/reactivate"}`, item.is_active ? "DELETE" : "POST")}>{item.is_active ? "Deactivate" : "Reactivate"}</Button>}</div>; }
function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className="btn btn-accent-outline btn-sm">{children}</button>; }
function Message({ children }: { children: React.ReactNode }) { return <div className="rounded-[var(--radius-sm)] border p-4 text-sm" role="alert" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-fg)" }}>{children}</div>; }
