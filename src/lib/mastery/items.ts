/**
 * Assessment questions for the agent team. Pure: validation of agent-written questions against the student's own
 * page, and a deterministic fill-the-gap fallback when no AI model is available or a question is rejected.
 */
import { z } from "zod";
import { claimSupport } from "@/lib/rag/claim-support";

export type Difficulty = "easy" | "medium" | "hard";
export type ItemDraft = { concept: string; prompt: string; options: string[]; answerIndex: number; page: number; difficulty: Difficulty; hint: string };
export type ConceptSource = { concept: string; page: number; quote: string };

/** What the Diagnostician and Quizmaster agents return (validated again item by item below). */
export const ItemsOutput = z.object({
  items: z.array(
    z.object({
      concept: z.string(),
      prompt: z.string(),
      options: z.array(z.string()),
      answerIndex: z.number().int(),
      page: z.number().int(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      hint: z.string(),
    }),
  ),
});

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

export function validateItem(item: ItemDraft, source: ConceptSource): { ok: true } | { ok: false; reason: "page" | "options" | "answer" | "prompt" | "unsupported" | "hint" } {
  if (item.page !== source.page) return { ok: false, reason: "page" };
  const options = item.options.map(norm);
  if (options.length !== 4 || options.some((o) => !o || o.length > 200) || new Set(options).size !== 4) return { ok: false, reason: "options" };
  if (!Number.isInteger(item.answerIndex) || item.answerIndex < 0 || item.answerIndex > 3) return { ok: false, reason: "answer" };
  if (norm(item.prompt).length < 8 || item.prompt.length > 600) return { ok: false, reason: "prompt" };
  const correct = item.options[item.answerIndex];
  const quote = norm(source.quote);
  const supported = quote.includes(norm(correct)) || claimSupport(correct, [source.quote]).coverage >= 0.6;
  if (!supported) return { ok: false, reason: "unsupported" };
  // A hint may point to the idea, never contain the answer itself.
  const hint = norm(item.hint);
  if (!hint || hint.length > 400 || (norm(correct).length > 3 && hint.includes(norm(correct)))) return { ok: false, reason: "hint" };
  return { ok: true };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A deterministic fill-the-gap question from the concept's own sentence, with other key terms as distractors. */
export function clozeItem(source: ConceptSource, otherTerms: string[], seed: string): ItemDraft | null {
  const distractors = [...new Set(otherTerms.map((t) => t.trim()).filter((t) => t && norm(t) !== norm(source.concept)))]
    .sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`))
    .slice(0, 3);
  if (distractors.length < 3) return null;
  const escaped = source.concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\w*`, "gi");
  if (!pattern.test(source.quote)) return null;
  const prompt = `Fill the gap (from page ${source.page}): ${source.quote.replace(pattern, "_____")}`;
  const answerIndex = hash(`${seed}:${source.concept}`) % 4;
  const options = [...distractors];
  options.splice(answerIndex, 0, source.concept);
  return { concept: source.concept, prompt, options, answerIndex, page: source.page, difficulty: "medium", hint: `Re-read page ${source.page} of the lecture and look for the missing key term.` };
}
