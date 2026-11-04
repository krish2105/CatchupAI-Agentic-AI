import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { recoveryScoreTimeline, type ScorePoint } from "@/lib/insights/recovery-score";

export type DayBucket = { date: string; minutes: number; blocks: number };
export type Insights = {
  latestQuiz: { score: number; topic: string; at: string } | null;
  quizAttempts: number;
  tasksCompleted: number;
  minutesCompleted: number;
  activePlan: { done: number; total: number } | null;
  focusMinutes14d: number;
  focusSessions14d: number;
  days: DayBucket[];
  topicScores: { topic: string; latest: number; attempts: number }[];
  courseProgress: { courseId: string; title: string; done: number; total: number }[];
  recoveryScore: ScorePoint[];
};

/** Every number is derived from persisted rows (completed tasks, graded attempts). Nothing is estimated. */
export async function getInsights(supabase: ServerSupabase, timezone: string, now: number): Promise<Insights> {
  const [tasksRes, attemptsRes, coursesRes, focusRes] = await Promise.all([
    supabase.from("study_tasks").select("course_id, status, active, duration_minutes, completed_at, ends_at"),
    supabase.from("quiz_attempts").select("score_percent, created_at, quizzes(topic)").order("created_at", { ascending: false }).limit(50),
    supabase.from("courses").select("id, title"),
    supabase.from("focus_sessions").select("focused_minutes").gte("started_at", new Date(now - 14 * 86400_000).toISOString()),
  ]);
  if (focusRes.error) throw fromDbError(focusRes.error);
  if (tasksRes.error) throw fromDbError(tasksRes.error);
  if (attemptsRes.error) throw fromDbError(attemptsRes.error);
  if (coursesRes.error) throw fromDbError(coursesRes.error);

  const completed = tasksRes.data.filter((t) => t.status === "completed" && t.completed_at);
  const dayKey = (iso: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));
  const days: DayBucket[] = Array.from({ length: 14 }, (_, i) => ({ date: dayKey(now - (13 - i) * 86400_000), minutes: 0, blocks: 0 }));
  for (const t of completed) {
    const bucket = days.find((d) => d.date === dayKey(t.completed_at!));
    if (bucket) {
      bucket.minutes += t.duration_minutes ?? 0;
      bucket.blocks += 1;
    }
  }

  const active = tasksRes.data.filter((t) => t.active && t.status !== "cancelled");
  const attempts = attemptsRes.data.map((a) => ({ score: Number(a.score_percent), at: a.created_at, topic: (a.quizzes as unknown as { topic: string } | null)?.topic ?? "Quiz" }));
  const topics = new Map<string, { latest: number; attempts: number }>();
  for (const a of attempts) {
    const existing = topics.get(a.topic);
    topics.set(a.topic, existing ? { ...existing, attempts: existing.attempts + 1 } : { latest: a.score, attempts: 1 });
  }

  // End of each local day, found by stepping hours (handles any UTC offset, including DST days).
  const endOfDay = (date: string) => {
    let t = Date.parse(`${date}T12:00:00Z`) - 36 * 3600_000;
    while (dayKey(t) <= date) t += 3600_000;
    while (dayKey(t - 60_000) > date) t -= 60_000;
    return t - 1;
  };
  const recoveryScore = recoveryScoreTimeline(
    active.map((t) => ({ endsAt: t.ends_at, completedAt: t.completed_at, status: t.status })),
    days.map((d) => d.date),
    endOfDay,
    now,
  );

  return {
    recoveryScore,
    latestQuiz: attempts[0] ? { score: attempts[0].score, topic: attempts[0].topic, at: attempts[0].at } : null,
    quizAttempts: attempts.length,
    tasksCompleted: completed.length,
    minutesCompleted: completed.reduce((s, t) => s + (t.duration_minutes ?? 0), 0),
    activePlan: active.length ? { done: active.filter((t) => t.status === "completed").length, total: active.length } : null,
    focusMinutes14d: focusRes.data.reduce((s, f) => s + f.focused_minutes, 0),
    focusSessions14d: focusRes.data.length,
    days,
    topicScores: [...topics.entries()].map(([topic, v]) => ({ topic, ...v })).slice(0, 6),
    courseProgress: coursesRes.data
      .map((c) => {
        const own = active.filter((t) => t.course_id === c.id);
        return { courseId: c.id, title: c.title, done: own.filter((t) => t.status === "completed").length, total: own.length };
      })
      .filter((c) => c.total > 0),
  };
}

