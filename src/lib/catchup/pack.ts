/**
 * Missed Lecture Catch-up Pack: a deterministic study pack built only from the lecture's own pages (no AI).
 * Summary sentences, key terms and self-check questions each carry the page they came from.
 */
import { generateClozeQuiz, sentences, terms, type Passage } from "@/lib/quiz/cloze";
import { stem } from "@/lib/teach/feedback";

export type PackSentence = { text: string; page: number };
export type PackTerm = { term: string; page: number; quote: string };
export type PackQuestion = { prompt: string; options: string[]; answer: string; page: number };
export type CatchupPack = {
  summary: PackSentence[];
  keyTerms: PackTerm[];
  questions: PackQuestion[];
  plan: { title: string; minutes: number }[];
  pages: number;
};

const FILLER = new Set("check suggest suggests helps help means might could based given identify particular apparent basic large small whether different general specific important example examples following include includes another simple".split(" "));

export function buildPack(passages: Passage[], seed: string): CatchupPack {
  const pageSentences = passages.flatMap((p) => sentences(p.content).map((text) => ({ text, page: p.page })));
  // Term weight = how often a (stemmed) term appears across the lecture; it rewards the lecture's main ideas.
  const freq = new Map<string, { term: string; count: number }>();
  for (const s of pageSentences) {
    for (const t of terms(s.text)) {
      if (FILLER.has(t)) continue;
      const key = stem(t);
      const e = freq.get(key) ?? { term: t, count: 0 };
      e.count += 1;
      freq.set(key, e);
    }
  }
  const weight = (text: string) => {
    const own = [...new Set(terms(text).map(stem))];
    return own.reduce((sum, k) => sum + Math.max(0, (freq.get(k)?.count ?? 0) - 1), 0) / Math.sqrt(own.length || 1);
  };

  // Summary: the strongest sentence of each page first (coverage), then the next strongest, kept in page order.
  const byPage = new Map<number, { text: string; page: number; w: number }[]>();
  for (const s of pageSentences) byPage.set(s.page, [...(byPage.get(s.page) ?? []), { ...s, w: weight(s.text) }]);
  for (const list of byPage.values()) list.sort((a, b) => b.w - a.w);
  const picked: { text: string; page: number; w: number }[] = [];
  for (let round = 0; picked.length < 6 && round < 3; round++) {
    for (const list of byPage.values()) if (list[round] && picked.length < 6) picked.push(list[round]);
  }
  const summary = picked.sort((a, b) => a.page - b.page || pageSentences.findIndex((s) => s.text === a.text) - pageSentences.findIndex((s) => s.text === b.text)).map(({ text, page }) => ({ text, page }));

  const keyTerms: PackTerm[] = [...freq.entries()]
    .filter(([, e]) => e.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].term.length - a[1].term.length)
    .slice(0, 8)
    .map(([key, e]) => {
      const where = pageSentences.find((s) => terms(s.text).some((t) => stem(t) === key))!;
      return { term: e.term, page: where.page, quote: where.text };
    });

  const quiz = generateClozeQuiz(passages, { seed, count: 5 });
  const questions = quiz.questions.map((q) => ({ prompt: q.prompt, options: q.options, answer: q.term, page: q.evidence.page }));

  const pages = new Set(passages.map((p) => p.page)).size;
  const read = Math.min(15, Math.max(5, pages * 3));
  return {
    summary,
    keyTerms,
    questions,
    plan: [
      { title: "Read the summary and the cited pages", minutes: read },
      { title: "Learn the key terms (say each one aloud)", minutes: 10 },
      { title: "Answer the check questions, then re-read what you missed", minutes: 10 },
    ],
    pages,
  };
}
