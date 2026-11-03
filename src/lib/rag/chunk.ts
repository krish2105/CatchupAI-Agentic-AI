export type Chunk = { chunkIndex: number; pageStart: number; pageEnd: number; content: string };

/**
 * Page-faithful chunking: chunks never cross a page boundary, so every citation names the exact page.
 * Long pages are split into ~maxChars windows (≈600 tokens) on sentence/whitespace boundaries with overlap.
 */
export function chunkPages(pages: string[], opts: { maxChars?: number; overlapChars?: number } = {}): Chunk[] {
  const maxChars = opts.maxChars ?? 2400;
  const overlap = Math.min(opts.overlapChars ?? 300, Math.floor(maxChars / 3));
  const chunks: Chunk[] = [];
  pages.forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    const page = i + 1;
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + maxChars);
      if (end < text.length) {
        const window = text.slice(start, end);
        const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf(".\n"), window.lastIndexOf("? "), window.lastIndexOf("! "));
        const space = window.lastIndexOf(" ");
        const cut = sentence > maxChars * 0.5 ? sentence + 1 : space > maxChars * 0.5 ? space : window.length;
        end = start + cut;
      }
      const content = text.slice(start, end).trim();
      if (content) chunks.push({ chunkIndex: chunks.length, pageStart: page, pageEnd: page, content });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
      // Re-align the overlap to a word boundary.
      const nextSpace = text.indexOf(" ", start);
      if (nextSpace > 0 && nextSpace < end) start = nextSpace + 1;
    }
  });
  return chunks;
}
