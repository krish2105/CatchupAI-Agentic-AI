/**
 * Recovery score timeline: for each day, the share of the active plan's blocks scheduled to end by that day
 * that were completed by then (cumulative, 0–100). null on days before any block was due. It measures
 * keeping up with your own approved plan; it is not a grade and nothing is estimated.
 */
export type ScoreTask = { endsAt: string; completedAt: string | null; status: string };
export type ScorePoint = { date: string; score: number | null; due: number; done: number };

export function recoveryScoreTimeline(tasks: ScoreTask[], days: string[], endOfDay: (date: string) => number): ScorePoint[] {
  const live = tasks.filter((t) => t.status !== "cancelled");
  return days.map((date) => {
    const end = endOfDay(date);
    const due = live.filter((t) => Date.parse(t.endsAt) <= end);
    const done = due.filter((t) => t.completedAt && Date.parse(t.completedAt) <= end).length;
    return { date, due: due.length, done, score: due.length ? Math.round((done / due.length) * 100) : null };
  });
}
