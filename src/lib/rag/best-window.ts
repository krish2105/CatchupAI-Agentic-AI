/**
 * The part of a retrieved passage the copilot sees. Chunks are up to ~2,400 characters but only `size` characters
 * go to the model (and to the claim check), so take the window with the most question words instead of always the
 * first characters. Deterministic: ties keep the earliest window; windows start and end on word boundaries.
 */
const STOP = new Set(["the", "and", "for", "are", "was", "what", "how", "why", "when", "which", "who", "with", "from", "that", "this", "does", "about", "into", "your", "you", "can", "explain", "tell", "show", "give", "notes", "course", "page"]);

/** Lower-case word stems of the question (first 5 letters), without short and common words. */
function terms(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words.filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => w.slice(0, 5)))];
}

export function bestWindow(text: string, query: string, size: number): string {
  if (text.length <= size) return text;
  const wanted = terms(query);
  const lower = text.toLowerCase();
  let bestStart = 0;
  let bestScore = 0;
  if (wanted.length) {
    // Candidate starts: every word start (cheap enough for one chunk; scored by distinct terms, then term count).
    const starts = [0];
    for (const m of lower.matchAll(/[\s(]([\p{L}\p{N}])/gu)) if (m.index !== undefined) starts.push(m.index + 1);
    for (const start of starts) {
      if (start > text.length - Math.floor(size / 2)) break;
      const slice = lower.slice(start, start + size);
      let distinct = 0;
      let count = 0;
      for (const t of wanted) {
        const hits = slice.split(t).length - 1;
        if (hits) distinct++;
        count += hits;
      }
      const score = distinct * 100 + count;
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }
  }
  let end = Math.min(text.length, bestStart + size);
  if (end < text.length) {
    const lastSpace = text.lastIndexOf(" ", end);
    if (lastSpace > bestStart + size / 2) end = lastSpace;
  }
  const body = text.slice(bestStart, end).trim();
  return `${bestStart > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}
