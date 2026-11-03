/**
 * Does the cited passage actually support the claim? A citation is not trusted just because its source id was
 * retrieved: the claim's content words must appear in the passage the model saw, every number in the claim must
 * appear there too, and quoted text must match verbatim. Deterministic and conservative: a claim that can't be
 * checked is treated as unsupported. It catches unrelated or invented citations; it does not prove the claim is
 * a correct reading of the passage (see RAG_QUALITY_REPORT.md for that limitation).
 */
import { terms } from "@/lib/quiz/cloze";
import { stem } from "@/lib/teach/feedback";

export const SUPPORT_THRESHOLD = 0.7;
const NEGATION = /^(?:not|no|never|cannot|isn't|aren't|doesn't|don't|didn't|won't)$/;
// "diffuse"/"diffuses" and "estimate"/"estimates" must meet: stem, then drop a final "e".
const key = (word: string) => stem(word).replace(/e$/, "");

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").replace(/…$/, "").trim();
const numbers = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => n.replace(/\.0+$/, ""));

export type Support = { supported: boolean; coverage: number; matched: string[]; missing: string[]; reason: string };

export function claimSupport(claim: string, passages: string[]): Support {
  const text = norm(passages.join(" \n "));
  // Quoted spans (straight or curly quotes, at least 12 characters) must appear in the passage.
  const quotes = [...claim.matchAll(/["“]([^"”]{12,})["”]/g)].map((m) => norm(m[1]).replace(/[….]+$/, ""));
  const badQuote = quotes.find((q) => !text.includes(q));
  if (badQuote) return { supported: false, coverage: 0, matched: [], missing: [badQuote.slice(0, 40)], reason: "quoted text not in the passage" };
  if (quotes.length) return { supported: true, coverage: 1, matched: quotes.map((q) => q.slice(0, 40)), missing: [], reason: "quote found verbatim" };

  const passageNumbers = new Set(numbers(text));
  const strayNumber = numbers(claim).find((n) => !passageNumbers.has(n));
  if (strayNumber) return { supported: false, coverage: 0, matched: [], missing: [strayNumber], reason: `number ${strayNumber} not in the passage` };

  const passageStems = new Set(terms(text).map(key));
  const claimStems = [...new Set(terms(claim).map(key))];
  if (claimStems.length === 0) return { supported: false, coverage: 0, matched: [], missing: [], reason: "nothing checkable in the claim" };
  const matched = claimStems.filter((t) => passageStems.has(t));
  const missing = claimStems.filter((t) => !passageStems.has(t));
  // A word the passage negates ("does not prove") can't support a claim that states it without a negation.
  const words = text.split(/[^a-z']+/).filter(Boolean);
  const negated = new Set(words.flatMap((w, i) => (NEGATION.test(w) ? words.slice(i + 1, i + 3).map(key) : [])));
  const claimNegates = claim.toLowerCase().split(/[^a-z']+/).some((w) => NEGATION.test(w));
  const flipped = !claimNegates && matched.find((t) => negated.has(t));
  if (flipped) return { supported: false, coverage: 0, matched, missing: [flipped], reason: `the passage negates "${flipped}"` };
  const coverage = matched.length / claimStems.length;
  const supported = coverage >= SUPPORT_THRESHOLD && (matched.length >= 2 || claimStems.length === 1);
  return { supported, coverage: Math.round(coverage * 100) / 100, matched, missing, reason: supported ? "content words found in the passage" : "too few of the claim's words are in the passage" };
}
