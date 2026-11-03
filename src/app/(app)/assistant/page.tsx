import type { Metadata } from "next";
import { Activity, ArrowRight, Sparkles } from "lucide-react";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, Chip, Notice } from "@/components/ui/primitives";
import { aiRuntimeStatus } from "@/lib/server/env";

export const metadata: Metadata = { title: "AI copilot" };

export default async function AssistantPage() {
  const ai = await aiRuntimeStatus();
  return (
    <>
      <PageHeading
        eyebrow="Your personal learning operator"
        title="AI copilot,"
        accent="on your side."
        accentColor="violet"
        description="The copilot reads your real deadlines, availability and course documents through permission-checked tools, cites the pages it used, and drafts a plan for you to review."
        actions={ai.configured ? <Chip tone="good">Runtime: {ai.model}</Chip> : <Chip tone="warn">AI runtime not configured</Chip>}
      />
      <div className="assistant-layout">
        <div className="card chat-panel">
          <div className="chat-header">
            <div className="assistant-name"><div className="ai-logo"><Sparkles className="ic" aria-hidden="true" /></div>CatchUp Copilot</div>
          </div>
          <div className="chat-scroll" aria-live="polite">
            {ai.configured ? (
              <div className="chat-bubble">Tell me what you missed and when things are due. I&apos;ll check your assignments, availability and course notes before suggesting anything.</div>
            ) : (
              <Notice title="The AI runtime isn't configured on this server">
                Add <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL</code> to <code>.env.local</code> and restart. Until then the copilot can&apos;t run — nothing here is simulated. The recovery lab&apos;s deterministic planner works without AI.
              </Notice>
            )}
          </div>
          <form className="chat-compose" aria-label="Message the copilot">
            <label className="visually-hidden" htmlFor="chat-input">Message CatchUp Copilot</label>
            <input id="chat-input" placeholder="Tell me what feels difficult right now…" autoComplete="off" maxLength={1000} disabled />
            <button type="submit" aria-label="Send message" disabled><ArrowRight className="ic" aria-hidden="true" /></button>
          </form>
        </div>
        <div className="agent-side">
          <div className="card tool-timeline">
            <div className="split-head"><h3>Agent activity</h3><Chip>From server logs</Chip></div>
            <div className="empty-state" style={{ padding: "10px 5px", textAlign: "left" }}>
              <Activity className="ic" aria-hidden="true" style={{ marginBottom: 8, color: "var(--aqua)" }} />
              No runs yet. Each tool the agent actually executes will appear here, with its outcome.
            </div>
          </div>
          <div className="card card-inner">
            <div className="label">Proposed next step</div>
            <h3 style={{ fontSize: 20, margin: "11px 0" }}>Your path back, clearly mapped.</h3>
            <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--muted)" }}>The recovery lab compares scenarios and never writes changes without your approval.</p>
            <ButtonLink href="/recovery" variant="primary" small style={{ marginTop: 18 }}>Open recovery lab <ArrowRight className="ic" aria-hidden="true" /></ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
