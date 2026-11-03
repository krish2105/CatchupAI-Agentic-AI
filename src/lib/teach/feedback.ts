/**
 * Teach-It-Back: deterministic, evidence-grounded feedback on a student's own explanation (no AI).
 * Key concepts are the terms that recur across the passages retrieved for the topic; each concept is
 * checked against the explanation and cited to the exact page where the notes use it.
 */
import { sentences, terms, type Passage } from "@/lib/quiz/cloze";

export type ConceptCheck = {
  term: string;
  covered: boolean;
  citation: { documentId: string; filename: string; page: number };
  /** A sentence from the student's own notes that uses the concept. */
  quote: string | null;
};

export type TeachFeedback = {
  concepts: ConceptCheck[];
  coveragePercent: number;
  wordCount: number;
  level: "strong" | "developing" | "starting";
  missingTerms: string[];
};

const MAX_CONCEPTS = 8;
/** Common verbs and qualifiers that recur in notes but aren't concepts to explain. */
const FILLER = new Set(
  "check checks suggest suggests helps help means might could based given identify particular apparent basic large small whether outside inside different general specific important example examples following include includes including another simple".split(" "),
);
export const MIN_WORDS = 25;

/** Light stemmer so "residual", "residuals" and "residual's" match; plurals and common endings only. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']s$/, "");
  for (const suffix of ["ations", "ation", "ings", "ing", "ies", "es", "ed", "ly", "s"]) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = suffix === "ies" ? `${w.slice(0, -3)}y` : w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

export function analyseExplanation(explanation: string, passages: Passage[], topic: string): TeachFeedback {
  const words = explanation.trim().split(/\s+/).filter(Boolean);
  const said = new Set(terms(explanation).map(stem));
  // Every alphabetic word of the explanation also counts (terms() skips short words like "fit").
  for (const w of explanation.toLowerCase().match(/[a-z][a-z_-]{2,}/g) ?? []) said.add(stem(w));
  const topicStems = new Set(terms(topic).map(stem));

  // Concepts: terms appearing in the most passages (then most often), excluding the topic's own words.
  const df = new Map<string, { term: string; passages: number; count: number }>();
  // Count only body sentences: page headers ("APPLIED STATISTICS | MODULE 4") aren't concepts.
  const body = (p: Passage) => sentences(p.content).join(" ");
  for (const p of passages) {
    const all = terms(body(p)).filter((t) => !FILLER.has(t));
    for (const t of new Set(all)) {
      const key = stem(t);
      if (topicStems.has(key)) continue;
      const entry = df.get(key) ?? { term: t, passages: 0, count: 0 };
      entry.passages += 1;
      entry.count += all.filter((x) => stem(x) === key).length;
      df.set(key, entry);
    }
  }
  const ranked = [...df.entries()]
    .filter(([, e]) => e.count >= 2)
    .sort((a, b) => b[1].passages - a[1].passages || b[1].count - a[1].count || b[1].term.length - a[1].term.length)
    .slice(0, MAX_CONCEPTS);

  const concepts: ConceptCheck[] = ranked.map(([key, e]) => {
    const source = passages.find((p) => terms(body(p)).some((t) => stem(t) === key))!;
    const quote = sentences(source.content).find((s) => terms(s).some((t) => stem(t) === key)) ?? null;
    return {
      term: e.term,
      covered: said.has(key),
      citation: { documentId: source.documentId, filename: source.filename, page: source.page },
      quote,
    };
  });

  const covered = concepts.filter((c) => c.covered).length;
  const coveragePercent = concepts.length ? Math.round((covered / concepts.length) * 100) : 0;
  const level = words.length < MIN_WORDS ? "starting" : coveragePercent >= 75 ? "strong" : coveragePercent >= 40 ? "developing" : "starting";
  return { concepts, coveragePercent, wordCount: words.length, level, missingTerms: concepts.filter((c) => !c.covered).map((c) => c.term) };
}
