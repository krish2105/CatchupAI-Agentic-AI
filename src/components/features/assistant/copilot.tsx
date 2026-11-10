"use client";

import { fallbackNote } from "@/lib/agents/fallback-text";
import { ArrowRight, BookOpen, Check, CheckCircle2, CircleSlash, FileText, Leaf, MessageSquarePlus, OctagonX, Sparkles, Square, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import SelfCheckBadge from "@/components/features/recovery/self-check-badge";
import TrustDrawer from "@/components/features/recovery/trust-drawer";
import Thumbs from "@/components/ui/thumbs";
import type { ToolEvent } from "@/lib/agents/context";
import type { AnswerStreamEvent } from "@/lib/agents/recovery-agent";
import type { AgentRunDto, RunCitation } from "@/lib/db/agent-runs";

const PROMPTS = [
  "I missed two classes. Help me catch up before my next deadline.",
  "What should I prioritise with the time I have this week?",
  "Explain residuals from my course notes.",
];

const TOOL_LABEL: Record<string, string> = {
  get_study_preferences: "Read your availability",
  list_courses: "Listed your courses",
  list_assignments: "Listed your assignments",
  search_course_material: "Searched your course notes",
  get_learning_progress: "Checked your plan progress",
  draft_recovery_plan: "Drafted a plan (not saved)",
  get_student_memory: "Read what you asked it to remember",
  suggest_memory: "Suggested something to remember",
};

const ERROR_TEXT: Record<string, string> = {
  timeout: "The copilot took too long and was stopped. Nothing was changed.",
  cancelled: "You stopped this request. Nothing was changed.",
  max_turns: "The copilot hit its step limit. Nothing was changed; try a more specific question.",
  invalid_output: "The copilot returned an answer we couldn't verify, so it was discarded.",
  model_error: "The AI service failed. Nothing was changed. Try again in a moment.",
  model_busy: "The AI model is at its rate limit right now. Nothing was changed. Wait a minute and try again.",
  model_quota: "The AI quota is used up, so the copilot is paused for now. Nothing was changed, and everything else still works.",
  model_overloaded: "The AI model is overloaded right now. Nothing was changed. Try again in a few minutes.",
  provider_timeout: "The AI model didn't answer in time. Nothing was changed. Try again in a moment.",
  attempt_timeout: "The AI model didn't answer in time. Nothing was changed. Try again in a moment.",
};

function Timeline({ events, running }: { events: ToolEvent[]; running: boolean }) {
  if (!events.length && !running) {
    return <div className="empty-state" style={{ padding: "10px 5px", textAlign: "left" }}>No tool calls yet. Each tool the agent actually executes appears here with its outcome.</div>;
  }
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Executed tool calls">
      {events.map((e, i) => {
        const Icon = e.status === "completed" ? CheckCircle2 : e.status === "denied" ? CircleSlash : XCircle;
        return (
          <li className="tool-row" key={`${e.tool}-${i}`}>
            <span className="tool-check" style={e.status === "completed" ? undefined : { color: "var(--warn)" }}><Icon className="ic" aria-hidden="true" /></span>
            <div style={{ minWidth: 0 }}>
              <strong>{TOOL_LABEL[e.tool] ?? e.tool} <span className="muted" style={{ fontWeight: 500 }}>· {e.status}</span></strong>
              <p>{e.outcome}</p>
              <p style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 9.5, overflowWrap: "anywhere" }}>
                {e.tool}({Object.entries(e.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")}) · {e.durationMs} ms
              </p>
            </div>
          </li>
        );
      })}
      {running ? <li className="tool-row"><span className="tool-check"><span className="spinner" aria-hidden="true" style={{ width: 10, height: 10 }} /></span><div><strong>Working…</strong><p>Waiting for the next step.</p></div></li> : null}
    </ol>
  );
}

function AnswerView({ run, onFollowUp }: { run: AgentRunDto; onFollowUp?: (text: string) => void }) {
  if (run.status === "failed") return <Notice tone="danger" title={ERROR_TEXT[run.errorCode ?? ""] ?? "The copilot failed. Nothing was changed."} />;
  if (!run.answer) return null;
  if (run.answer.scope === "out_of_scope") {
    return (
      <div className="answer">
        <span className="answer-avatar" aria-hidden="true"><Leaf className="ic" /></span>
        <div className="answer-body">
          <div className="answer-eyebrow">CatchUp AI · Outside what I can help with</div>
          <p>{run.answer.suggestions[0]}</p>
        </div>
      </div>
    );
  }
  const cite = (id: string) => run.citations.find((c) => c.sourceId === id);
  const grounded = run.answer.facts.length > 0;
  return (
    <div className="answer">
      <span className="answer-avatar" aria-hidden="true"><Leaf className="ic" /></span>
      <div className="answer-body">
        <div className="answer-eyebrow">CatchUp AI · {grounded ? "Source-grounded answer" : "Suggestions only"}</div>
        {grounded ? (
          <section aria-label="From your course material and data">
            <h3 className="answer-title">Verified from your material</h3>
            {run.answer.facts.map((f, i) => (
              <p key={i}>
                {f.statement}{" "}
                {f.sourceIds.map((id) => {
                  const c = cite(id);
                  return c ? (
                    <a key={id} className="cite-chip" href={`/api/documents/${c.documentId}/source?page=${c.page}`} target="_blank" rel="noopener noreferrer">
                      <FileText className="ic" aria-hidden="true" /> {c.filename} · p. {c.page}
                    </a>
                  ) : null;
                })}
              </p>
            ))}
          </section>
        ) : null}
        {run.answer.suggestions.length ? (
          <section aria-label="Suggestions">
            <h3 className="answer-title">Suggestions</h3>
            <ul className="answer-checks">{run.answer.suggestions.map((s, i) => <li key={i}><Check className="ic" aria-hidden="true" /> {s}</li>)}</ul>
            <p className="answer-note">Suggestions are advice, not facts from your material.</p>
          </section>
        ) : null}
        {run.answer.clarifyingQuestion ? <p><strong>Question:</strong> {run.answer.clarifyingQuestion}</p> : null}
        {run.proposal ? (
          <p className="answer-draft">
            <Sparkles className="ic" aria-hidden="true" />
            <span>
              I drafted a {run.proposal.scenario} schedule that {run.proposal.feasible ? "fits your availability" : "doesn't fully fit"}. It is not saved.
              {run.proposal.selfCheck ? ` ${run.proposal.selfCheck.summary}` : ""}
              {run.proposal.status === "pending" ? " See “Awaiting your decision”." : ` Status: ${run.proposal.status}.`}
            </span>
          </p>
        ) : null}
        {onFollowUp && run.answer.followUps.length ? (
          <div className="follow-ups" role="group" aria-label="Ask a follow-up">
            {run.answer.followUps.map((f) => <button key={f} type="button" className="prompt-chip" onClick={() => onFollowUp(f)}>{f}</button>)}
          </div>
        ) : null}
        {run.status === "completed" ? <Thumbs kind="answer" refId={run.id} question="Was this answer helpful?" /> : null}
      </div>
    </div>
  );
}

type LiveAnswer = { facts: { statement: string; citations: RunCitation[] }[]; suggestions: string[]; clarifyingQuestion: string | null };
type LiveRun = { request: string; events: ToolEvent[]; answer: LiveAnswer };
const EMPTY_LIVE_ANSWER: LiveAnswer = { facts: [], suggestions: [], clarifyingQuestion: null };

function applyAnswerEvent(answer: LiveAnswer, e: AnswerStreamEvent): LiveAnswer {
  if (e.type === "reset") return EMPTY_LIVE_ANSWER;
  if (e.type === "fact") return { ...answer, facts: [...answer.facts, { statement: e.fact.statement, citations: e.citations }] };
  return { ...answer, suggestions: e.suggestions, clarifyingQuestion: e.clarifyingQuestion };
}

/** The answer as the model writes it. Facts appear only after their citation passed the check on the server. */
function LiveAnswerView({ answer }: { answer: LiveAnswer }) {
  if (!answer.facts.length && !answer.suggestions.length && !answer.clarifyingQuestion) return null;
  return (
    <div className="answer" data-testid="live-answer">
      <span className="answer-avatar" aria-hidden="true"><Leaf className="ic" /></span>
      <div className="answer-body">
        <div className="answer-eyebrow">CatchUp AI · Writing…</div>
        {answer.facts.length ? (
          <section aria-label="Checked facts so far">
            <h3 className="answer-title">Verified from your material</h3>
            {answer.facts.map((f, i) => (
              <p key={i}>
                {f.statement}{" "}
                {f.citations.map((c) => (
                  <span key={c.sourceId} className="cite-chip"><FileText className="ic" aria-hidden="true" /> {c.filename} · p. {c.page}</span>
                ))}
              </p>
            ))}
          </section>
        ) : null}
        {answer.suggestions.length ? (
          <section aria-label="Suggestions so far">
            <h3 className="answer-title">Suggestions</h3>
            <ul className="answer-checks">{answer.suggestions.map((x, i) => <li key={i}><Check className="ic" aria-hidden="true" /> {x}</li>)}</ul>
          </section>
        ) : null}
        {answer.clarifyingQuestion ? <p><strong>Question:</strong> {answer.clarifyingQuestion}</p> : null}
        <p className="answer-note">Facts appear only after their page citation is checked. The finished answer replaces this.</p>
      </div>
    </div>
  );
}

function Decision({ run, onDecided }: { run: AgentRunDto; onDecided: (status: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proposal = run.proposal!;
  async function reject() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/proposals/${proposal.id}/reject`, { method: "POST" });
      onDecided("rejected");
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't reject the draft.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card decision-card">
      <div className="label">Awaiting your decision</div>
      <h3>Draft plan · {proposal.feasible ? "fits your time" : "doesn't fit"}</h3>
      <p>{proposal.scenario[0].toUpperCase() + proposal.scenario.slice(1)} route drafted by the copilot. Nothing has been saved to your schedule.</p>
      <SelfCheckBadge check={proposal.selfCheck} />
      {error ? <p className="field-error">{error}</p> : null}
      <div className="decision-actions">
        <Link className="btn primary small" href={`/recovery?proposal=${proposal.id}`}><ArrowRight className="ic" aria-hidden="true" /> Review in lab</Link>
        <button type="button" className="btn small" onClick={reject} disabled={busy}><X className="ic" aria-hidden="true" /> Reject</button>
        <TrustDrawer proposalId={proposal.id} />
      </div>
    </div>
  );
}

export default function Copilot({
  initialRuns,
  initialThreadId = null,
  courses,
  runtime,
  rescue = null,
}: {
  initialRuns: AgentRunDto[];
  /** The conversation the initial runs belong to; the next message continues it. */
  initialThreadId?: string | null;
  courses: { id: string; title: string }[];
  runtime: { configured: boolean; kind: string; model: string | null };
  /** One-click Missed Class Rescue: run this request once on arrival. */
  rescue?: { prompt: string; courseId: string | null } | null;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [message, setMessage] = useState("");
  const [courseId, setCourseId] = useState<string>(rescue?.courseId ?? courses[0]?.id ?? "");
  const rescueStarted = useRef(false);
  const [live, setLive] = useState<LiveRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(initialRuns.at(-1)?.id ?? null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const running = live !== null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || running) return;
    setError(null);
    setLive({ request: trimmed, events: [], answer: EMPTY_LIVE_ANSWER });
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, courseId: courseId || null, threadId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "The copilot is unavailable.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split: number;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const event = /^event: (\w+)/m.exec(chunk)?.[1];
          const data = JSON.parse(/^data: (.*)$/m.exec(chunk)?.[1] ?? "null");
          if (event === "tool") setLive((l) => (l ? { ...l, events: [...l.events, data as ToolEvent] } : l));
          if (event === "answer") setLive((l) => (l ? { ...l, answer: applyAnswerEvent(l.answer, data as AnswerStreamEvent) } : l));
          if (event === "final") {
            const run = (data as { run: AgentRunDto }).run;
            setRuns((r) => [...r, run]);
            setSelectedRun(run.id);
            if (run.threadId) setThreadId(run.threadId);
            if (run.events.some((e) => e.tool === "suggest_memory" && e.status === "completed")) window.dispatchEvent(new Event("catchup:memories"));
          }
          if (event === "error") setError((data as { message: string }).message);
        }
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
      }
    } catch (e) {
      setError(controller.signal.aborted ? ERROR_TEXT.cancelled : e instanceof Error ? e.message : "The copilot failed.");
    } finally {
      setLive(null);
      abort.current = null;
    }
  }

  useEffect(() => {
    if (!rescue || !runtime.configured) return;
    // The guard lives inside the timer so Strict Mode's mount/unmount/mount still runs exactly once.
    const timer = setTimeout(() => {
      if (rescueStarted.current) return;
      rescueStarted.current = true;
      // Drop ?rescue=1 so a reload does not start a second run.
      window.history.replaceState(null, "", "/assistant");
      void send(rescue.prompt);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Starts a fresh conversation: earlier turns stay in history but are no longer sent as context. */
  function newChat() {
    setRuns([]);
    setThreadId(null);
    setSelectedRun(null);
    setError(null);
  }

  const shown = runs.find((r) => r.id === selectedRun);
  const lastRunId = runs.at(-1)?.id;
  const pending = [...runs].reverse().find((r) => r.proposal?.status === "pending") ?? null;

  return (
    <div className="assistant-layout">
      <div className="card chat-panel">
        <div className="chat-header">
          <div className="assistant-name">
            <BookOpen className="ic" aria-hidden="true" />
            <span>{courses.find((c) => c.id === courseId)?.title ?? "All courses"}</span>
            <Chip tone="good">{courseId ? "Active course" : "Every course"}</Chip>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {runtime.kind === "scripted" ? <Chip tone="warn">Scripted test model · not AI</Chip> : runtime.configured ? <Chip tone="good">{runtime.model}</Chip> : <Chip tone="warn">Not configured</Chip>}
            {runtime.configured && (runs.length > 0 || threadId) ? (
              <button type="button" className="btn small" onClick={newChat} disabled={running}><MessageSquarePlus className="ic" aria-hidden="true" /> New chat</button>
            ) : null}
          </div>
        </div>
        <div className="chat-scroll" ref={scroller} aria-live="polite" aria-busy={running}>
          {!runtime.configured ? (
            <Notice title="The AI runtime isn't configured on this server">
              The server has no AI model key yet (<code>GEMINI_API_KEY</code>, or <code>OPENAI_API_KEY</code> with <code>OPENAI_MODEL</code>). Until one is added the copilot can&apos;t run, and nothing here is simulated. The recovery lab&apos;s deterministic planner works without AI.
            </Notice>
          ) : runs.length === 0 && !running ? (
            <div className="chat-bubble">Tell me what you missed and what&apos;s due. I&apos;ll check your assignments, availability and course notes before suggesting anything — and I&apos;ll only draft plans for you to approve.</div>
          ) : null}
          {runs.map((run) => (
            <div key={run.id} style={{ display: "grid", gap: 10 }} onFocus={() => setSelectedRun(run.id)} onMouseEnter={() => setSelectedRun(run.id)}>
              <div className="chat-bubble user">{run.request}</div>
              <AnswerView run={run} onFollowUp={run.id === lastRunId && !running ? (text) => void send(text) : undefined} />
            </div>
          ))}
          {live ? <div className="chat-bubble user">{live.request}</div> : null}
          {live ? <LiveAnswerView answer={live.answer} /> : null}
          {error ? <Notice tone="danger" title={error} /> : null}
        </div>
        {runtime.configured ? (
          <>
            <div className="chat-prompt-pills">
              {PROMPTS.map((p) => <button key={p} type="button" className="prompt-chip" onClick={() => send(p)} disabled={running}>{p}</button>)}
            </div>
            <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); void send(message); }} aria-label="Message the copilot">
              <label className="visually-hidden" htmlFor="copilot-course">Course scope</label>
              <select id="copilot-course" className="select" style={{ width: "auto", maxWidth: 150, padding: "6px 8px", fontSize: 11 }} value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={running}>
                <option value="">All courses</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <label className="visually-hidden" htmlFor="chat-input">Message CatchUp Copilot</label>
              <input id="chat-input" placeholder="Ask a follow-up about your coursework…" autoComplete="off" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} disabled={running} />
              {running ? (
                <button type="button" aria-label="Stop" onClick={() => abort.current?.abort()}><Square className="ic" aria-hidden="true" /></button>
              ) : (
                <button type="submit" aria-label="Send message" disabled={message.trim().length < 3}><ArrowRight className="ic" aria-hidden="true" /></button>
              )}
            </form>
            <p className="chat-disclaimer">Drafts only. Nothing is saved until you approve it in the Recovery lab.</p>
          </>
        ) : null}
      </div>
      <div className="agent-side">
        <div className="card tool-timeline">
          <div className="split-head"><h3>Agent activity</h3><Chip tone={running ? "warn" : "good"}>{running ? "Live" : shown ? (shown.status === "failed" ? "Failed" : "Complete") : "Idle"}</Chip></div>
          <Timeline events={live ? live.events : (shown?.events ?? [])} running={running} />
          {!live && shown?.meta.model && shown.status !== "running" ? (
            <p className="trust-meta">Ran on <b>{shown.meta.model}</b>{fallbackNote(shown.meta) ? ` (${fallbackNote(shown.meta)})` : ""}{shown.meta.durationMs !== null ? ` · ${(shown.meta.durationMs / 1000).toFixed(1)} s` : ""}{(shown.meta.inputTokens ?? 0) + (shown.meta.outputTokens ?? 0) > 0 ? ` · ${((shown.meta.inputTokens ?? 0) + (shown.meta.outputTokens ?? 0)).toLocaleString("en-GB")} tokens` : ""}</p>
          ) : null}
          {!live && shown && shown.status !== "running" ? <p className="trust-meta"><Link href={`/runs/${shown.id}`}>Full trace</Link></p> : null}
          {!live && shown?.status === "failed" ? <p className="field-error" style={{ marginTop: 8 }}><OctagonX className="ic" aria-hidden="true" style={{ display: "inline", width: 12 }} /> Run failed: {shown.errorCode}</p> : null}
        </div>
        {pending ? (
          <Decision key={pending.id} run={pending} onDecided={(status) => setRuns((list) => list.map((r) => (r.id === pending.id && r.proposal ? { ...r, proposal: { ...r.proposal, status } } : r)))} />
        ) : (
          <div className="card decision-card">
            <div className="label">Proposed next step</div>
            <h3>Your path back, clearly mapped.</h3>
            <p>The recovery lab compares routes and never writes changes without your approval.</p>
            <div className="decision-actions"><Link className="btn primary small" href="/recovery">Open recovery lab <ArrowRight className="ic" aria-hidden="true" /></Link></div>
          </div>
        )}
      </div>
    </div>
  );
}
