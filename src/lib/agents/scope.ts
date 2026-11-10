/**
 * The copilot only helps with the student's studies in CatchUp. The model marks each answer's scope; for anything
 * outside it the server replaces whatever the model wrote with one fixed reply, so an off-topic answer (a poem,
 * trivia, unrelated code) is never shown or stored, even if the model wrote it anyway. Pure.
 */
export const OUT_OF_SCOPE_REPLY =
  "I can only help with your studies in CatchUp: your courses, notes, deadlines, study time and plans. Try asking about an assignment, a topic from your notes or what to study first.";

export const FOLLOW_UP_LIMITS = { max: 3, maxChars: 120 } as const;

type ScopedAnswer = {
  scope: "catchup" | "out_of_scope";
  facts: { statement: string; sourceIds: string[] }[];
  suggestions: string[];
  clarifyingQuestion: string | null;
  followUps: string[];
};

/** Follow-up questions the student can click: trimmed, non-empty, short, no duplicates, at most three. */
export function sanitizeFollowUps(followUps: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of followUps) {
    const text = raw.replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    if (!text || text.length > FOLLOW_UP_LIMITS.maxChars || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === FOLLOW_UP_LIMITS.max) break;
  }
  return out;
}

export function enforceScope<T extends ScopedAnswer>(answer: T): T {
  if (answer.scope === "out_of_scope") return { ...answer, facts: [], suggestions: [OUT_OF_SCOPE_REPLY], clarifyingQuestion: null, followUps: [] };
  return { ...answer, followUps: sanitizeFollowUps(answer.followUps) };
}
