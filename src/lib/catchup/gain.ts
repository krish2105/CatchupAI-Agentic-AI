/**
 * Before/after learning gain for a catch-up pack (pure, client-safe). A pack's graded checks all carry the topic
 * "Catch-up: <file name>", so the first attempt is the pre-check and the latest the post-check, from the same
 * per-topic baseline/latest the practice arena already computes. Only real, server-graded attempts count.
 */
import type { TopicProgress } from "@/lib/quiz/revision";

export const PACK_PREFIX = "Catch-up: ";
export const packTopic = (filename: string) => `${PACK_PREFIX}${filename}`.slice(0, 160);

export type PackGain = { courseId: string; document: string; before: number; after: number | null; gain: number | null; attempts: number };

export function catchupGains(progress: TopicProgress[], opts: { includePending?: boolean } = {}): PackGain[] {
  return progress
    .filter((p) => p.topic.startsWith(PACK_PREFIX) && (p.attempts >= 2 || opts.includePending))
    .map((p) => ({
      courseId: p.courseId,
      document: p.topic.slice(PACK_PREFIX.length),
      before: p.baseline,
      after: p.attempts >= 2 ? p.latest : null,
      gain: p.attempts >= 2 ? p.delta : null,
      attempts: p.attempts,
    }));
}
