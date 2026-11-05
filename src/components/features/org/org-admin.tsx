"use client";

import { Copy, Download, KeyRound, Mail, RefreshCw, Trash2, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { OrgView } from "@/lib/org/service";

type Staff = NonNullable<OrgView["staff"]>;

const ACTION: Record<string, string> = {
  "org.created": "Organisation created", "member.joined": "Joined with the code", "member.left": "Left", "member.role_changed": "Role changed",
  "member.sharing_changed": "Sharing changed", "code.rotated": "Join code replaced", "plan.changed": "Plan changed", "invite.created": "Invite sent",
  "invite.resent": "Invite link renewed", "invite.revoked": "Invite revoked", "invite.accepted": "Invite accepted", "member.removed": "Member removed", "org.renamed": "Renamed",
};

/** Admin console for one organisation: invites, join code, members, rename, delete and the audit log. */
export default function OrgAdmin({ orgId, orgName, staff, selfId }: { orgId: string; orgName: string; staff: Staff; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; emailed: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [rename, setRename] = useState(orgName);
  const [confirm, setConfirm] = useState("");
  const [filter, setFilter] = useState("");
  const names = new Map(staff.roster.map((m) => [m.user_id, m.display_name]));

  async function post<T>(key: string, path: string, body?: unknown): Promise<T | null> {
    setBusy(key);
    setError(null);
    try {
      return await api<T>(path, { method: "POST", body: body ?? {} });
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "That didn't work.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const audit = (staff.audit ?? []).filter((e) => !filter || e.action === filter);
  return (
    <div className="org-admin">
      {error ? <Notice tone="danger" title={error} /> : null}

      <section aria-labelledby={`invite-${orgId}`}>
        <h3 id={`invite-${orgId}`} className="org-roster-title"><Mail className="ic" aria-hidden="true" /> Invite by email</h3>
        <form className="org-invite-form" onSubmit={async (e) => {
          e.preventDefault();
          const r = await post<{ link: string; emailed: boolean }>("invite", `/api/org/${orgId}/invites`, { email: email.trim(), role });
          if (r) { setLink({ url: r.link, emailed: r.emailed }); setEmail(""); router.refresh(); }
        }}>
          <div className="field"><label htmlFor={`inv-email-${orgId}`}>Email</label><input id={`inv-email-${orgId}`} className="input" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></div>
          <div className="field"><label htmlFor={`inv-role-${orgId}`}>Role</label><select id={`inv-role-${orgId}`} className="select" value={role} onChange={(e) => setRole(e.target.value)}><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></div>
          <button type="submit" className="btn small primary" disabled={busy !== null || !email.includes("@")}>Create invite</button>
        </form>
        {link ? (
          <div className="calendar-link" role="status">
            <label htmlFor={`inv-link-${orgId}`}>{link.emailed ? "Emailed. You can also share this link (shown once, valid 7 days):" : "Send this link to them (shown once, valid 7 days; they sign in with that email):"}</label>
            <div>
              <input id={`inv-link-${orgId}`} className="input" readOnly value={link.url} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn small" onClick={() => navigator.clipboard.writeText(link.url).catch(() => undefined)}><Copy className="ic" aria-hidden="true" /> Copy</button>
            </div>
          </div>
        ) : null}
        {staff.invites?.length ? (
          <table className="data-table">
            <caption className="visually-hidden">Invites</caption>
            <thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">State</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {staff.invites.slice(0, 20).map((i) => {
                const open = !i.accepted && !i.revoked && !i.expired;
                return (
                  <tr key={i.id}>
                    <td>{i.emailHint}</td>
                    <td>{i.role}</td>
                    <td>{i.accepted ? <Chip tone="good">Accepted</Chip> : i.revoked ? <Chip>Revoked</Chip> : i.expired ? <Chip tone="warn">Expired</Chip> : `Open until ${new Date(i.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}</td>
                    <td className="org-row-actions">
                      {open || i.expired ? <button type="button" className="btn small" disabled={busy !== null || i.revoked} aria-label={`New link for ${i.emailHint}`} onClick={async () => { const r = await post<{ link: string }>(`resend-${i.id}`, `/api/org/invites/${i.id}/resend`); if (r) { setLink({ url: r.link, emailed: false }); router.refresh(); } }}>New link</button> : null}
                      {open ? <button type="button" className="btn small ghost" disabled={busy !== null} aria-label={`Revoke invite for ${i.emailHint}`} onClick={async () => { if (await post(`revoke-${i.id}`, `/api/org/invites/${i.id}/revoke`)) router.refresh(); }}>Revoke</button> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>

      <section aria-labelledby={`code-${orgId}`} className="setting-line">
        <div>
          <strong id={`code-${orgId}`}><KeyRound className="ic" aria-hidden="true" /> Join code</strong>
          <p>Anyone with the code can join. Replace it if it was shared too widely; the old code stops working at once. Invite link: <code>/org?join={staff.joinCode}</code></p>
        </div>
        <button type="button" className="btn small" disabled={busy !== null} onClick={async () => { if (await post("rotate", `/api/org/${orgId}/rotate-code`)) router.refresh(); }}><RefreshCw className="ic" aria-hidden="true" /> Replace code</button>
      </section>

      <section aria-labelledby={`members-admin-${orgId}`}>
        <h3 id={`members-admin-${orgId}`} className="org-roster-title"><UserMinus className="ic" aria-hidden="true" /> Remove a member</h3>
        <ul className="org-remove-list">
          {staff.roster.filter((m) => m.user_id !== selfId).map((m) => (
            <li key={m.user_id}>
              <span>{m.display_name} <span className="muted">· {m.role}</span></span>
              <button type="button" className="btn small ghost" disabled={busy !== null} aria-label={`Remove ${m.display_name}`} onClick={async () => { if (window.confirm(`Remove ${m.display_name} from ${orgName}? Their own study data stays with them.`) && (await post(`remove-${m.user_id}`, `/api/org/${orgId}/members/remove`, { userId: m.user_id }))) router.refresh(); }}>Remove</button>
            </li>
          ))}
          {staff.roster.length <= 1 ? <li className="muted">No other members yet.</li> : null}
        </ul>
      </section>

      <section aria-labelledby={`audit-${orgId}`}>
        <div className="split-head">
          <h3 id={`audit-${orgId}`} className="org-roster-title">Audit log</h3>
          <a className="btn small" href={`/api/org/${orgId}/audit${filter ? `?action=${filter}` : ""}`} download><Download className="ic" aria-hidden="true" /> CSV</a>
        </div>
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor={`audit-filter-${orgId}`}>Show</label>
          <select id={`audit-filter-${orgId}`} className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All actions</option>
            {Object.entries(ACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {staff.audit === null ? <p className="muted">The audit log isn&apos;t available on this database yet.</p> : audit.length === 0 ? <p className="muted">Nothing recorded for this filter.</p> : (
          <ol className="org-audit" aria-label="Audit log, newest first" tabIndex={0}>
            {audit.map((e) => (
              <li key={e.id}>
                <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                <span><b>{ACTION[e.action] ?? e.action}</b>{e.actorId ? ` by ${names.get(e.actorId) ?? "a former member"}` : e.action === "plan.changed" ? " by Stripe" : ""}{e.targetUser && e.targetUser !== e.actorId ? ` · ${names.get(e.targetUser) ?? "a former member"}` : ""}{detailText(e.detail)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby={`settings-${orgId}`} className="org-danger">
        <h3 id={`settings-${orgId}`} className="org-roster-title">Organisation settings</h3>
        <form className="org-invite-form" onSubmit={async (e) => { e.preventDefault(); if (await post("rename", `/api/org/${orgId}/rename`, { name: rename.trim() })) router.refresh(); }}>
          <div className="field"><label htmlFor={`rename-${orgId}`}>Name</label><input id={`rename-${orgId}`} className="input" maxLength={120} value={rename} onChange={(e) => setRename(e.target.value)} /></div>
          <button type="submit" className="btn small" disabled={busy !== null || rename.trim().length < 2 || rename.trim() === orgName}>Rename</button>
        </form>
        <form className="org-invite-form" onSubmit={async (e) => { e.preventDefault(); if (await post("delete", `/api/org/${orgId}/delete`, { confirmName: confirm.trim() })) router.refresh(); }}>
          <div className="field">
            <label htmlFor={`delete-${orgId}`}>Delete the organisation: type <b>{orgName}</b> to confirm</label>
            <input id={`delete-${orgId}`} className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            <span className="field-hint">Removes memberships, invites and the audit log. Students keep all their own study data. A paid plan must be cancelled first.</span>
          </div>
          <button type="submit" className="btn small" disabled={busy !== null || confirm.trim() !== orgName}><Trash2 className="ic" aria-hidden="true" /> Delete organisation</button>
        </form>
      </section>
    </div>
  );
}

function detailText(d: Record<string, unknown>) {
  if (d.from !== undefined && d.to !== undefined) return ` (${String(d.from)} → ${String(d.to)})`;
  if (d.role) return ` (${String(d.role)}${d.email ? `, ${String(d.email)}` : ""})`;
  if (d.share !== undefined) return d.share ? " (now sharing)" : " (stopped sharing)";
  return "";
}
