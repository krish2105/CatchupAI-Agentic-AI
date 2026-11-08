import { TOOL_LABEL } from "@/lib/agents/tool-labels";
import s1 from "../../../docs/evidence/agent-traces/S1-missed-lecture.json";
import s2 from "../../../docs/evidence/agent-traces/S2-overloaded-week.json";
import s3 from "../../../docs/evidence/agent-traces/S3-poisoned-notes.json";
import s4 from "../../../docs/evidence/agent-traces/S4-safe-failure.json";

const REPO = "krish2105/CatchupAI-Agentic-AI";

/** One trace as the agentic-scenarios eval writes it to docs/evidence/agent-traces/<id>.json. */
export type RawTrace = {
  scenario: string;
  title: string;
  model: string;
  ranAt: string;
  request: string;
  latencyMs: number;
  tokens: { input: number; output: number };
  status: string;
  errorCode: string | null;
  steps: { step: number; tool: string; args?: unknown; status: string; ms: number; outcome: string }[];
  answer: { facts: { statement: string; sources: string[] }[]; suggestions?: string[]; clarifyingQuestion?: string | null } | null;
  citations: string[];
  removedUnsupportedFacts: number;
  draft: { status: string; feasible: boolean; shortfallMinutes: number; savedWithoutApproval: boolean } | null;
};

export type Replay = {
  id: string;
  title: string;
  request: string;
  recordedAt: string;
  model: string;
  latencyMs: number;
  tokens: { input: number; output: number };
  status: "completed" | "failed";
  errorCode: string | null;
  steps: { tool: string; label: string; outcome: string; ms: number }[];
  /** Facts kept by the claim check; "course pages" = cited to retrieved pages, "tool data" = backed by this run's tool results. */
  facts: { statement: string; basis: "course pages" | "tool data" }[];
  suggestions: string[];
  clarifyingQuestion: string | null;
  citations: string[];
  removedFacts: number;
  draft: { feasible: boolean; shortfallMinutes: number; saved: boolean } | null;
  sourceUrl: string;
};

/** A recorded real-model run, shaped for the public replay page. Scripted (test-model) traces are refused. */
export function toReplay(t: RawTrace): Replay {
  if (/scripted/i.test(t.model)) throw new Error(`${t.scenario} is a scripted trace, not a real model run`);
  return {
    id: t.scenario,
    title: t.title,
    request: t.request,
    recordedAt: t.ranAt,
    model: t.model.replace(/^[a-z]+:/, ""),
    latencyMs: t.latencyMs,
    tokens: t.tokens,
    status: t.status === "completed" ? "completed" : "failed",
    errorCode: t.errorCode,
    steps: [...t.steps].sort((a, b) => a.step - b.step).map((s) => ({ tool: s.tool, label: TOOL_LABEL[s.tool] ?? s.tool, outcome: s.outcome, ms: s.ms })),
    facts: (t.answer?.facts ?? []).map((f) => ({ statement: f.statement, basis: f.sources.length ? "course pages" : "tool data" })),
    suggestions: t.answer?.suggestions ?? [],
    clarifyingQuestion: t.answer?.clarifyingQuestion ?? null,
    citations: t.citations,
    removedFacts: t.removedUnsupportedFacts,
    draft: t.draft && { feasible: t.draft.feasible, shortfallMinutes: t.draft.shortfallMinutes, saved: t.draft.savedWithoutApproval },
    sourceUrl: `https://github.com/${REPO}/blob/main/docs/evidence/agent-traces/${t.scenario}.json`,
  };
}

/** The latest real live run of each scenario, read from the committed traces at build time. */
export const REPLAYS: Replay[] = ([s1, s2, s3, s4] as RawTrace[]).map(toReplay);
