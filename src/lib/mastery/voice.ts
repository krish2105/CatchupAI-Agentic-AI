/**
 * Voice answers for the warm-up and practice: turns what the browser heard into an option and, if said, how sure
 * the student is. Pure: "B", "option c", "the first one", or the option's own words; "sure", "think", "guess".
 */
import type { Confidence } from "./elo";

const LETTERS: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
const ORDINALS: [RegExp, number][] = [
  [/\b(first|one)\b/, 0],
  [/\b(second|two)\b/, 1],
  [/\b(third|three)\b/, 2],
  [/\b(fourth|four|last)\b/, 3],
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function parseVoiceAnswer(heard: string, options: string[]): { chosen: number | null; confidence: Confidence | null } {
  const text = norm(heard);
  const confidence: Confidence | null = /\b(sure|certain|definitely)\b/.test(text) ? "sure" : /\bguess(ing)?\b/.test(text) ? "guess" : /\b(think|probably)\b/.test(text) ? "think" : null;
  // The option's own words win when most of them were said.
  let best: { index: number; score: number } | null = null;
  options.forEach((option, index) => {
    const words = norm(option).split(" ").filter((w) => w.length > 2);
    if (!words.length) return;
    const score = words.filter((w) => text.includes(w)).length / words.length;
    if (score >= 0.6 && (!best || score > best.score)) best = { index, score };
  });
  if (best) return { chosen: (best as { index: number }).index, confidence };
  const letter = /^(?:option |answer |letter )?([abcd])\b/.exec(text) ?? /\b(?:option|answer|letter) ([abcd])\b/.exec(text);
  if (letter) return { chosen: LETTERS[letter[1]], confidence };
  for (const [pattern, index] of ORDINALS) if (pattern.test(text)) return { chosen: index, confidence };
  return { chosen: null, confidence: null };
}
