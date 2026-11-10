import "server-only";
import type { ToolEvent } from "@/lib/agents/context";
import { listAssignments } from "@/lib/db/assignments";
import { fromDbError } from "@/lib/http/errors";
import { STATUS_LABEL } from "@/lib/mastery/elo";
import { getMasteryMap, startPractice, type MasteryMap } from "@/lib/mastery/service";
import { logEvent } from "@/lib/observability/log";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * The Night Coach: a scheduled agent pipeline. Each night it looks at one student's own data, asks the Quizmaster
 * (an LLM agent with its own run) to prepare practice on the biggest gap, and leaves a morning brief of up to four
 * cards. It never saves a plan or changes mastery: every card links to something the student chooses to do.
 * Runs with the service role, so every read filters by this owner explicitly.
 */
export type BriefCard = {
  kind: "replan" | "deadline" | "warmup" | "practice" | "growth";
  agent: "Planner" | "Diagnostician" | "Quizmaster" | "Night Coach";
  title: string;
  body: string;
  href: string;
};
export type Brief = { id: string; briefOn: string; cards: BriefCard[]; runId: string | null; createdAt: string };
export type NightCoachResult = { available: boolean; considered: number; briefed: number; skipped: number; failed: number };

const DAY = 86_400_000;
const MAX_CARDS = 4;
const isMissing = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "42703" || e?.code === "PGRST204";
const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));

type Step = { tool: string; args: ToolEvent["args"]; run: () => Promise<{ outcome: string; card?: BriefCard | null }> };

async function stepsFor(admin: AdminSupabase, ownerId: string, now: number, today: string): Promise<Step[]> {
  const scoped = admin as unknown as ServerSupabase;
  const maps: { doc: { id: string; filename: string }; map: MasteryMap | null }[] = [];
  const loadMaps = async () => {
    if (maps.length) return maps;
    const { data: docs, error } = await admin.from("documents").select("id, filename").eq("owner_id", ownerId).eq("status", "ready").order("created_at", { ascending: false }).limit(6);
    if (error) throw fromDbError(error);
    for (const doc of docs ?? []) maps.push({ doc, map: await getMasteryMap(scoped, doc.id).catch(() => null) });
    return maps;
  };

  return [
    {
      tool: "read_checkin",
      args: {},
      run: async () => {
        const { data } = await admin.from("action_proposals").select("id, reason").eq("owner_id", ownerId).eq("checkin_on", today).eq("status", "pending").limit(1);
        const draft = data?.[0];
        return draft
          ? { outcome: "a re-plan is waiting", card: { kind: "replan", agent: "Planner", title: "I re-planned your week", body: `${draft.reason ?? "Your plan slipped"}. The new draft is waiting; nothing changes until you approve it.`, href: "/recovery" } }
          : { outcome: "no re-plan needed" };
      },
    },
    {
      tool: "check_deadlines",
      args: { days: 3 },
      run: async () => {
        const assignments = await listAssignments(scoped, { ownerId });
        const soon = assignments
          .filter((a) => a.status !== "completed" && Date.parse(a.dueAt) > now && Date.parse(a.dueAt) <= now + 3 * DAY)
          .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
        const next = soon[0];
        return next
          ? { outcome: `${soon.length} due in 3 days`, card: { kind: "deadline", agent: "Night Coach", title: `${next.title} is due ${dayLabel(next.dueAt)}`, body: soon.length > 1 ? `And ${soon.length - 1} more this week. Check today's blocks in your schedule.` : "Check today's blocks in your schedule.", href: "/planner" } }
          : { outcome: "nothing due in 3 days" };
      },
    },
    {
      tool: "find_unchecked_lecture",
      args: {},
      run: async () => {
        const untested = (await loadMaps()).find((m) => m.map && !m.map.tested);
        return untested
          ? { outcome: `1 lecture not checked`, card: { kind: "warmup", agent: "Diagnostician", title: `Check what you know: ${untested.doc.filename}`, body: "A 3-minute warm-up from this lecture's own pages finds where you are before you study.", href: `/catch-up?doc=${untested.doc.id}` } }
          : { outcome: "every lecture checked" };
      },
    },
    {
      tool: "ask_quizmaster",
      args: {},
      run: async () => {
        const withGap = (await loadMaps()).find((m) => m.map && m.map.tested && m.map.bridge.length);
        if (!withGap) return { outcome: "no gaps to practise" };
        const top = withGap.map!.bridge[0];
        const session = await startPractice({ supabase: scoped, admin, userId: ownerId, documentId: withGap.doc.id, mode: "practice" });
        return {
          outcome: `Quizmaster prepared ${session.items.length} questions`,
          card: { kind: "practice", agent: "Quizmaster", title: `5-minute practice on ${top.concept} is ready`, body: `You were ${STATUS_LABEL[top.status].toLowerCase()} on it (page ${top.page}). The Quizmaster prepared ${session.items.length} questions overnight, with hints before answers.`, href: `/catch-up?doc=${withGap.doc.id}&session=${session.sessionId}` },
        };
      },
    },
    {
      tool: "plan_growth",
      args: {},
      run: async () => {
        const all = await loadMaps();
        const mastered = all.find((m) => m.map && m.map.concepts.length && m.map.concepts.every((c) => c.status === "known"));
        if (!mastered) return { outcome: "no lecture fully known yet" };
        const next = all.find((m) => m.map && !m.map.tested);
        return {
          outcome: "suggested what to learn next",
          card: next
            ? { kind: "growth", agent: "Night Coach", title: `You know all of ${mastered.doc.filename}. Next: ${next.doc.filename}`, body: "Keep growing: check the next lecture, then practise its gaps.", href: `/catch-up?doc=${next.doc.id}` }
            : { kind: "growth", agent: "Night Coach", title: `You know all of ${mastered.doc.filename}`, body: "Ready for exam conditions? Try a timed rehearsal (45 seconds a question, no hints).", href: `/catch-up?doc=${mastered.doc.id}` },
        };
      },
    },
  ];
}

