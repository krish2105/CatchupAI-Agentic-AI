"use client";

import { Building2, LogIn, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { OrgView } from "@/lib/org/service";

const ROLE = { student: "Student", teacher: "Teacher", admin: "Admin" } as const;

export default function OrgPanel({ orgs, anonymous }: { orgs: OrgView[]; anonymous: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, path: string, body?: unknown) {
    setBusy(key);
    setError(null);
    try {
      await api(path, { method: "POST", body: body ?? {} });
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "That didn't work.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (anonymous) return <Notice tone="info" title="Demo accounts can't join organisations.">Sign in with your email to join your class.</Notice>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {error ? <Notice tone="danger" title={error} /> : null}
      <div className="two-column">
        <form className="card card-inner org-form" onSubmit={async (e) => { e.preventDefault(); if (await run("join", "/api/org/join", { code: code.trim() })) setCode(""); }}>
          <h2 className="trace-h2"><LogIn className="ic" aria-hidden="true" /> Join with a code</h2>
          <div className="field">
            <label htmlFor="org-code">Join code</label>
            <input id="org-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={10} autoComplete="off" spellCheck={false} />
            <span className="field-hint">10 letters and digits, from your teacher.</span>
          </div>
          <button type="submit" className="btn small primary" disabled={busy !== null || code.trim().length !== 10}>Join</button>
        </form>
        <form className="card card-inner org-form" onSubmit={async (e) => { e.preventDefault(); if (await run("create", "/api/org", { name: name.trim() })) setName(""); }}>
          <h2 className="trace-h2"><Plus className="ic" aria-hidden="true" /> Create an organisation</h2>
          <div className="field">
            <label htmlFor="org-name">Name</label>
            <input id="org-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            <span className="field-hint">For teachers: you become its admin and get a join code.</span>
          </div>
          <button type="submit" className="btn small" disabled={busy !== null || name.trim().length < 2}>Create</button>
        </form>
      </div>

      {orgs.length === 0 ? <p className="muted">You aren&apos;t in an organisation yet.</p> : null}
      {orgs.map((o) => (
        <section key={o.id} className="card card-inner org-card" aria-labelledby={`org-${o.id}`}>
          <div className="split-head">
            <h2 id={`org-${o.id}`} className="trace-h2"><Building2 className="ic" aria-hidden="true" /> {o.name}</h2>
            <Chip>{ROLE[o.role]}</Chip>
          </div>
          {o.role === "student" ? (
            <div className="setting-line">
              <div>
                <strong>Count me in class totals</strong>
                <p>{o.shareProgress ? "On: your completed study minutes, open deadlines and latest check score are added to class totals. Teachers never see your own numbers." : "Off: you're not included in any class totals."}</p>
              </div>
              <button type="button" className="btn small" aria-pressed={o.shareProgress} disabled={busy !== null} onClick={() => run(`share-${o.id}`, `/api/org/${o.id}/share`, { share: !o.shareProgress })}>
                {o.shareProgress ? "Stop sharing" : "Share totals"}
              </button>
            </div>
          ) : null}
          {o.staff ? (
            <>
              <p>Join code: <b className="org-code">{o.staff.joinCode}</b></p>
              <div className="quality-stats" aria-label="Class totals, last 7 days">
                <div><b>{o.staff.summary.students}</b><span>students</span></div>
                <div><b>{o.staff.summary.sharing}</b><span>share totals</span></div>
                {o.staff.summary.shown ? (
                  <>
                    <div><b>{o.staff.summary.minutes_completed}</b><span>study minutes done (7 days)</span></div>
                    <div><b>{o.staff.summary.assignments_due_7d}</b><span>deadlines in the next 7 days</span></div>
                    <div><b>{o.staff.summary.overdue_assignments}</b><span>overdue deadlines</span></div>
                    <div><b>{o.staff.summary.avg_latest_quiz === null ? "—" : `${o.staff.summary.avg_latest_quiz}%`}</b><span>average latest check</span></div>
                  </>
                ) : null}
              </div>
              {!o.staff.summary.shown ? <p className="muted">Class totals appear once at least 3 students share them (now {o.staff.summary.sharing}), so no one&apos;s numbers can be worked out from a total.</p> : null}
              <h3 className="org-roster-title"><Users className="ic" aria-hidden="true" /> Members</h3>
              <table className="data-table">
                <caption className="visually-hidden">Members of {o.name}</caption>
                <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Shares totals</th></tr></thead>
                <tbody>
                  {o.staff.roster.map((m) => (
                    <tr key={m.user_id}>
                      <td>{m.display_name}</td>
                      <td>
                        {o.role === "admin" ? (
                          <select className="select" aria-label={`Role of ${m.display_name}`} value={m.role} disabled={busy !== null} onChange={(e) => run(`role-${m.user_id}`, `/api/org/${o.id}/role`, { userId: m.user_id, role: e.target.value })}>
                            <option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
                          </select>
                        ) : ROLE[m.role as keyof typeof ROLE]}
                      </td>
                      <td>{m.role === "student" ? (m.share_progress ? "Yes" : "No") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          <div><button type="button" className="btn small ghost" disabled={busy !== null} onClick={() => run(`leave-${o.id}`, `/api/org/${o.id}/leave`)}>Leave {o.name}</button></div>
        </section>
      ))}
    </div>
  );
}
