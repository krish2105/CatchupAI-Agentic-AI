/**
 * "Listen" mode: a short two-voice lesson built only from the catch-up pack (no AI). A host asks plain questions;
 * the tutor answers ONLY with sentences from the lecture, each with its page. Pure and deterministic.
 */
import type { CatchupPack } from "./pack";

export type LessonLine = { speaker: "host" | "tutor"; text: string; page: number | null };

export function buildLesson(pack: Pick<CatchupPack, "summary" | "keyTerms">, filename: string): LessonLine[] {
  const title = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "this lecture";
  const lines: LessonLine[] = [{ speaker: "host", text: `Let's catch up on ${title}. What's the big idea?`, page: null }];
  const [first, ...rest] = pack.summary;
  if (first) lines.push({ speaker: "tutor", text: first.text, page: first.page });
  const used = new Set(first ? [first.text] : []);
  for (const term of pack.keyTerms.slice(0, 4)) {
    if (used.has(term.quote)) continue;
    used.add(term.quote);
    lines.push({ speaker: "host", text: `What does "${term.term}" mean here?`, page: null });
    lines.push({ speaker: "tutor", text: term.quote, page: term.page });
  }
  const more = rest.filter((s) => !used.has(s.text)).slice(0, 2);
  if (more.length) {
    lines.push({ speaker: "host", text: "Anything else from the lecture I shouldn't miss?", page: null });
    for (const s of more) lines.push({ speaker: "tutor", text: s.text, page: s.page });
  }
  lines.push({ speaker: "host", text: "Thanks. Next, take the 3-minute warm-up to see what stuck.", page: null });
  return lines;
}