/** Builds and stores one student's brief for `today` (replacing it when `replace`), recorded as a Night Coach run. */
export async function briefStudent({ admin, ownerId, now, replace = false }: { admin: AdminSupabase; ownerId: string; now: number; replace?: boolean }): Promise<Brief | null> {
  const today = new Date(now).toISOString().slice(0, 10);
  if (replace) await admin.from("coach_briefs").delete().eq("owner_id", ownerId).eq("brief_on", today);
  else {
    const { data: existing } = await admin.from("coach_briefs").select("id").eq("owner_id", ownerId).eq("brief_on", today).limit(1);
    if (existing?.length) return null;
  }
  const { data: run, error } = await admin
    .from("agent_runs")
    .insert({ owner_id: ownerId, request_text: "Night Coach: overnight check of deadlines, gaps and plan", status: "running", model: "night-coach-pipeline", agent: "night_coach" })
    .select("id")
    .single();
  if (error) throw fromDbError(error);

  const events: ToolEvent[] = [];
  const cards: BriefCard[] = [];
  for (const step of await stepsFor(admin, ownerId, now, today)) {
    const started = Date.now();
    try {
      const { outcome, card } = await step.run();
      events.push({ tool: step.tool, status: "completed", startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, args: step.args, outcome });
      if (card && cards.length < MAX_CARDS) cards.push(card);
    } catch {
      events.push({ tool: step.tool, status: "failed", startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, args: step.args, outcome: "Step failed; skipped." });
    }
  }
  const summary = cards.length ? `Morning brief: ${cards.length} card${cards.length === 1 ? "" : "s"}` : "Nothing needed today";
  await admin.from("agent_runs").update({ status: "completed", completed_at: new Date().toISOString(), summary, tool_events: events as unknown as Json }).eq("id", run.id).eq("owner_id", ownerId);
  const { data: brief, error: briefError } = await admin
    .from("coach_briefs")
    .insert({ owner_id: ownerId, brief_on: today, cards: cards as unknown as Json, run_id: run.id })
    .select("id, brief_on, cards, run_id, created_at")
    .single();
  if (briefError?.code === "23505") return null;
  if (briefError) throw fromDbError(briefError);
  logEvent("info", "agent.run", { runId: run.id, agent: "night_coach", status: "completed", cards: cards.length, steps: events.length });
  return { id: brief.id, briefOn: brief.brief_on, cards: brief.cards as unknown as BriefCard[], runId: brief.run_id, createdAt: brief.created_at };
}

/**
 * The nightly run (from the daily cron): students with a lecture or a plan, skipping demo accounts, students who
 * turned check-ins off, and anyone already briefed today.
 */
export async function runNightCoach({ admin, now, ownerIds }: { admin: AdminSupabase; now: number; ownerIds?: string[] }): Promise<NightCoachResult> {
  const result: NightCoachResult = { available: true, considered: 0, briefed: 0, skipped: 0, failed: 0 };
  const probe = await admin.from("coach_briefs").select("id").limit(1);
  if (probe.error) {
    if (isMissing(probe.error)) return { ...result, available: false };
    throw fromDbError(probe.error);
  }
  let docs = admin.from("documents").select("owner_id").eq("status", "ready").limit(1000);
  let plans = admin.from("study_plans").select("owner_id").eq("status", "active").limit(1000);
  if (ownerIds) {
    docs = docs.in("owner_id", ownerIds);
    plans = plans.in("owner_id", ownerIds);
  }
  const [d, p] = await Promise.all([docs, plans]);
  const owners = [...new Set([...(d.data ?? []), ...(p.data ?? [])].map((r) => r.owner_id))].slice(0, 300);
  result.considered = owners.length;
  for (const ownerId of owners) {
    try {
      const { data: account } = await admin.auth.admin.getUserById(ownerId);
      const { data: prefs } = await admin.from("notification_prefs").select("proactive_checkin").eq("owner_id", ownerId).maybeSingle();
      if (!account?.user || account.user.is_anonymous || prefs?.proactive_checkin === false) {
        result.skipped++;
        continue;
      }
      if (await briefStudent({ admin, ownerId, now })) result.briefed++;
      else result.skipped++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

/** The latest brief from the last two days, for the dashboard. */
export async function latestBrief(supabase: ServerSupabase, now: number): Promise<Brief | null> {
  const since = new Date(now - DAY).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("coach_briefs").select("id, brief_on, cards, run_id, created_at").gte("brief_on", since).order("brief_on", { ascending: false }).limit(1);
  if (error) {
    if (isMissing(error)) return null;
    throw fromDbError(error);
  }
  const b = data?.[0];
  return b ? { id: b.id, briefOn: b.brief_on, cards: b.cards as unknown as BriefCard[], runId: b.run_id, createdAt: b.created_at } : null;
}
