/**
 * Deterministic assignment-brief decoding (no AI). Splits an indexed brief into sentences and proposes
 * checklist CANDIDATES: weighted marking criteria, deadlines, deliverables and requirements, each with the
 * page it came from. Nothing is saved by this module; the student edits and confirms what to keep.
 */
export type RubricKind = "criterion" | "deadline" | "deliverable" | "requirement";

export type RubricCandidate = { kind: RubricKind; text: string; weight: number | null; page: number };

const MAX_ITEMS = 30;
const WEIGHT_PAREN = /^(.{3,80}?)\s*\((\d{1,3})\s?(%|marks?|points?)\)\s*[:\-–—]?\s*(.*)$/i;
const WEIGHT_DASH = /^(.{3,80}?)\s*[:\-–—]\s*(\d{1,3})\s?(%|marks?|points?)\b[.:\-–—]?\s*(.*)$/i;
const DEADLINE = /\b(due|deadline|submit(?:ted)? by|no later than)\b/i;
const HAS_DATE = /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i;
const DELIVERABLE = /\b(submit|deliverables?|upload|hand in|attach)\b/i;
const REQUIREMENT = /\b(must|should|required?|need to|include|at least|no more than|maximum|minimum|words?|referenc\w*|citations?|format|font|late)\b/i;

/** Sentences per page, with PDF-wrapped lines re-joined (a line continuing in lowercase, a digit or "("). */
function pageSentences(text: string): string[] {
  return text
    .replace(/\n(?=[a-z0-9(–-])/g, " ")
    .split(/\n|(?<=[.;!?])\s+(?=[A-Z])/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 12 && s.length <= 320);
}

function clean(text: string) {
  return text.replace(/\s+/g, " ").replace(/^[•\-–—*\d.)\s]+/, "").replace(/[.;:\s]+$/, "").trim();
}

export function extractRubric(pages: string[]): RubricCandidate[] {
  const out: RubricCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: RubricCandidate) => {
    const key = `${c.kind}|${c.text.toLowerCase()}`;
    if (!c.text || seen.has(key) || out.length >= MAX_ITEMS) return;
    seen.add(key);
    out.push(c);
  };
  pages.forEach((pageText, i) => {
    const page = i + 1;
    for (const sentence of pageSentences(pageText)) {
      const weighted = sentence.match(WEIGHT_PAREN) ?? sentence.match(WEIGHT_DASH);
      if (weighted) {
        const weight = Number(weighted[2]);
        const isPercent = weighted[3] === "%";
        if (!isPercent || (weight > 0 && weight <= 100)) {
          const name = clean(weighted[1]);
          const detail = clean(weighted[4] ?? "");
          push({ kind: "criterion", text: detail ? `${name}: ${detail}` : name, weight: isPercent ? weight : null, page });
          continue;
        }
      }
      // Headings (no sentence punctuation, short) are context, not checklist items.
      if (!/[.!?]$/.test(sentence) && sentence.length < 60) continue;
      if (DEADLINE.test(sentence) && HAS_DATE.test(sentence)) push({ kind: "deadline", text: clean(sentence), weight: null, page });
      else if (DELIVERABLE.test(sentence)) push({ kind: "deliverable", text: clean(sentence), weight: null, page });
      else if (REQUIREMENT.test(sentence)) push({ kind: "requirement", text: clean(sentence), weight: null, page });
    }
  });
  const order: Record<RubricKind, number> = { deadline: 0, deliverable: 1, requirement: 2, criterion: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.page - b.page);
}

/** Sum of criterion weights, or null when the brief gives none. A total far from 100 is worth a warning. */
export function criteriaWeightTotal(items: Pick<RubricCandidate, "kind" | "weight">[]): number | null {
  const weights = items.filter((i) => i.kind === "criterion" && i.weight !== null).map((i) => i.weight!);
  return weights.length ? weights.reduce((s, w) => s + w, 0) : null;
}
