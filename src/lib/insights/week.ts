import "server-only";
import { fromDbError } from "@/lib/http/errors";
import { getPracticeEvidence } from "@/lib/quiz/service";
import type { ServerSupabase } from "@/lib/supabase/server";
import { weekStart, weeklyRecommendations, type Recommendation, type WeekStats } from "./reflection";

export type Reflection = { weekStart: string; wentWell: string; wasHard: string; nextFocus: string };
export type WeekReview = { weekStart: string; stats: WeekStats; recommendations: Recommendation[]; reflection: Reflection | null; history: Reflection[] };

/** This week's numbers from the student's own rows, the next steps they imply, and saved reflections. */
export async function getWeekReview(supabase: ServerSupabase, timezone: string, now: number): Promise<WeekReview> {
  const start = weekStart(now, timezone);
  const startMs = Date.parse(`${start}T00:00:00Z`) - 14 * 3600_000; // generous lower bound; refined by local day below
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));
  const inWeek = (iso: string) => dayKey(iso) >= start && Date.parse(iso) <= now + 7 * 86400_000 && dayKey(iso) < addDays(start, 7);
  const [tasks, focus, teach, deadlines, plan, reflections, practice] = await Promise.all([
    supabase.from("study_tasks").select("status, starts_at, ends_at").eq("active", true).neq("status", "cancelled").gte("ends_at", new Date(startMs).toISOString()),
    supabase.from("focus_sessions").select("focused_minutes, started_at").gte("started_at", new Date(startMs).toISOString()),
    supabase.from("teach_back_attempts").select("topic, coverage_percent, created_at").gte("created_at", new Date(startMs).toISOString()).order("created_at", { ascending: false }),
    supabase.from("assignments").select("id").neq("status", "completed").gte("due_at", new Date(now).toISOString()).lte("due_at", new Date(now + 7 * 86400_000).toISOString()),
    supabase.from("study_plans").select("id").eq("status", "active").maybeSingle(),
    supabase.from("weekly_reflections").select("week_start, went_well, was_hard, next_focus").order("week_start", { ascending: false }).limit(5),
    getPracticeEvidence(supabase, now),
  ]);
  for (const r of [tasks, focus, teach, deadlines, plan, reflections]) if (r.error) throw fromDbError(r.error);

  const week = (tasks.data ?? []).filter((t) => inWeek(t.starts_at));
  const latestByTopic = new Map<string, number>();
  for (const t of (teach.data ?? []).filter((t) => inWeek(t.created_at))) if (!latestByTopic.has(t.topic)) latestByTopic.set(t.topic, t.coverage_percent);
  const stats: WeekStats = {
    blocksCompleted: week.filter((t) => t.status === "completed").length,
    blocksMissed: week.filter((t) => t.status === "todo" && Date.parse(t.ends_at) <= now).length,
    blocksUpcoming: week.filter((t) => t.status === "todo" && Date.parse(t.ends_at) > now).length,
    focusMinutes: (focus.data ?? []).filter((f) => inWeek(f.started_at)).reduce((s, f) => s + f.focused_minutes, 0),
    dueRevision: practice.revision.filter((r) => r.due).length,
    weakExplanations: [...latestByTopic].filter(([, c]) => c < 60).map(([topic, coverage]) => ({ topic, coverage })),
    deadlinesNext7: deadlines.data?.length ?? 0,
    hasActivePlan: Boolean(plan.data),
  };
  const all = (reflections.data ?? []).map((r) => ({ weekStart: r.week_start, wentWell: r.went_well, wasHard: r.was_hard, nextFocus: r.next_focus }));
  return { weekStart: start, stats, recommendations: weeklyRecommendations(stats), reflection: all.find((r) => r.weekStart === start) ?? null, history: all.filter((r) => r.weekStart !== start).slice(0, 4) };
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function saveReflection(supabase: ServerSupabase, r: Reflection) {
  const { data, error } = await supabase
    .from("weekly_reflections")
    .upsert({ week_start: r.weekStart, went_well: r.wentWell, was_hard: r.wasHard, next_focus: r.nextFocus }, { onConflict: "owner_id,week_start" })
    .select("week_start, went_well, was_hard, next_focus")
    .single();
  if (error) throw fromDbError(error);
  return { weekStart: data.week_start, wentWell: data.went_well, wasHard: data.was_hard, nextFocus: data.next_focus };
}
