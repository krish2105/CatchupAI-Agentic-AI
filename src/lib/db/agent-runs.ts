import "server-only";
import { selfCheckPlan, type CheckablePlan, type SelfCheck } from "@/lib/planner/self-check";
import type { ToolEvent } from "@/lib/agents/context";
import type { AgentAnswer } from "@/lib/agents/recovery-agent";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export type RunCitation = { sourceId: string; documentId: string; filename: string; page: number; chunkId: string };
export type AgentRunDto = {
  id: string;
  courseId: string | null;
  request: string;
  status: "running" | "completed" | "failed";
  answer: AgentAnswer | null;
  events: ToolEvent[];
  citations: RunCitation[];
  errorCode: string | null;
  createdAt: string;
  /** The conversation the run belongs to (null for runs before conversations, or before migration 0024). */
  threadId: string | null;
  /** Which agent of the team did the run (the copilot is the Coach). */
  agent: string;
  proposal: { id: string; scenario: string; feasible: boolean; status: string; selfCheck: SelfCheck | null } | null;
  /** What actually ran: model, token counts and wall-clock time (null while running or when unknown). */
  meta: { model: string | null; inputTokens: number | null; outputTokens: number | null; durationMs: number | null; fallbackFrom: string | null; fallbackReason: string | null };
};

const BASE_SELECT = "id, course_id, request_text, status, summary, tool_events, citations, error_code, created_at, completed_at, model, input_tokens, output_tokens, fallback_from, fallback_reason, action_proposals(id, scenario, feasible, status, payload)";
const THREAD_SELECT = `${BASE_SELECT}, thread_id`;
const SELECT = `${THREAD_SELECT}, agent`;
/** Before migration 0025 a database has no agent_runs.agent, and before 0024 no thread_id: read without them. */
const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

type Row = {
  id: string; course_id: string | null; request_text: string; status: string; summary: string | null; tool_events: unknown; citations: unknown; error_code: string | null; created_at: string;
  completed_at: string | null; model: string | null; input_tokens: number | null; output_tokens: number | null; fallback_from: string | null; fallback_reason: string | null;
  thread_id?: string | null;
  agent?: string;
  action_proposals: { id: string; scenario: string; feasible: boolean; status: string; payload: unknown }[];
};

/** The payload stays on the server; the browser gets the self-check result only. */
function toRunProposal(p: Row["action_proposals"][number] | null): AgentRunDto["proposal"] {
  if (!p) return null;
  let selfCheck: SelfCheck | null = null;
  try {
    selfCheck = selfCheckPlan(p.payload as CheckablePlan);
  } catch {
    selfCheck = null;
  }
  return { id: p.id, scenario: p.scenario, feasible: p.feasible, status: p.status, selfCheck };
}

function toRun(r: Row): AgentRunDto {
  let answer: AgentAnswer | null = null;
  try {
    const raw = r.summary ? (JSON.parse(r.summary) as Partial<AgentAnswer>) : null;
    // Answers stored before scope and follow-ups existed read as in scope with none.
    answer = raw ? ({ ...raw, scope: raw.scope === "out_of_scope" ? "out_of_scope" : "catchup", followUps: Array.isArray(raw.followUps) ? raw.followUps : [] } as AgentAnswer) : null;
  } catch {
    answer = null;
  }
  return {
    id: r.id,
    courseId: r.course_id,
    request: r.request_text,
    status: r.status as AgentRunDto["status"],
    answer,
    events: (Array.isArray(r.tool_events) ? r.tool_events : []) as ToolEvent[],
    citations: (Array.isArray(r.citations) ? r.citations : []) as RunCitation[],
    errorCode: r.error_code,
    createdAt: r.created_at,
    threadId: r.thread_id ?? null,
    agent: r.agent ?? "coach",
    // After a model fallback a run can own two drafts: the first attempt's (expired) and the actionable one.
    proposal: toRunProposal(r.action_proposals.find((p) => p.status !== "expired") ?? r.action_proposals[0] ?? null),
    meta: {
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      durationMs: r.completed_at ? Date.parse(r.completed_at) - Date.parse(r.created_at) : null,
      fallbackFrom: r.fallback_from,
      fallbackReason: r.fallback_reason,
    },
  };
}

/** The latest runs, oldest first; with `threadId`, only that conversation's. */
export async function listAgentRuns(supabase: ServerSupabase, limit = 10, threadId: string | null = null): Promise<AgentRunDto[]> {
  // Only the Coach's runs are conversation turns; the Diagnostician's and Quizmaster's runs have their own traces.
  const query = (select: string, byThread: boolean, coachOnly: boolean) => {
    let q = supabase.from("agent_runs").select(select).order("created_at", { ascending: false }).limit(limit);
    if (coachOnly) q = q.eq("agent", "coach");
    return byThread && threadId ? q.eq("thread_id", threadId) : q;
  };
  let res = await query(SELECT, true, true);
  if (res.error && missingColumn(res.error)) res = await query(THREAD_SELECT, true, false);
  if (res.error && missingColumn(res.error)) res = await query(BASE_SELECT, false, false);
  if (res.error) throw fromDbError(res.error);
  return (res.data as unknown as Row[]).map(toRun).reverse();
}

export async function getAgentRun(supabase: ServerSupabase, id: string): Promise<AgentRunDto> {
  let res = await supabase.from("agent_runs").select(SELECT).eq("id", id).single();
  if (res.error && missingColumn(res.error)) res = await supabase.from("agent_runs").select(THREAD_SELECT).eq("id", id).single();
  if (res.error && missingColumn(res.error)) res = await supabase.from("agent_runs").select(BASE_SELECT).eq("id", id).single();
  if (res.error) throw fromDbError(res.error, "Run not found.");
  return toRun(res.data as unknown as Row);
}
