import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export type DayBucket = { date: string; minutes: number; blocks: number };
export type Insights = {
  latestQuiz: { score: number; topic: string; at: string } | null;
  quizAttempts: number;
  tasksCompleted: number;
  minutesCompleted: number;
  activePlan: { done: number; total: number } | null;
  days: DayBucket[];
  topicScores: { topic: string; latest: number; attempts: number }[];
  courseProgress: { courseId: string; title: string; done: number; total: number }[];
};

/** Every number is derived from persisted rows (completed tasks, graded attempts). Nothing is estimated. */
export async function getInsights(supabase: ServerSupabase, timezone: string, now: number): Promise<Insights> {
  const [tasksRes, attemptsRes, coursesRes] = await Promise.all([
    supabase.from("study_tasks").select("course_id, status, active, duration_minutes, completed_at"),
    supabase.from("quiz_attempts").select("score_percent, created_at, quizzes(topic)").order("created_at", { ascending: false }).limit(50),
    supabase.from("courses").select("id, title"),
  ]);
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

  return {
    latestQuiz: attempts[0] ? { score: attempts[0].score, topic: attempts[0].topic, at: attempts[0].at } : null,
    quizAttempts: attempts.length,
    tasksCompleted: completed.length,
    minutesCompleted: completed.reduce((s, t) => s + (t.duration_minutes ?? 0), 0),
    activePlan: active.length ? { done: active.filter((t) => t.status === "completed").length, total: active.length } : null,
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
