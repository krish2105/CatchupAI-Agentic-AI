"use client";

import { ArrowRight, CheckCircle2, CircleSlash, Lightbulb, OctagonX, Quote, Sparkles, Square, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import type { ToolEvent } from "@/lib/agents/context";
import type { AgentRunDto } from "@/lib/db/agent-runs";

const PROMPTS = [
  "I missed two classes. Help me catch up before my next deadline.",
  "What should I prioritise with the time I have this week?",
  "Explain residuals from my course notes.",
];

const TOOL_LABEL: Record<string, string> = {
  get_study_preferences: "Read your availability",
  list_assignments: "Listed your assignments",
  search_course_material: "Searched your course notes",
  get_learning_progress: "Checked your plan progress",
  draft_recovery_plan: "Drafted a plan (not saved)",
};

const ERROR_TEXT: Record<string, string> = {
  timeout: "The copilot took too long and was stopped. Nothing was changed.",
  cancelled: "You stopped this request. Nothing was changed.",
  max_turns: "The copilot hit its step limit. Nothing was changed; try a more specific question.",
  invalid_output: "The copilot returned an answer we couldn't verify, so it was discarded.",
  model_error: "The AI service failed. Nothing was changed. Try again in a moment.",
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

function AnswerView({ run }: { run: AgentRunDto }) {
  if (run.status === "failed") return <Notice tone="danger" title={ERROR_TEXT[run.errorCode ?? ""] ?? "The copilot failed. Nothing was changed."} />;
  if (!run.answer) return null;
  const cite = (id: string) => run.citations.find((c) => c.sourceId === id);
  return (
    <div className="chat-bubble" style={{ maxWidth: "100%", display: "grid", gap: 12 }}>
      {run.answer.facts.length ? (
        <section aria-label="From your course material and data">
          <div className="label" style={{ display: "flex", gap: 6, alignItems: "center" }}><Quote className="ic" aria-hidden="true" style={{ width: 13, height: 13 }} /> Verified from your material</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {run.answer.facts.map((f, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {f.statement}{" "}
                {f.sourceIds.map((id) => {
                  const c = cite(id);
                  return c ? (
                    <a key={id} className="chip" style={{ padding: "2px 7px", textDecoration: "none" }} href={`/api/documents/${c.documentId}/source?page=${c.page}`} target="_blank" rel="noopener noreferrer">
                      {c.filename} · p. {c.page}
                    </a>
                  ) : null;
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {run.answer.suggestions.length ? (
        <section aria-label="Suggestions">
          <div className="label" style={{ display: "flex", gap: 6, alignItems: "center" }}><Lightbulb className="ic" aria-hidden="true" style={{ width: 13, height: 13 }} /> Suggestions (advice, not facts)</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{run.answer.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>
      ) : null}
      {run.answer.clarifyingQuestion ? <p><strong>Question:</strong> {run.answer.clarifyingQuestion}</p> : null}
      {run.proposal ? (
        <div className="notice info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>
            <strong>Draft {run.proposal.scenario} plan · {run.proposal.feasible ? "fits your time" : "doesn't fit"}</strong>
            Not saved. {run.proposal.status === "pending" ? "Review it before anything is scheduled." : `Status: ${run.proposal.status}.`}
          </span>
          {run.proposal.status === "pending" ? (
            <Link className="btn small primary" href={`/recovery?proposal=${run.proposal.id}`}>Review in lab <ArrowRight className="ic" aria-hidden="true" /></Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function Copilot({
  initialRuns,
  courses,
  runtime,
  rescue = null,
}: {
  initialRuns: AgentRunDto[];
  courses: { id: string; title: string }[];
  runtime: { configured: boolean; kind: string; model: string | null };
  /** One-click Missed Class Rescue: run this request once on arrival. */
  rescue?: { prompt: string; courseId: string | null } | null;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [message, setMessage] = useState("");
  const [courseId, setCourseId] = useState<string>(rescue?.courseId ?? courses[0]?.id ?? "");
  const rescueStarted = useRef(false);
  const [live, setLive] = useState<{ request: string; events: ToolEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(initialRuns.at(-1)?.id ?? null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const running = live !== null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || running) return;
    setError(null);
    setLive({ request: trimmed, events: [] });
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, courseId: courseId || null }),
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
          if (event === "final") {
            const run = (data as { run: AgentRunDto }).run;
            setRuns((r) => [...r, run]);
            setSelectedRun(run.id);
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

  const shown = runs.find((r) => r.id === selectedRun);

  return (
    <div className="assistant-layout">
      <div className="card chat-panel">
        <div className="chat-header">
          <div className="assistant-name"><div className="ai-logo"><Sparkles className="ic" aria-hidden="true" /></div>CatchUp Copilot</div>
          {runtime.kind === "scripted" ? <Chip tone="warn">Scripted test model · not AI</Chip> : runtime.configured ? <Chip tone="good">{runtime.model}</Chip> : <Chip tone="warn">Not configured</Chip>}
        </div>
        <div className="chat-scroll" ref={scroller} aria-live="polite" aria-busy={running}>
          {!runtime.configured ? (
            <Notice title="The AI runtime isn't configured on this server">
              Add <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL</code> to <code>.env.local</code> and restart. Until then the copilot can&apos;t run — nothing here is simulated. The recovery lab&apos;s deterministic planner works without AI.
            </Notice>
          ) : runs.length === 0 && !running ? (
            <div className="chat-bubble">Tell me what you missed and what&apos;s due. I&apos;ll check your assignments, availability and course notes before suggesting anything — and I&apos;ll only draft plans for you to approve.</div>
          ) : null}
          {runs.map((run) => (
            <div key={run.id} style={{ display: "grid", gap: 10 }} onFocus={() => setSelectedRun(run.id)} onMouseEnter={() => setSelectedRun(run.id)}>
              <div className="chat-bubble user">{run.request}</div>
              <AnswerView run={run} />
            </div>
          ))}
          {live ? <div className="chat-bubble user">{live.request}</div> : null}
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
              <input id="chat-input" placeholder="Tell me what feels difficult right now…" autoComplete="off" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} disabled={running} />
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
          <div className="split-head"><h3>Agent activity</h3><Chip>{running ? "Live" : "From server logs"}</Chip></div>
          <Timeline events={live ? live.events : (shown?.events ?? [])} running={running} />
          {!live && shown?.status === "failed" ? <p className="field-error" style={{ marginTop: 8 }}><OctagonX className="ic" aria-hidden="true" style={{ display: "inline", width: 12 }} /> Run failed: {shown.errorCode}</p> : null}
        </div>
        <div className="card card-inner">
          <div className="label">Proposed next step</div>
          <h3 style={{ fontSize: 20, margin: "11px 0" }}>Your path back, clearly mapped.</h3>
          <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--muted)" }}>The recovery lab compares scenarios and never writes changes without your approval.</p>
          <Link className="btn primary small" style={{ marginTop: 18 }} href="/recovery">Open recovery lab <ArrowRight className="ic" aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  );
}
