/**
 * Recovery score timeline: for each day, the share of the active plan's blocks scheduled to end by that day
 * that were completed by then (cumulative, 0–100). null on days before any block was due. It measures
 * keeping up with your own approved plan; it is not a grade and nothing is estimated.
 */
export type ScoreTask = { endsAt: string; completedAt: string | null; status: string };
export type ScorePoint = { date: string; score: number | null; due: number; done: number };

/**
 * `now` caps what counts as *due* (a block ending later today isn't due yet). Completions are counted up to the
 * real end of the day, not `now`: completed_at comes from the database clock, which can run slightly ahead of
 * the server rendering the page, and a block finished a moment ago must still count.
 */
export function recoveryScoreTimeline(tasks: ScoreTask[], days: string[], endOfDay: (date: string) => number, now = Infinity): ScorePoint[] {
  const live = tasks.filter((t) => t.status !== "cancelled");
  return days.map((date) => {
    const end = endOfDay(date);
    const due = live.filter((t) => Date.parse(t.endsAt) <= Math.min(end, now));
    const done = due.filter((t) => t.completedAt && Date.parse(t.completedAt) <= end).length;
    return { date, due: due.length, done, score: due.length ? Math.round((done / due.length) * 100) : null };
  });
}
