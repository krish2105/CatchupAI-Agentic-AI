/**
 * Evidence-based spaced revision with FSRS (Free Spaced Repetition Scheduler, ts-fsrs, default FSRS-5 weights).
 * Every graded answer to a concept is replayed in order as a review: a miss is "Again", a correct answer "Good".
 * FSRS keeps a memory model per concept (stability, difficulty) and schedules the next review when recall is
 * predicted to drop to 90%. Deterministic: no interval fuzz, whole days only (short-term learning steps off), and
 * only persisted, server-graded answers are used, so the same history always gives the same dates.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from "ts-fsrs";

export type GradedAnswer = { term: string; correct: boolean; at: string; courseId: string };
export type RevisionItem = {
  term: string;
  courseId: string;
  lastSeen: string;
  dueAt: string;
  due: boolean;
  misses: number;
  attempts: number;
  /** Days until recall is predicted to fall to 90%. */
  stability: number;
  /** FSRS difficulty, 1 (easy) to 10 (hard). */
  difficulty: number;
  intervalDays: number;
  /** Predicted probability of recalling it now, 0–1. */
  recall: number;
};

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false, request_retention: 0.9, maximum_interval: 365 }));
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

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
    let card: Card = createEmptyCard(new Date(sorted[0].at));
    for (const a of sorted) card = scheduler.next(card, new Date(a.at), a.correct ? Rating.Good : Rating.Again).card;
    const last = sorted[sorted.length - 1];
    const dueAt = card.due.getTime();
    items.push({
      term: last.term,
      courseId: last.courseId,
      lastSeen: last.at,
      dueAt: new Date(dueAt).toISOString(),
      due: dueAt <= now,
      misses: sorted.filter((a) => !a.correct).length,
      attempts: sorted.length,
      stability: round(card.stability),
      difficulty: round(card.difficulty),
      intervalDays: card.scheduled_days,
      recall: round(scheduler.get_retrievability(card, new Date(Math.max(now, Date.parse(last.at))), false) as number, 3),
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
