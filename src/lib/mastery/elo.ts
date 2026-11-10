/**
 * Concept mastery for the agent team (Diagnostician and Quizmaster). Pure and deterministic.
 * An Elo-style rating per student and concept (Pelánek 2016): after each answer the rating moves towards the
 * outcome by K × (outcome − expected), with K shrinking as attempts grow. A sure, correct answer counts more and a
 * guess counts less (confidence-weighted), and a sure, wrong answer is flagged, because confidently wrong ideas
 * need correcting first (Metcalfe 2017).
 */
export type MasteryStatus = "known" | "shaky" | "not_yet" | "confidently_wrong" | "untested";
export type Confidence = "sure" | "think" | "guess";

/** Question difficulty on the same scale as the student's rating. */
export const DIFFICULTY = { easy: -0.5, medium: 0, hard: 0.5 } as const;
const CONFIDENCE_WEIGHT: Record<Confidence, number> = { sure: 1.5, think: 1, guess: 0.5 };

export const expectedScore = (rating: number, difficulty: number) => 1 / (1 + Math.exp(-(rating - difficulty)));

export function updateRating(m: { rating: number; attempts: number }, item: { difficulty: number }, outcome: { correct: boolean; confidence: Confidence }) {
  const k = (0.8 / Math.sqrt(1 + m.attempts)) * (outcome.correct ? CONFIDENCE_WEIGHT[outcome.confidence] : 1);
  const rating = m.rating + k * ((outcome.correct ? 1 : 0) - expectedScore(m.rating, item.difficulty));
  return { rating: Math.round(rating * 1000) / 1000, attempts: m.attempts + 1 };
}

export function statusFor(m: { rating: number; attempts: number; correct: number; lastConfidentWrong: boolean }): MasteryStatus {
  if (m.attempts === 0) return "untested";
  if (m.lastConfidentWrong) return "confidently_wrong";
  if (m.rating >= 0.6 && m.correct >= 1) return "known";
  if (m.rating <= -0.3) return "not_yet";
  return "shaky";
}

/** The candidate whose expected success is closest to `target` (0.5 to measure, about 0.75 to practise). */
export function pickNext(candidates: { itemId: string; concept: string; difficulty: number }[], ratings: Map<string, number>, target: number): string | null {
  let best: { itemId: string; gap: number } | null = null;
  for (const c of candidates) {
    const gap = Math.abs(expectedScore(ratings.get(c.concept) ?? 0, c.difficulty) - target);
    if (!best || gap < best.gap) best = { itemId: c.itemId, gap };
  }
  return best?.itemId ?? null;
}

const BRIDGE_ORDER: Record<MasteryStatus, number> = { confidently_wrong: 0, not_yet: 1, shaky: 2, untested: 3, known: 99 };

/** "Where you are → where you need to be": the gaps in the order to work on them (known concepts are left out). */
export function bridge<T extends { concept: string; status: MasteryStatus }>(concepts: T[]): T[] {
  return concepts.filter((c) => c.status !== "known").sort((a, b) => BRIDGE_ORDER[a.status] - BRIDGE_ORDER[b.status]);
}

export const STATUS_LABEL: Record<MasteryStatus, string> = {
  known: "Known",
  shaky: "Shaky",
  not_yet: "Not yet",
  confidently_wrong: "Confidently wrong",
  untested: "Not checked yet",
};
