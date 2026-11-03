/**
 * Evidence-based spaced revision (Leitner-style, deterministic). Every graded answer moves a concept between
 * boxes: a miss resets it to box 0 (review in 1 day); each later correct answer promotes it (3, 7, 14 days).
 * Only persisted, server-graded answers are used.
 */
export type GradedAnswer = { term: string; correct: boolean; at: string; courseId: string };
export type RevisionItem = { term: string; courseId: string; box: number; lastSeen: string; dueAt: string; due: boolean; misses: number; attempts: number };

export const INTERVAL_DAYS = [1, 3, 7, 14] as const;

export function revisionSchedule(answers: GradedAnswer[], now: number): RevisionItem[] {
  const byTerm = new Map<string, GradedAnswer[]>();
  for (const a of answers) {
    const key = `${a.courseId}|${a.term.toLowerCase()}`;
    byTerm.set(key, [...(byTerm.get(key) ?? []), a]);
  }
  const items: RevisionItem[] = [];
  for (const list of byTerm.values()) {
    const sorted = [...list].sort((x, y) => x.at.localeCompare(y.at));
    // Concepts never missed are not scheduled: there is no evidence they need revision.
    if (!sorted.some((a) => !a.correct)) continue;
    let box = 0;
    for (const a of sorted) box = a.correct ? Math.min(box + 1, INTERVAL_DAYS.length - 1) : 0;
    const last = sorted[sorted.length - 1];
    const dueAt = Date.parse(last.at) + INTERVAL_DAYS[box] * 86400_000;
    items.push({
      term: last.term,
      courseId: last.courseId,
      box,
      lastSeen: last.at,
      dueAt: new Date(dueAt).toISOString(),
      due: dueAt <= now,
      misses: sorted.filter((a) => !a.correct).length,
      attempts: sorted.length,
    });
  }
  return items.sort((a, b) => Number(b.due) - Number(a.due) || a.dueAt.localeCompare(b.dueAt));
}

export type TopicProgress = { courseId: string; topic: string; baseline: number; latest: number; attempts: number; delta: number };

/** Baseline (first attempt) vs follow-up (latest attempt) per course + topic. */
export function topicProgress(attempts: { courseId: string; topic: string; score: number; at: string }[]): TopicProgress[] {
  const groups = new Map<string, typeof attempts>();
  for (const a of attempts) groups.set(`${a.courseId}|${a.topic}`, [...(groups.get(`${a.courseId}|${a.topic}`) ?? []), a]);
  return [...groups.values()].map((list) => {
    const sorted = [...list].sort((x, y) => x.at.localeCompare(y.at));
    const baseline = sorted[0].score;
    const latest = sorted[sorted.length - 1].score;
    return { courseId: sorted[0].courseId, topic: sorted[0].topic, baseline, latest, attempts: sorted.length, delta: Math.round((latest - baseline) * 100) / 100 };
  });
}
