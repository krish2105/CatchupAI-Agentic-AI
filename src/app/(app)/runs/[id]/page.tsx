import { CheckCircle2, CircleSlash, Database, FileText, RotateCcw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SelfCheckBadge from "@/components/features/recovery/self-check-badge";
import PageHeading from "@/components/ui/page-heading";
import { Chip } from "@/components/ui/primitives";
import { fallbackNote } from "@/lib/agents/fallback-text";
import { TOOL_LABEL, toolCallText } from "@/lib/agents/tool-labels";
import { requirePageUser, withSessionRecovery } from "@/lib/auth/session";
import { getAgentRun, type AgentRunDto } from "@/lib/db/agent-runs";
import { getProfile } from "@/lib/db/profiles";
import { formatDateTime } from "@/lib/time";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Agent trace" };

const STATUS_ICON = { completed: CheckCircle2, denied: CircleSlash, failed: XCircle } as const;

/**
 * Owner-only trace of one copilot run, read from agent_runs through the student's own client: RLS returns
 * nothing for anyone else's run, so another student (or a guessed id) gets a 404. Everything shown was
 * recorded by the server while the run executed; arguments are the privacy-safe summaries stored then.
 */
/** The agent team: the copilot is the Coach; specialists have their own runs. */
const AGENT_NAME: Record<string, string> = { coach: "Coach", diagnostician: "Diagnostician", quizmaster: "Quizmaster", night_coach: "Night Coach" };

export default async function RunTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) notFound();
  const { supabase, user } = await requirePageUser(`/runs/${id}`);
  let run: AgentRunDto;
  try {
    run = await withSessionRecovery(getAgentRun(supabase, parsed.data));
  } catch (e) {
    if ((e as { status?: number }).status === 404) notFound();
    throw e;
  }
  const profile = await getProfile(supabase, user.id);
  const tz = profile.timezone;
  const startedAt = Date.parse(run.createdAt);
  const tokens = (run.meta.inputTokens ?? 0) + (run.meta.outputTokens ?? 0);
  const fallback = fallbackNote(run.meta);

  return (
    <>
      <PageHeading
        eyebrow={`Run ${run.id.slice(0, 8)} · ${formatDateTime(run.createdAt, tz)}`}
        title={`${AGENT_NAME[run.agent] ?? "Coach"} trace`}
        description={run.agent === "coach" ? "Every tool the copilot (your Coach) chose for this request, in order, as recorded by the server while it ran. Only you can see this page." : `What the ${AGENT_NAME[run.agent] ?? "agent"} of your agent team did for this request, as recorded by the server. It only writes questions from your own pages; grading is done by code. Only you can see this page.`}
        actions={<Link className="btn small" href="/assistant">Back to the copilot</Link>}
      />
      <div className="trace-grid">
        <section className="card card-inner" aria-label="Run summary">
          <div className="label">Request</div>
          <p className="trace-request">{run.request}</p>
          <dl className="trace-facts">
            <div><dt>Status</dt><dd><Chip tone={run.status === "completed" ? "good" : run.status === "failed" ? "danger" : "warn"}>{run.status}</Chip>{run.errorCode ? <> · <code>{run.errorCode}</code></> : null}</dd></div>
            <div><dt>Model</dt><dd><b>{run.meta.model ?? "unknown"}</b>{fallback ? <> · {fallback}</> : null}</dd></div>
            <div><dt>Time</dt><dd>{run.meta.durationMs !== null ? `${(run.meta.durationMs / 1000).toFixed(1)} s` : "still running"}</dd></div>
            <div><dt>Tokens</dt><dd>{tokens > 0 ? `${(run.meta.inputTokens ?? 0).toLocaleString("en-GB")} in · ${(run.meta.outputTokens ?? 0).toLocaleString("en-GB")} out (whole run)` : "none reported (scripted test model or failed run)"}</dd></div>
            <div><dt>Tool calls</dt><dd>{run.events.length}{run.events.some((e) => e.cached) ? ` · ${run.events.filter((e) => e.cached).length} served from the 60 s read cache` : ""}</dd></div>
          </dl>
        </section>

        <section className="card card-inner" aria-labelledby="trace-steps-title">
          <h2 id="trace-steps-title" className="trace-h2">Steps</h2>
          {run.events.length ? (
            <ol className="trace-steps" aria-label="Tool calls in the order the agent chose them">
              {run.events.map((e, i) => {
                const Icon = STATUS_ICON[e.status] ?? XCircle;
                // Clamped: the run row's timestamp comes from the database clock, the step's from the server's.
                const offset = Math.max(0, (Date.parse(e.startedAt) - startedAt) / 1000);
                return (
                  <li key={i} data-status={e.status}>
                    <span className="trace-step-no" aria-hidden="true">{i + 1}</span>
                    <div className="trace-step-body">
                      <div className="trace-step-head">
                        <Icon className="ic" aria-hidden="true" />
                        <strong>{TOOL_LABEL[e.tool] ?? e.tool}</strong>
                        <span className="muted">· {e.status}</span>
                        {e.cached ? <Chip><Database className="ic" aria-hidden="true" /> cached</Chip> : null}
                        {e.attempt && e.attempt > 1 ? <Chip tone="warn"><RotateCcw className="ic" aria-hidden="true" /> fallback model</Chip> : null}
                      </div>
                      <code className="trace-call">{toolCallText(e.tool, e.args)}</code>
                      <p>{e.outcome}</p>
                      <p className="muted trace-timing">started +{offset.toFixed(1)} s · took {e.durationMs} ms</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted">No tool ran in this request.</p>
          )}
        </section>

        <section className="card card-inner" aria-label="Pages cited in the answer">
          <h2 className="trace-h2">Cited pages</h2>
          {run.citations.length ? (
            <ul className="trace-cites">
              {run.citations.map((c) => (
                <li key={c.sourceId}>
                  <code>{c.sourceId}</code>{" "}
                  <a className="cite-chip" href={`/api/documents/${c.documentId}/source?page=${c.page}`} target="_blank" rel="noopener noreferrer">
                    <FileText className="ic" aria-hidden="true" /> {c.filename} · p. {c.page}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">The answer cited no course pages{run.answer?.facts.length ? " (its facts came from your assignments and availability)" : ""}.</p>
          )}
          {run.answer ? <p className="muted">{run.answer.facts.length} verified fact{run.answer.facts.length === 1 ? "" : "s"} · {run.answer.suggestions.length} suggestion{run.answer.suggestions.length === 1 ? "" : "s"}. Facts the cited passage didn&apos;t support were removed before you saw the answer.</p> : null}
        </section>

        {run.proposal ? (
          <section className="card card-inner" aria-label="Draft from this run">
            <h2 className="trace-h2">Draft</h2>
            <p>{run.proposal.scenario} route · {run.proposal.feasible ? "fits your time" : "doesn't fit"} · <b>{run.proposal.status}</b></p>
            <SelfCheckBadge check={run.proposal.selfCheck} />
            {run.proposal.status === "pending" ? <p><Link className="btn small primary" href={`/recovery?proposal=${run.proposal.id}`}>Review in lab</Link></p> : null}
          </section>
        ) : null}

        <section className="card card-inner" aria-label="What this trace can't show">
          <h2 className="trace-h2">What this can&apos;t show</h2>
          <ul className="trace-notes">
            <li>The model&apos;s private reasoning: only the tools it chose and their recorded results.</li>
            <li>Token counts per step: the provider reports them for the whole run.</li>
            <li>Full course text and long queries: arguments are shortened when stored, for privacy.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
