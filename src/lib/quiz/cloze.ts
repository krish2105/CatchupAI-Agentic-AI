/**
 * Deterministic, evidence-grounded quiz generator (no AI). Each question is a sentence from the student's
 * own indexed notes with one key term blanked out; distractors are other key terms from the same course.
 * Every question carries the exact document/page it came from.
 */

export type Passage = { chunkId: string; documentId: string; filename: string; page: number; content: string };

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  evidence: { documentId: string; filename: string; page: number };
  term: string;
};

export type QuizKey = { questionId: string; correctIndex: number; explanation: string };

const STOPWORDS = new Set(
  "about above after again against because before being below between could does doing during each other should their there these those through under until where which while would about without within also into from have this that with your they them then than what when will more most some such only over very just make made many much must here know take like used uses using page module notes practice task write explain describe".split(" "),
);

/** Sentences from body text: heading lines ("·" separators, "PAGE n") are removed, wrapped lines re-joined. */
function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .filter((line) => !/·|\bPAGE \d/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 50 && s.length <= 260 && /^[A-Z]/.test(s) && /[.!?]$/.test(s));
}

function terms(text: string): string[] {
  return (text.match(/\b[A-Za-z][A-Za-z_-]{4,}\b/g) ?? []).map((t) => t.toLowerCase()).filter((t) => !STOPWORDS.has(t));
}

/** FNV-1a based deterministic PRNG so the same seed always yields the same quiz. */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10_000) / 10_000;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generateClozeQuiz(passages: Passage[], opts: { seed: string; count?: number; focusTerms?: string[] }): { questions: QuizQuestion[]; keys: QuizKey[] } {
  const count = opts.count ?? 5;
  const random = rng(opts.seed);
  // Course vocabulary: how many passages mention each term (key concepts recur).
  const df = new Map<string, number>();
  for (const p of passages) for (const t of new Set(terms(p.content))) df.set(t, (df.get(t) ?? 0) + 1);
  const vocabulary = [...df.keys()];

  type Candidate = { passage: Passage; sentence: string; term: string; score: number };
  const candidates: Candidate[] = [];
  for (const passage of passages) {
    for (const sentence of sentences(passage.content)) {
      const own = [...new Set(terms(sentence))];
      if (own.length < 3) continue;
      // Adaptive retest: a sentence containing a concept the student missed blanks exactly that concept.
      const focus = (opts.focusTerms ?? []).map((f) => f.toLowerCase()).find((f) => own.includes(f));
      // Otherwise prefer recurring course terms; break ties toward longer (more specific) words.
      const best = focus
        ? { t: focus, score: 10_000 + (df.get(focus) ?? 0) }
        : own.map((t) => ({ t, score: (df.get(t) ?? 0) * 10 + t.length })).sort((a, b) => b.score - a.score)[0];
      candidates.push({ passage, sentence, term: best.t, score: best.score });
    }
  }

  const questions: QuizQuestion[] = [];
  const keys: QuizKey[] = [];
  const usedTerms = new Set<string>();
  const usedSentences = new Set<string>();
  // Spread across pages: round-robin by page, strongest candidates first within a page.
  const byPage = new Map<string, Candidate[]>();
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    const k = `${c.passage.documentId}:${c.passage.page}`;
    byPage.set(k, [...(byPage.get(k) ?? []), c]);
  }
  const queues = [...byPage.values()];
  while (questions.length < count && queues.some((q) => q.length)) {
    for (const queue of queues) {
      if (questions.length >= count) break;
      const c = queue.shift();
      if (!c || usedTerms.has(c.term) || usedSentences.has(c.sentence)) continue;
      const distractors = shuffle(
        vocabulary.filter((t) => t !== c.term && !terms(c.sentence).includes(t) && Math.abs(t.length - c.term.length) <= 6),
        random,
      ).slice(0, 3);
      if (distractors.length < 3) continue;
      const pattern = new RegExp(`\\b${c.term.replace(/[-_]/g, "[-_]")}\\b`, "i");
      const prompt = c.sentence.replace(pattern, "_____");
      if (prompt === c.sentence) continue;
      const options = shuffle([c.term, ...distractors], random);
      const id = `q${questions.length + 1}`;
      questions.push({
        id,
        prompt,
        options,
        evidence: { documentId: c.passage.documentId, filename: c.passage.filename, page: c.passage.page },
        term: c.term,
      });
      keys.push({ questionId: id, correctIndex: options.indexOf(c.term), explanation: c.sentence });
      usedTerms.add(c.term);
      usedSentences.add(c.sentence);
    }
  }
  return { questions, keys };
}

export function gradeQuiz(questions: QuizQuestion[], keys: QuizKey[], answers: number[]) {
  const results = questions.map((q, i) => {
    const key = keys.find((k) => k.questionId === q.id)!;
    const chosen = answers[i];
    return {
      questionId: q.id,
      chosenIndex: Number.isInteger(chosen) ? chosen : -1,
      correctIndex: key.correctIndex,
      correct: chosen === key.correctIndex,
      explanation: key.explanation,
      evidence: q.evidence,
      term: q.term,
    };
  });
  const correct = results.filter((r) => r.correct).length;
  return { results, scorePercent: questions.length ? Math.round((correct / questions.length) * 10000) / 100 : 0, weakTerms: results.filter((r) => !r.correct).map((r) => r.term) };
}
