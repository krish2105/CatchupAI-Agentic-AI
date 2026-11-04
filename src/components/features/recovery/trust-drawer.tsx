"use client";

import { fallbackNote } from "@/lib/agents/fallback-text";
import { CheckCircle2, CircleSlash, FileText, ShieldCheck, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { AgentRunDto } from "@/lib/db/agent-runs";
import type { ProposalDto } from "@/lib/planner/service";

const TOOL_LABEL: Record<string, string> = {
  get_study_preferences: "Read your availability",
  list_assignments: "Listed your assignments",
  search_course_material: "Searched your course notes",
  get_learning_progress: "Checked your plan progress",
  draft_recovery_plan: "Drafted a plan (not saved)",
  get_student_memory: "Read what you asked it to remember",
  suggest_memory: "Suggested something to remember (needs your OK)",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * "Why trust this?": everything behind a draft or plan, from the server's own records: decision history,
 * the course pages used, the tools that actually ran, and what the system could not verify.
 */
export default function TrustDrawer({ proposalId, label = "Why trust this?" }: { proposalId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ proposal: ProposalDto; run: AgentRunDto | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleId = `trust-${proposalId}`;

  async function show() {
    setOpen(true);
    if (data) return;
    setError(null);
    try {
      const { proposal } = await api<{ proposal: ProposalDto }>(`/api/proposals/${proposalId}`);
      const run = proposal.runId ? (await api<{ run: AgentRunDto }>(`/api/agent/runs/${proposal.runId}`)).run : null;
      setData({ proposal, run });
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't load the evidence.");
    }
  }

  const p = data?.proposal;
  const evidence = p
    ? [...new Map(p.payload.tasks.flatMap((t) => t.evidence ?? []).map((e) => [`${e.documentId}:${e.page}`, e])).values()]
    : [];
  const unknowns: string[] = [];
  if (p) {
    unknowns.push("Time estimates come from your assignments; real effort can differ.");
    if (!evidence.length && !data?.run?.citations.length) unknowns.push("No course pages were used for this plan, so it can't point to specific material.");
    if (!p.feasible) unknowns.push(`This route is short by ${Math.round(p.payload.summary.shortfallMinutes)} minutes before its deadlines.`);
    if (data?.run) unknowns.push("The copilot's suggestions are advice. Only statements tied to a retrieved page are shown as facts.");
    unknowns.push("The schedule itself is calculated by a fixed algorithm, not by AI: the same inputs always give the same plan.");
  }

  return (
    <>
      <button type="button" className="btn small ghost" onClick={show}><ShieldCheck className="ic" aria-hidden="true" /> {label}</button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="trust">
          <div className="trust-head">
            <div>
              <div className="eyebrow">Evidence and trust</div>
              <h2 id={titleId}>Why you can trust this plan</h2>
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><X className="ic" aria-hidden="true" /></button>
          </div>
          {error ? <Notice tone="danger" title={error} /> : !p ? <p className="muted">Loading the record…</p> : (
            <>
              <section aria-labelledby={`${titleId}-history`}>
                <h3 id={`${titleId}-history`}>Decision history</h3>
                <ol className="trust-timeline">
                  <li><b>Drafted</b> {when(p.createdAt)} · {p.runId ? "by the copilot, from your request" : "by you, in the Recovery lab"} · {p.scenario} route</li>
                  {p.status === "pending" ? <li><b>Waiting for you</b> · expires {when(p.expiresAt)} if not approved</li> : null}
                  {p.status === "approved" ? <li><b>Approved by you</b>{p.decidedAt ? ` ${when(p.decidedAt)}` : ""} · saved once{p.appliedPlanId ? " as your active plan" : ""}</li> : null}
                  {p.status === "rejected" ? <li><b>Rejected by you</b>{p.decidedAt ? ` ${when(p.decidedAt)}` : ""} · nothing was saved</li> : null}
                  {p.status === "expired" ? <li><b>Expired</b> {when(p.expiresAt)} · nothing was saved</li> : null}
                </ol>
              </section>
              <section aria-labelledby={`${titleId}-evidence`}>
                <h3 id={`${titleId}-evidence`}>Course evidence used</h3>
                {evidence.length || data?.run?.citations.length ? (
                  <ul className="trust-list">
                    {evidence.map((e) => (
                      <li key={`${e.documentId}:${e.page}`}><a className="cite-chip" href={`/api/documents/${e.documentId}/source?page=${e.page}`} target="_blank" rel="noopener noreferrer"><FileText className="ic" aria-hidden="true" /> {e.filename ?? "Document"} · p. {e.page}</a></li>
                    ))}
                    {data?.run?.citations.map((c) => (
                      <li key={c.sourceId}><a className="cite-chip" href={`/api/documents/${c.documentId}/source?page=${c.page}`} target="_blank" rel="noopener noreferrer"><FileText className="ic" aria-hidden="true" /> {c.filename} · p. {c.page}</a></li>
                    ))}
                  </ul>
                ) : <p className="muted">None. This plan is based on your deadlines and availability only.</p>}
              </section>
              <section aria-labelledby={`${titleId}-tools`}>
                <h3 id={`${titleId}-tools`}>Tools that actually ran</h3>
                {data?.run?.events.length ? (
                  <ul className="trust-list">
                    {data.run.events.map((e, i) => {
                      const Icon = e.status === "completed" ? CheckCircle2 : e.status === "denied" ? CircleSlash : XCircle;
                      return <li key={i}><Icon className="ic" aria-hidden="true" /> {TOOL_LABEL[e.tool] ?? e.tool} · {e.status} · {e.durationMs} ms</li>;
                    })}
                  </ul>
                ) : <p className="muted">No AI tools were involved: this plan came straight from the deterministic planner.</p>}
                {data?.run ? <p className="trust-meta"><Link href={`/runs/${data.run.id}`}>Open the full agent trace</Link></p> : null}
                {data?.run?.meta.model ? (
                  <p className="trust-meta">
                    Model <b>{data.run.meta.model}</b>
                    {fallbackNote(data.run.meta) ? <> ({fallbackNote(data.run.meta)})</> : null}
                    {data.run.meta.durationMs !== null ? <> · {(data.run.meta.durationMs / 1000).toFixed(1)} s</> : null}
                    {(data.run.meta.inputTokens ?? 0) + (data.run.meta.outputTokens ?? 0) > 0 ? <> · {((data.run.meta.inputTokens ?? 0) + (data.run.meta.outputTokens ?? 0)).toLocaleString("en-GB")} tokens</> : null}
                  </p>
                ) : null}
              </section>
              <section aria-labelledby={`${titleId}-limits`}>
                <h3 id={`${titleId}-limits`}>What this can&apos;t tell you</h3>
                <ul className="trust-notes">{unknowns.map((u) => <li key={u}>{u}</li>)}</ul>
              </section>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
