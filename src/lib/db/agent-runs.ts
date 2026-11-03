import "server-only";
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
  proposal: { id: string; scenario: string; feasible: boolean; status: string } | null;
};

const SELECT = "id, course_id, request_text, status, summary, tool_events, citations, error_code, created_at, action_proposals(id, scenario, feasible, status)";

type Row = {
  id: string; course_id: string | null; request_text: string; status: string; summary: string | null; tool_events: unknown; citations: unknown; error_code: string | null; created_at: string;
  action_proposals: { id: string; scenario: string; feasible: boolean; status: string }[];
};

function toRun(r: Row): AgentRunDto {
  let answer: AgentAnswer | null = null;
  try {
    answer = r.summary ? (JSON.parse(r.summary) as AgentAnswer) : null;
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
    proposal: r.action_proposals[0] ?? null,
  };
}

export async function listAgentRuns(supabase: ServerSupabase, limit = 10): Promise<AgentRunDto[]> {
  const { data, error } = await supabase.from("agent_runs").select(SELECT).order("created_at", { ascending: false }).limit(limit);
  if (error) throw fromDbError(error);
  return (data as unknown as Row[]).map(toRun).reverse();
}

export async function getAgentRun(supabase: ServerSupabase, id: string): Promise<AgentRunDto> {
  const { data, error } = await supabase.from("agent_runs").select(SELECT).eq("id", id).single();
  if (error) throw fromDbError(error, "Run not found.");
  return toRun(data as unknown as Row);
}
