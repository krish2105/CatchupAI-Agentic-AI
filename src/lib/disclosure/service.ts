import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { DisclosureInput, DisclosurePlan, DisclosureRun } from "./build";

type Citation = { sourceId: string; filename: string; page: number };
type Summary = { scope?: string; facts?: { statement: string; sourceIds?: string[] }[]; suggestions?: string[] };

/**
 * Everything the AI-use disclosure lists, read through the student's own client (RLS): copilot runs with the
 * pages their facts cite, drafted plans and who drafted them, and copilot-suggested notes the student kept.
 */
export async function loadDisclosure(supabase: ServerSupabase, userId: string, now: number): Promise<DisclosureInput> {
  const [profile, runs, plans, memories] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", userId).single(),
    supabase.from("agent_runs").select("created_at, request_text, model, summary, citations").eq("status", "completed").order("created_at"),
    supabase.from("action_proposals").select("*").order("created_at"),
    supabase.from("copilot_memories").select("text, created_at").eq("source", "copilot").eq("status", "confirmed").order("created_at"),
  ]);
  for (const r of [profile, runs, plans, memories]) if (r.error) throw fromDbError(r.error);

  const toRun = (r: { created_at: string; request_text: string; model: string | null; summary: string | null; citations: unknown }): DisclosureRun => {
    let summary: Summary = {};
    try {
      summary = r.summary ? (JSON.parse(r.summary) as Summary) : {};
    } catch {
      summary = {};
    }
    const cites = (Array.isArray(r.citations) ? r.citations : []) as Citation[];
    return {
      createdAt: r.created_at,
      question: r.request_text,
      model: r.model,
      offTopic: summary.scope === "out_of_scope",
      facts: (summary.facts ?? []).map((f) => ({
        statement: f.statement,
        sources: (f.sourceIds ?? []).map((id) => cites.find((c) => c.sourceId === id)).filter((c): c is Citation => Boolean(c)).map((c) => ({ filename: c.filename, page: c.page })),
      })),
      suggestions: summary.suggestions ?? [],
    };
  };
  // select("*") so the list still works on a database without the check-in columns (migration 0023).
  const toPlan = (p: Record<string, unknown>): DisclosurePlan => ({
    createdAt: String(p.created_at),
    origin: p.proactive === true ? "check-in" : p.run_id ? "copilot" : "student",
    scenario: String(p.scenario),
    status: String(p.status) === "pending" && Date.parse(String(p.expires_at)) <= now ? "expired" : String(p.status),
    decidedAt: (p.decided_at as string | null) ?? null,
  });
  return {
    generatedAt: new Date(now).toISOString(),
    timezone: profile.data!.timezone,
    runs: (runs.data ?? []).map(toRun),
    plans: ((plans.data ?? []) as Record<string, unknown>[]).map(toPlan),
    memories: (memories.data ?? []).map((m) => ({ text: m.text, createdAt: m.created_at })),
  };
}
